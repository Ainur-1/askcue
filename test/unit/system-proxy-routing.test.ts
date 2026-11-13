import t from 'tap';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';
import WebSocket, { WebSocketServer } from 'ws';
import { isLoopbackUrl, proxyRoutes, SystemProxyAgent } from '../../electron/network/ProxyRouting';
import { createGrpcProxyBridge } from '../../electron/network/GrpcProxyBridge';

async function listen(server: http.Server | net.Server): Promise<number> {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return (server.address() as net.AddressInfo).port;
}

function read(url: string, agent: SystemProxyAgent): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = http.get(url, {
            agent,
            family: 4,
            autoSelectFamily: false,
            lookup: (_hostname, _options, callback) => callback(null, '127.0.0.1', 4),
        }, (response) => {
            let body = '';
            response.setEncoding('utf8').on('data', (chunk) => { body += chunk; });
            response.on('end', () => resolve(body));
        });
        req.on('error', reject);
    });
}

t.test('PAC routes keep order, support SOCKS and do not silently bypass an unsupported proxy', (t) => {
    t.same(proxyRoutes('PROXY localhost:8080; HTTPS localhost:8443; SOCKS5 localhost:1080; DIRECT'),
        ['http://localhost:8080', 'https://localhost:8443', 'socks5h://localhost:1080', '']);
    t.same(proxyRoutes('SOCKS localhost:1080'), ['socks4a://localhost:1080']);
    t.throws(() => proxyRoutes('UNKNOWN localhost:8080'));
    for (const url of ['http://localhost:5180', 'http://127.0.0.2:11434', 'http://[::1]:11434']) {
        t.equal(isLoopbackUrl(url), true, url);
    }
    t.equal(isLoopbackUrl('https://localhost.example.com'), false);
    t.end();
});

t.test('HTTP switches proxy → direct → proxy without a process restart; localhost bypasses proxy', async (t) => {
    const target = http.createServer((_req, response) => response.end('direct'));
    const proxy = http.createServer((_req, response) => response.end('proxy'));
    const targetPort = await listen(target);
    const proxyPort = await listen(proxy);
    let enabled = true;
    let resolutions = 0;
    const agent = new SystemProxyAgent(async () => {
        resolutions++;
        return enabled ? `PROXY 127.0.0.1:${proxyPort}` : 'DIRECT';
    });
    t.teardown(() => { agent.resetConnections(); target.close(); proxy.close(); });
    const url = `http://askcue-proxy-test.invalid:${targetPort}/question`;
    t.equal(await read(url, agent), 'proxy');
    enabled = false;
    agent.resetConnections();
    t.equal(await read(url, agent), 'direct');
    enabled = true;
    agent.resetConnections();
    t.equal(await read(url, agent), 'proxy');
    const beforeLocal = resolutions;
    t.equal(await read(`http://127.0.0.1:${targetPort}/api/tags`, agent), 'direct');
    t.equal(resolutions, beforeLocal, 'local model does not even consult the proxy');
});

t.test('WebSocket speech handshakes use CONNECT through the selected proxy', async (t) => {
    const target = http.createServer();
    const websocketServer = new WebSocketServer({ server: target });
    websocketServer.on('connection', (socket) => socket.on('message', (data) => socket.send(data)));
    const targetPort = await listen(target);
    let connects = 0;
    const proxy = http.createServer();
    const tunnels = new Set<net.Socket>();
    proxy.on('connect', (_req, client, head) => {
        connects++;
        const upstream = net.connect(targetPort, '127.0.0.1', () => {
            client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head.length) upstream.write(head);
            client.pipe(upstream).pipe(client);
        });
        tunnels.add(upstream);
        upstream.on('error', () => client.destroy());
        client.on('error', () => upstream.destroy());
        client.on('close', () => upstream.destroy());
    });
    const proxyPort = await listen(proxy);
    const agent = new SystemProxyAgent(async () => `PROXY 127.0.0.1:${proxyPort}`);
    const socket = new WebSocket(`ws://askcue-speech-test.invalid:${targetPort}`, { agent });
    t.teardown(() => {
        socket.terminate();
        for (const client of websocketServer.clients) client.terminate();
        for (const tunnel of tunnels) tunnel.destroy();
        agent.resetConnections();
        websocketServer.close(); target.close(); proxy.close();
    });
    await once(socket, 'open');
    socket.send('synthetic audio');
    const [message] = await once(socket, 'message');
    t.equal(message.toString(), 'synthetic audio');
    t.equal(connects, 1);
});

t.test('gRPC bridge requires authentication, carries bytes, and closes old streams on change', async (t) => {
    const target = net.createServer((socket) => socket.pipe(socket));
    const port = await listen(target);
    const agent = new SystemProxyAgent(async () => 'DIRECT');
    const bridge = await createGrpcProxyBridge(agent);
    const proxy = new URL(bridge.url);
    t.teardown(() => { bridge.close(); agent.resetConnections(); target.close(); });

    const connect = (authorized: boolean) => new Promise<{ status: number; socket: net.Socket }>((resolve, reject) => {
        const request = http.request({
            hostname: proxy.hostname, port: proxy.port, method: 'CONNECT', path: `127.0.0.1:${port}`,
            headers: authorized ? { 'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.username}:`).toString('base64')}` } : {},
        });
        request.on('connect', (response, socket) => resolve({ status: response.statusCode!, socket }));
        request.on('error', reject);
        request.end();
    });
    const refused = await connect(false);
    t.equal(refused.status, 407);
    refused.socket.destroy();
    const accepted = await connect(true);
    t.equal(accepted.status, 200);
    accepted.socket.write('speech');
    const [data] = await once(accepted.socket, 'data');
    t.equal(data.toString(), 'speech');
    const closed = once(accepted.socket, 'close');
    bridge.closeConnections();
    await closed;
    t.pass('old speech tunnel disconnected');
});

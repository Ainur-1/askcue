import http from 'node:http';
import type { Socket } from 'node:net';
import { randomBytes } from 'node:crypto';
import type { SystemProxyAgent } from './ProxyRouting';

/** grpc-js only supports HTTP proxies; this loopback bridge also handles system PAC/SOCKS. */
export async function createGrpcProxyBridge(agent: SystemProxyAgent) {
    const token = randomBytes(24).toString('hex');
    const authorization = `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
    const sockets = new Set<Socket>();
    const server = http.createServer((_req, response) => { response.writeHead(405).end(); });
    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('error', () => {});
        socket.once('close', () => sockets.delete(socket));
    });
    server.on('connect', async (request, client, head) => {
        let upstream: Socket | undefined;
        try {
            if (request.headers['proxy-authorization'] !== authorization) {
                client.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n');
                return;
            }
            const target = new URL(`https://${request.url}`);
            if (target.pathname !== '/' || target.username || target.password || target.search || target.hash) {
                throw new Error('Invalid CONNECT target');
            }
            upstream = await agent.tunnel(target.hostname.replace(/^\[|\]$/g, ''), Number(target.port || 443));
            sockets.add(upstream);
            const remote = upstream;
            remote.on('error', () => client.destroy());
            remote.once('close', () => { sockets.delete(remote); client.destroy(); });
            client.once('close', () => remote.destroy());
            if (client.destroyed) { remote.destroy(); return; }
            client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head.length) remote.write(head);
            client.pipe(remote).pipe(client);
        } catch {
            upstream?.destroy();
            if (!client.destroyed) client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        }
    });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
    server.unref();
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Cannot initialize speech proxy');
    const closeConnections = () => { for (const socket of sockets) socket.destroy(); };
    return {
        url: `http://${token}:@127.0.0.1:${address.port}`,
        closeConnections,
        close: () => { closeConnections(); server.close(); },
    };
}

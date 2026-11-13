const { app, session, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const fs = require('node:fs');
// configPaths also uses os.homedir on macOS/Linux. Keep that inside the fixture.
require('node:os').homedir = () => process.env.ASKCUE_PROXY_TEST_PROFILE;
require('tsx/cjs');

app.setPath('userData', process.env.ASKCUE_PROXY_TEST_PROFILE);
app.on('window-all-closed', () => {});
app.commandLine.appendSwitch('host-resolver-rules', 'MAP askcue-proxy-test.invalid 127.0.0.1');
const { initializeSystemProxy, setSystemProxyEnabled, getSystemProxyEnabled } = require('../../electron/services/SystemProxyManager.ts');
const { systemProxyAgent } = require('../../electron/network/ProxyRouting.ts');
const { getSettingsJsonPath } = require('../../electron/services/configPaths.ts');

async function listen(server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return server.address().port;
}

async function main() {
    await app.whenReady();
    const initialDirect = process.env.ASKCUE_PROXY_TEST_START_DIRECT === '1';
    fs.writeFileSync(getSettingsJsonPath(), '\uFEFF' + JSON.stringify({ verboseLogging: false, actionButtonMode: 'recap',
        ...(initialDirect ? { useSystemProxy: false } : {}) }));
    await initializeSystemProxy();
    assert.equal(getSystemProxyEnabled(), !initialDirect);
    if (initialDirect) {
        assert.equal(await session.defaultSession.resolveProxy('https://api.openai.com'), 'DIRECT');
        console.log('PASS saved direct setting is respected at startup');
        await setSystemProxyEnabled(true);
    }
    const systemRoute = await session.defaultSession.resolveProxy('https://api.openai.com');
    console.log('OS proxy:', systemRoute.split(';').map((route) => route.trim().split(' ')[0]).join('; '));
    assert.equal(getSystemProxyEnabled(), true);

    const target = http.createServer((_req, response) => response.end('direct'));
    const port = await listen(target);
    let proxyRequests = 0;
    let proxyConnects = 0;
    const tunnelSockets = new Set();
    const proxy = http.createServer((request, response) => {
        proxyRequests++;
        request.resume();
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({
            route: 'proxy', object: 'list', has_more: false,
            data: [{ id: 'proxy-model', object: 'model', type: 'model', display_name: 'test', created_at: '2026-01-01T00:00:00Z' }],
            candidates: [{ content: { parts: [{ text: 'proxy' }], role: 'model' }, finishReason: 'STOP' }],
        }));
    });
    proxy.on('connect', (request, client, head) => {
        proxyConnects++;
        const destination = new URL(`https://${request.url}`);
        const upstream = net.connect(Number(destination.port || 443), '127.0.0.1', () => {
            client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head.length) upstream.write(head);
            client.pipe(upstream).pipe(client);
        });
        tunnelSockets.add(upstream);
        upstream.on('error', () => client.destroy());
        client.on('error', () => upstream.destroy());
        client.on('close', () => upstream.destroy());
    });
    const proxyPort = await listen(proxy);
    const useTestProxy = () => session.defaultSession.setProxy({ mode: 'fixed_servers', proxyRules: `127.0.0.1:${proxyPort}` });
    const url = `http://askcue-proxy-test.invalid:${port}`;
    await useTestProxy();
    assert.equal((await (await fetch(url)).json()).route, 'proxy');
    console.log('PASS Electron fetch uses proxy');

    const axios = require('axios').default;
    assert.equal((await axios.get(url)).data.route, 'proxy');
    console.log('PASS Axios uses proxy');

    const OpenAI = require('openai').default;
    const Anthropic = require('@anthropic-ai/sdk').default;
    const Groq = require('groq-sdk').default;
    const { GoogleGenAI } = require('@google/genai');
    for (const [name, client] of [
        ['OpenAI', new OpenAI({ apiKey: 'synthetic-test-key', baseURL: url })],
        ['Claude', new Anthropic({ apiKey: 'synthetic-test-key', baseURL: url })],
        ['Groq', new Groq({ apiKey: 'synthetic-test-key', baseURL: url, httpAgent: systemProxyAgent })],
    ]) {
        assert.equal((await client.models.list()).data[0].id, 'proxy-model');
        console.log(`PASS ${name} SDK uses proxy`);
    }
    const gemini = new GoogleGenAI({ apiKey: 'synthetic-test-key', httpOptions: { baseUrl: url } });
    assert.equal((await gemini.models.generateContent({ model: 'test', contents: 'test' })).text, 'proxy');
    console.log('PASS Gemini SDK uses proxy');

    const WebSocket = require('ws');
    const websocketServer = new WebSocket.WebSocketServer({ server: target });
    websocketServer.on('connection', (socket) => socket.on('message', (message) => socket.send(message)));
    const websocket = new WebSocket(url.replace('http:', 'ws:'), { agent: systemProxyAgent });
    await once(websocket, 'open');
    websocket.send('synthetic-audio');
    assert.equal((await once(websocket, 'message'))[0].toString(), 'synthetic-audio');
    websocket.terminate();
    console.log('PASS WebSocket uses proxy');

    const grpc = require('@grpc/grpc-js');
    const method = { path: '/proxy/Ping', requestStream: false, responseStream: false,
        requestSerialize: (value) => Buffer.from(value), requestDeserialize: (value) => value.toString(),
        responseSerialize: (value) => Buffer.from(value), responseDeserialize: (value) => value.toString() };
    const grpcServer = new grpc.Server();
    grpcServer.addService({ ping: method }, { ping: (call, callback) => callback(null, call.request) });
    const grpcPort = await new Promise((resolve, reject) => grpcServer.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(),
        (error, value) => error ? reject(error) : resolve(value)));
    const Client = grpc.makeGenericClientConstructor({ ping: method }, 'Proxy');
    const client = new Client(`askcue-grpc-test.invalid:${grpcPort}`, grpc.credentials.createInsecure());
    assert.equal(await new Promise((resolve, reject) => client.ping('speech', { deadline: Date.now() + 15_000 },
        (error, value) => error ? reject(error) : resolve(value))), 'speech');
    client.close(); grpcServer.forceShutdown();
    assert.ok(proxyConnects >= 2);
    console.log('PASS gRPC uses proxy bridge');

    await setSystemProxyEnabled(false);
    assert.equal(await (await fetch(url)).text(), 'direct');
    assert.equal(getSystemProxyEnabled(), false);
    console.log('PASS disable applies immediately');
    await setSystemProxyEnabled(true);
    await useTestProxy();
    assert.equal((await (await fetch(url)).json()).route, 'proxy');
    assert.equal(getSystemProxyEnabled(), true);
    console.log('PASS re-enable applies immediately');
    await assert.rejects(setSystemProxyEnabled('yes'), /boolean/);
    const saved = JSON.parse(fs.readFileSync(getSettingsJsonPath(), 'utf8'));
    assert.equal(saved.useSystemProxy, true);
    assert.equal(saved.actionButtonMode, 'recap');
    console.log('PASS setting persists; invalid IPC value rejected');
    const before = proxyRequests;
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/api/tags`)).text(), 'direct');
    assert.equal(proxyRequests, before);
    console.log('PASS localhost bypasses proxy');

    // Exercise the actual React switch through the actual context-isolated preload and IPC.
    const path = require('node:path');
    const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite')] }));
    const preload = path.join(process.env.ASKCUE_PROXY_TEST_PROFILE, 'preload.cjs');
    esbuild.buildSync({ entryPoints: [path.resolve(__dirname, '../../electron/preload.ts')],
        bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: preload });
    const ui = esbuild.buildSync({ stdin: {
        contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
            import { SystemProxySettings } from './src/components/settings/SystemProxySettings';
            createRoot(document.getElementById('root')).render(React.createElement(SystemProxySettings));`,
        resolveDir: path.resolve(__dirname, '../..'), loader: 'tsx' },
        bundle: true, platform: 'browser', format: 'iife', write: false,
        define: { 'process.env.NODE_ENV': '"production"' } }).outputFiles[0].text;
    let reconnects = 0;
    const { registerSystemHandlers } = require('../../electron/ipc/system.ts');
    const state = { getIsMeetingActive: () => true, reconfigureSttProvider: async () => { reconnects++; } };
    registerSystemHandlers(state);
    const window = new BrowserWindow({ show: false, webPreferences: { preload, contextIsolation: true, nodeIntegration: false } });
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<div id="root"></div><script>${ui}</script>`)}`);
    const waitForUi = (condition) => window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const deadline = Date.now() + 5000; const poll = () => {
            if (${condition}) return resolve(true);
            if (Date.now() > deadline) return reject(new Error('Switch did not settle'));
            setTimeout(poll, 25);
        }; poll(); })`);
    await waitForUi(`document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'true' && !document.querySelector('[role="switch"]').disabled`);
    await window.webContents.executeJavaScript(`document.querySelector('[role="switch"]').click()`);
    await waitForUi(`document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'false' && !document.querySelector('[role="switch"]').disabled`);
    assert.equal(getSystemProxyEnabled(), false);
    await window.webContents.executeJavaScript(`document.querySelector('[role="switch"]').click()`);
    await waitForUi(`document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'true' && !document.querySelector('[role="switch"]').disabled`);
    assert.equal(getSystemProxyEnabled(), true);
    assert.equal(reconnects, 2);
    console.log('PASS React switch → preload → IPC; active speech reconnects twice without restarting');
    ipcMain.removeHandler('network:set-system-proxy');
    ipcMain.handle('network:set-system-proxy', () => ({ success: false, error: 'Synthetic proxy failure' }));
    await window.webContents.executeJavaScript(`document.querySelector('[role="switch"]').click()`);
    await waitForUi(`document.querySelector('[role="status"]')?.textContent === 'Synthetic proxy failure' && !document.querySelector('[role="switch"]').disabled`);
    assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[role="switch"]').getAttribute('aria-checked')`), 'true');
    assert.equal(getSystemProxyEnabled(), true);
    window.destroy();
    console.log('PASS UI keeps the applied setting and shows an error on failure');

    // Optional, unauthenticated connectivity check through the actual OS proxy.
    if (process.env.ASKCUE_PROXY_TEST_EXTERNAL === '1') {
        await session.defaultSession.setProxy({ mode: 'system' });
        const result = await fetch('https://api.openai.com/v1/models', { signal: AbortSignal.timeout(10_000) });
        assert.equal(result.status, 401);
        await result.arrayBuffer();
        const nodeResult = await axios.get('https://api.openai.com/v1/models', { timeout: 10_000, validateStatus: () => true });
        assert.equal(nodeResult.status, 401);
        console.log('PASS HTTPS through actual OS proxy (fetch and Axios; HTTP 401 as expected without a key)');
    }
    for (const socket of websocketServer.clients) socket.terminate();
    for (const socket of tunnelSockets) socket.destroy();
    websocketServer.close(); target.close(); proxy.close();
    console.log('PASS proxy smoke test completed');
}

main().then(() => app.quit()).catch((error) => {
    console.error(error.stack || error.message);
    app.exit(1);
});

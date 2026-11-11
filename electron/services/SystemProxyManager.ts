import { app, session } from 'electron';
import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import { SettingsManager } from './SettingsManager';
import { isLoopbackUrl, setProxyResolver, systemProxyAgent } from '../network/ProxyRouting';
import { createGrpcProxyBridge } from '../network/GrpcProxyBridge';

let enabled = true;
let initialized = false;
let bridge: Awaited<ReturnType<typeof createGrpcProxyBridge>> | undefined;
let pendingChange: Promise<unknown> = Promise.resolve();

export function getSystemProxyEnabled(): boolean { return enabled; }

export async function initializeSystemProxy(): Promise<void> {
    if (initialized) return;
    enabled = SettingsManager.getInstance().get('useSystemProxy') !== false;
    await session.defaultSession.setProxy({ mode: enabled ? 'system' : 'direct' });
    setProxyResolver((url) => enabled ? session.defaultSession.resolveProxy(url) : Promise.resolve('DIRECT'));

    // Chromium knows OS settings and PAC. Node fetch and SDKs otherwise bypass them.
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!/^https?:/i.test(url) || isLoopbackUrl(url)) return nativeFetch(input, init);
        return session.defaultSession.fetch(input instanceof URL ? input.href : input, init);
    }) as typeof fetch;
    http.globalAgent = systemProxyAgent;
    https.globalAgent = systemProxyAgent as unknown as https.Agent;
    axios.defaults.httpAgent = systemProxyAgent;
    axios.defaults.httpsAgent = systemProxyAgent;
    // Avoid an environment proxy being applied on top of the system routing agent.
    axios.defaults.proxy = false;

    bridge = await createGrpcProxyBridge(systemProxyAgent);
    const previousGrpcProxy = process.env.grpc_proxy;
    const previousNoGrpcProxy = process.env.no_grpc_proxy;
    process.env.grpc_proxy = bridge.url;
    process.env.no_grpc_proxy = 'localhost,127.0.0.1,::1';
    app.once('will-quit', () => {
        bridge?.close();
        systemProxyAgent.resetConnections();
        if (previousGrpcProxy === undefined) delete process.env.grpc_proxy;
        else process.env.grpc_proxy = previousGrpcProxy;
        if (previousNoGrpcProxy === undefined) delete process.env.no_grpc_proxy;
        else process.env.no_grpc_proxy = previousNoGrpcProxy;
    });
    initialized = true;
}

/** Serialize changes from different windows and persist only an applied setting. */
export function setSystemProxyEnabled(value: boolean): Promise<void> {
    const change = pendingChange.catch(() => {}).then(async () => {
        if (typeof value !== 'boolean') throw new Error('System proxy setting must be a boolean');
        if (!initialized) throw new Error('Network settings are not ready');
        if (value === enabled) return;
        await session.defaultSession.setProxy({ mode: value ? 'system' : 'direct' });
        try {
            await session.defaultSession.closeAllConnections();
        } catch (error) {
            await session.defaultSession.setProxy({ mode: enabled ? 'system' : 'direct' });
            throw error;
        }
        enabled = value;
        // Existing sockets must not keep the previous route alive after a switch.
        systemProxyAgent.resetConnections();
        bridge?.closeConnections();
        SettingsManager.getInstance().set('useSystemProxy', value);
    });
    pendingChange = change;
    return change;
}

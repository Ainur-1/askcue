import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { Agent, type AgentConnectOpts } from 'agent-base';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export type ProxyResolver = (url: string) => Promise<string>;

// Local models and the development server must remain reachable with a proxy on.
export function isLoopbackUrl(value: string): boolean {
    const host = new URL(value).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host.endsWith('.localhost') || host === '::1'
        || /^127\./.test(host) || /^::ffff:127\./.test(host);
}

/** Chromium/PAC results, in their configured failover order. Never invent DIRECT. */
export function proxyRoutes(result: string): string[] {
    return result.split(';').map((entry) => {
        const [kind, address] = entry.trim().split(/\s+/);
        if (kind === 'DIRECT') return '';
        const schemes: Record<string, string> = {
            PROXY: 'http', HTTP: 'http', HTTPS: 'https',
            SOCKS: 'socks4a', SOCKS4: 'socks4a', SOCKS5: 'socks5h',
        };
        if (!schemes[kind] || !address) throw new Error('Unsupported system proxy configuration');
        return `${schemes[kind]}://${address}`;
    });
}

/** Shared by Axios, node-fetch SDKs and WebSocket handshakes. */
export class SystemProxyAgent extends Agent {
    private directHttp = new http.Agent({ keepAlive: true });
    private directHttps = new https.Agent({ keepAlive: true });
    private agents = new Map<string, HttpProxyAgent<string> | HttpsProxyAgent<string> | SocksProxyAgent>();

    constructor(private resolve: ProxyResolver) { super(); }

    private async routes(url: string): Promise<string[]> {
        return isLoopbackUrl(url) ? [''] : proxyRoutes(await this.resolve(url));
    }

    async connect(req: http.ClientRequest, options: AgentConnectOpts) {
        const websocket = req.getHeader('upgrade') === 'websocket';
        const protocol = options.secureEndpoint ? (websocket ? 'wss:' : 'https:') : (websocket ? 'ws:' : 'http:');
        const url = new URL(req.path, `${protocol}//${req.getHeader('host')}`).href;
        const [proxy] = await this.routes(url);
        if (!proxy) return options.secureEndpoint ? this.directHttps : this.directHttp;
        const tunnel = options.secureEndpoint || websocket;
        const key = `${tunnel}:${proxy}`;
        let agent = this.agents.get(key);
        if (!agent) {
            agent = proxy.startsWith('socks') ? new SocksProxyAgent(proxy, { timeout: 30_000 })
                : tunnel ? new HttpsProxyAgent(proxy) : new HttpProxyAgent(proxy);
            this.agents.set(key, agent);
        }
        return agent;
    }

    /** Raw tunnels let gRPC use the same PAC/SOCKS routing as the other transports. */
    async tunnel(host: string, port: number): Promise<net.Socket> {
        const authority = `${net.isIPv6(host) ? `[${host}]` : host}:${port}`;
        const routes = await this.routes(`https://${authority}`);
        let lastError: unknown;
        for (const proxy of routes) {
            try {
                if (!proxy) {
                    return await new Promise<net.Socket>((resolve, reject) => {
                        const socket = net.connect({ host, port });
                        socket.setTimeout(30_000, () => socket.destroy(new Error('Connection timed out')));
                        socket.once('error', reject);
                        socket.once('connect', () => { socket.setTimeout(0); resolve(socket); });
                    });
                }
                const agent = proxy.startsWith('socks')
                    ? new SocksProxyAgent(proxy, { timeout: 30_000 }) : new HttpsProxyAgent(proxy, { timeout: 30_000 });
                const request = new EventEmitter() as http.ClientRequest;
                let status = 200;
                request.on('proxyConnect', (response: { statusCode: number }) => { status = response.statusCode; });
                const socket = await agent.connect(request, { host, port, secureEndpoint: false });
                if (status !== 200) {
                    socket.destroy();
                    throw new Error(`System proxy refused CONNECT (HTTP ${status})`);
                }
                return socket;
            } catch (error) { lastError = error; }
        }
        throw lastError ?? new Error('System proxy returned no routes');
    }

    resetConnections(): void {
        this.directHttp.destroy();
        this.directHttps.destroy();
        for (const agent of this.agents.values()) agent.destroy();
        this.agents.clear();
        super.destroy();
    }
}

let resolver: ProxyResolver = async () => 'DIRECT';
export const systemProxyAgent = new SystemProxyAgent((url) => resolver(url));
export function setProxyResolver(value: ProxyResolver): void { resolver = value; }

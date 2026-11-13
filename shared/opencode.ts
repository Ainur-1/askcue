export interface OpenCodeSettings {
    enabled: boolean;
    baseUrl: string;
    username: string;
    password: string;
}

export interface OpenCodeModel {
    id: string;
    name: string;
    provider: string;
    supportsImages: boolean;
}

export const OPENCODE_GO_SUBSCRIPTION_URL = 'https://opencode.ai/go';
export const OPENCODE_GO_API_URL = 'https://opencode.ai/zen/go/v1';

export interface OpenCodeConnectionInfo extends Omit<OpenCodeSettings, 'password'> {
    hasPassword: boolean;
    canImport: boolean;
    hasApiKey: boolean;
    providerID: 'opencode' | 'opencode-go';
    apiUrl: string;
    subscriptionUrl: string;
}

export const DEFAULT_OPENCODE_SETTINGS: OpenCodeSettings = {
    enabled: false,
    baseUrl: 'http://127.0.0.1:4096',
    username: 'opencode',
    password: '',
};

export function openCodeModelId(providerID: string, modelID: string): string {
    return `opencode:${providerID}/${modelID}`;
}

/** Recognize official inference endpoints only; display names are user editable. */
export function openCodeProviderForUrl(baseUrl: string): 'opencode' | 'opencode-go' | undefined {
    try {
        const url = new URL(baseUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'opencode.ai' || url.username || url.password) return;
        const pathname = url.pathname.replace(/\/+$/, '');
        if (pathname === '/zen/go/v1' || /^\/inference\/go\/(openai|anthropic|google)\/v1$/.test(pathname)) return 'opencode-go';
        if (pathname === '/zen/v1' || /^\/inference\/(openai|anthropic|google)\/v1$/.test(pathname)) return 'opencode';
    } catch { /* Not an official OpenCode endpoint. */ }
}

export function parseOpenCodeModelId(id: string): { providerID: string; modelID: string } {
    const value = id.startsWith('opencode:') ? id.slice(9) : '';
    const slash = value.indexOf('/');
    if (slash <= 0 || slash === value.length - 1) throw new Error('Invalid OpenCode model ID');
    return { providerID: value.slice(0, slash), modelID: value.slice(slash + 1) };
}

export function validateOpenCodeSettings(value: unknown): OpenCodeSettings {
    const settings = value as OpenCodeSettings;
    if (!settings || typeof settings.enabled !== 'boolean' || typeof settings.baseUrl !== 'string' ||
        typeof settings.username !== 'string' || typeof settings.password !== 'string') {
        throw new Error('Invalid OpenCode settings');
    }
    const url = new URL(settings.baseUrl.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Use an HTTP(S) server URL without credentials, query or fragment');
    }
    return { ...settings, baseUrl: url.href.replace(/\/$/, ''), username: settings.username.trim() || 'opencode' };
}

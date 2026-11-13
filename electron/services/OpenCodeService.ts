import type { OpencodeClient } from '@opencode-ai/sdk/v2/client' with { 'resolution-mode': 'import' };
import { OpenCodeSettings, OpenCodeModel, openCodeModelId, parseOpenCodeModelId, validateOpenCodeSettings } from '../../shared/opencode';

// Preserve native import: Electron's main process is compiled to CommonJS; the SDK is ESM.
const importSdk = new Function('return import("@opencode-ai/sdk/v2/client")') as
    () => Promise<typeof import('@opencode-ai/sdk/v2/client', { with: { 'resolution-mode': 'import' } })>;

export interface OpenCodeImage { mime: string; url: string }

export class OpenCodeService {
    constructor(
        private readonly getSettings: () => OpenCodeSettings,
        private readonly startLocal?: () => Promise<string>,
        private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
    ) {}

    private async client(): Promise<OpencodeClient> {
        const settings = validateOpenCodeSettings(this.getSettings());
        if (!settings.enabled) throw new Error('OpenCode is disabled. Enable it in AI Providers.');
        const baseUrl = this.startLocal && settings.baseUrl === 'http://127.0.0.1:4096'
            ? await this.startLocal() : settings.baseUrl;
        const { createOpencodeClient } = await importSdk();
        return createOpencodeClient({
            baseUrl,
            headers: settings.password ? {
                Authorization: `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`,
            } : undefined,
            fetch: this.fetcher,
        });
    }

    async models(): Promise<OpenCodeModel[]> {
        const client = await this.client();
        const { data } = await client.provider.list({}, { throwOnError: true, signal: AbortSignal.timeout(15000) });
        const connected = new Set(data.connected);
        return data.all.filter(provider => connected.has(provider.id)).flatMap(provider =>
            Object.values(provider.models).filter(model => model.capabilities.input.text && model.status !== 'deprecated')
                .map(model => ({
                    id: openCodeModelId(provider.id, model.id),
                    name: `${model.name} · ${provider.name} (OpenCode)`,
                    provider: provider.name,
                    supportsImages: model.capabilities.input.image,
                }))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }

    async connectApiKey(providerID: string, key: string): Promise<void> {
        // Importing an existing AskCue key is confined to the local OpenCode server.
        if (validateOpenCodeSettings(this.getSettings()).baseUrl !== 'http://127.0.0.1:4096') {
            throw new Error('Saved keys can only be imported into local OpenCode');
        }
        const client = await this.client();
        await client.auth.set({ providerID, auth: { type: 'api', key } }, { throwOnError: true, signal: AbortSignal.timeout(15000) });
        await client.instance.dispose({}, { throwOnError: true, signal: AbortSignal.timeout(15000) });
    }

    async complete(model: string, text: string, system?: string, images: OpenCodeImage[] = []): Promise<string> {
        let result = '';
        for await (const chunk of this.stream(model, text, system, images)) result += chunk;
        return result;
    }

    async *stream(modelId: string, text: string, system?: string, images: OpenCodeImage[] = []): AsyncGenerator<string> {
        const model = parseOpenCodeModelId(modelId);
        const client = await this.client();
        const deadline = AbortSignal.timeout(120000);
        const { data: session } = await client.session.create({
            title: 'AskCue request',
            // This integration answers questions. Tools, files, MCP and shell access are unnecessary.
            permission: [{ permission: '*', pattern: '*', action: 'deny' }],
        }, { throwOnError: true, signal: deadline });
        const eventsController = new AbortController();
        const promptController = new AbortController();
        let completed = false;
        let streamed = '';
        const textParts = new Set<string>();
        try {
            const events = await client.event.subscribe({}, {
                signal: AbortSignal.any([deadline, eventsController.signal]),
                // Do not reconnect an interrupted request forever.
                sseMaxRetryAttempts: 0,
            });
            const iterator = events.stream[Symbol.asyncIterator]();
            const response = client.session.prompt({
                sessionID: session.id, model, system,
                parts: [{ type: 'text', text }, ...images.map(image => ({ type: 'file' as const, ...image }))],
            }, { throwOnError: true, signal: AbortSignal.any([deadline, promptController.signal]) });
            // Convert rejections immediately, including while the consumer is between yields.
            const done = response.then(value => ({ kind: 'done' as const, value }), error => ({ kind: 'error' as const, error }));
            while (true) {
                const next = await Promise.race([
                    done, iterator.next().then(value => ({ kind: 'event' as const, value })),
                ]);
                if (next.kind === 'error') throw next.error;
                if (next.kind === 'done') {
                    completed = true;
                    const result = next.value.data;
                    if (result.info.error) {
                        const error = result.info.error;
                        throw new Error('message' in error.data ? String(error.data.message) : error.name);
                    }
                    const answer = result.parts.filter(part => part.type === 'text' && !part.ignored && !part.synthetic)
                        .map(part => part.type === 'text' ? part.text : '').join('');
                    if (!answer.trim()) throw new Error('OpenCode returned an empty response');
                    // The final response also covers fast replies or deltas lost before subscription.
                    if (answer.startsWith(streamed) && answer.length > streamed.length) yield answer.slice(streamed.length);
                    else if (!streamed) yield answer;
                    return;
                }
                if (next.value.done) {
                    // An SSE disconnect must not discard a response still being generated.
                    const final = await done;
                    if (final.kind === 'error') throw final.error;
                    // Read the completed response on the next iteration without another SSE read.
                    continue;
                }
                const event = next.value.value;
                if (!event) continue;
                if (event.type === 'message.part.delta' && event.properties.sessionID === session.id && event.properties.field === 'text') {
                    // Reasoning parts also use the text field. Only visible text parts are collected below.
                    const partID = event.properties.partID;
                    if (textParts.has(partID)) {
                        streamed += event.properties.delta;
                        yield event.properties.delta;
                    }
                }
                if (event.type === 'message.part.updated' && event.properties.part.sessionID === session.id && event.properties.part.type === 'text' && !event.properties.part.ignored && !event.properties.part.synthetic) {
                    textParts.add(event.properties.part.id);
                }
            }
        } finally {
            eventsController.abort();
            promptController.abort();
            if (!completed) await client.session.abort({ sessionID: session.id }, { signal: AbortSignal.timeout(3000) }).catch(() => {});
            await client.session.delete({ sessionID: session.id }, { signal: AbortSignal.timeout(3000) }).catch(() => {});
        }
    }
}

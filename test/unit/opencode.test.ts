import t from 'tap';
import http from 'node:http';
import { once } from 'node:events';
import { OpenCodeService } from '../../electron/services/OpenCodeService';
import { DEFAULT_OPENCODE_SETTINGS, openCodeModelId, parseOpenCodeModelId, validateOpenCodeSettings, openCodeProviderForUrl } from '../../shared/opencode';

t.test('model IDs preserve provider namespaces and settings reject invalid server URLs', t => {
    t.same(parseOpenCodeModelId(openCodeModelId('openrouter', 'vendor/model:free')), { providerID: 'openrouter', modelID: 'vendor/model:free' });
    for (const id of ['gpt-5', 'opencode:/model', 'opencode:provider/']) t.throws(() => parseOpenCodeModelId(id));
    for (const baseUrl of ['file:///tmp/server', 'https://user:secret@server.test', 'http://localhost/?key=secret']) {
        t.throws(() => validateOpenCodeSettings({ ...DEFAULT_OPENCODE_SETTINGS, baseUrl }));
    }
    t.equal(validateOpenCodeSettings({ ...DEFAULT_OPENCODE_SETTINGS, baseUrl: ' http://localhost:4096/ ' }).baseUrl, 'http://localhost:4096');
    t.equal(openCodeProviderForUrl('https://opencode.ai/zen/go/v1/'), 'opencode-go');
    t.equal(openCodeProviderForUrl('https://opencode.ai/zen/v1'), 'opencode');
    t.equal(openCodeProviderForUrl('https://opencode.ai/inference/go/openai/v1'), 'opencode-go');
    for (const url of ['http://opencode.ai/zen/v1', 'https://opencode.ai.evil.test/zen/v1', 'https://other.test/zen/v1']) t.equal(openCodeProviderForUrl(url), undefined);
    t.end();
});

async function fixture(t: Tap.Test, options: { error?: boolean; empty?: boolean; noEvents?: boolean; hang?: boolean; unauthorized?: boolean } = {}) {
    const requests: { path: string; method: string; body: any; authorization?: string }[] = [];
    let eventResponse: http.ServerResponse | undefined;
    const server = http.createServer(async (request, response) => {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const body = raw ? JSON.parse(raw) : undefined;
        const pathname = new URL(request.url!, 'http://localhost').pathname;
        requests.push({ path: pathname, method: request.method!, body, authorization: request.headers.authorization });
        if (options.unauthorized) { response.writeHead(401, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ message: 'Unauthorized' })); return; }
        const json = (value: unknown) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); };
        if (pathname === '/provider') {
            const model = (id: string, status = 'active', text = true) => ({ id, name: id, status, capabilities: { input: { text, image: true } } });
            json({ connected: ['openrouter'], default: {}, all: [
                { id: 'openrouter', name: 'OpenRouter', models: { a: model('vendor/model:free'), b: model('old', 'deprecated'), c: model('embedding', 'active', false) } },
                { id: 'disconnected', name: 'No credentials', models: { a: model('unavailable') } },
            ] });
        } else if (pathname === '/session' && request.method === 'POST') json({ id: 'ses_test' });
        else if (pathname === '/event') {
            response.writeHead(200, { 'Content-Type': 'text/event-stream' });
            response.flushHeaders();
            eventResponse = response;
        } else if (pathname.endsWith('/message')) {
            // Let the official SDK's lazy event iterator establish the subscription.
            for (let i = 0; !eventResponse && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 2));
            if (!options.noEvents && eventResponse) {
                const event = (type: string, properties: unknown) => eventResponse!.write(`data: ${JSON.stringify({ type, properties })}\n\n`);
                event('message.part.updated', { part: { id: 'reasoning', sessionID: 'ses_test', type: 'reasoning' } });
                event('message.part.delta', { sessionID: 'ses_test', partID: 'reasoning', field: 'text', delta: 'private reasoning' });
                event('message.part.updated', { part: { id: 'visible', sessionID: 'ses_test', type: 'text', text: '' } });
                event('message.part.delta', { sessionID: 'other_session', partID: 'visible', field: 'text', delta: 'foreign session' });
                event('message.part.delta', { sessionID: 'ses_test', partID: 'visible', field: 'text', delta: 'Hello ' });
            }
            if (options.hang) return;
            await new Promise(resolve => setTimeout(resolve, 30));
            json({ info: options.error ? { error: { name: 'APIError', data: { message: 'Provider quota exhausted' } } } : {}, parts: options.empty ? [] : [
                { type: 'reasoning', text: 'hidden' }, { type: 'text', text: 'Hello world' },
            ] });
        } else json(true);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.teardown(() => { eventResponse?.end(); server.closeAllConnections(); server.close(); });
    const baseUrl = `http://127.0.0.1:${(server.address() as import('net').AddressInfo).port}`;
    const service = new OpenCodeService(() => ({ ...DEFAULT_OPENCODE_SETTINGS, enabled: true, baseUrl, password: 'secret' }));
    return { service, requests, baseUrl };
}

t.test('official SDK discovers only connected, usable models and sends server authentication', async t => {
    const { service, requests } = await fixture(t);
    t.same(await service.models(), [{ id: 'opencode:openrouter/vendor/model:free', name: 'vendor/model:free · OpenRouter (OpenCode)', provider: 'OpenRouter', supportsImages: true }]);
    t.equal(requests[0].authorization, `Basic ${Buffer.from('opencode:secret').toString('base64')}`);
});

t.test('official SDK streams visible text, preserves the selected model and images, and deletes isolated sessions', async t => {
    const { service, requests } = await fixture(t);
    const chunks: string[] = [];
    for await (const chunk of service.stream('opencode:openrouter/vendor/model:free', 'Question', 'System context', [{ mime: 'image/png', url: 'data:image/png;base64,YQ==' }])) chunks.push(chunk);
    t.same(chunks, ['Hello ', 'world'], 'deltas plus final suffix without duplicates or reasoning');
    const prompt = requests.find(request => request.path.endsWith('/message'))!;
    t.same(prompt.body.model, { providerID: 'openrouter', modelID: 'vendor/model:free' });
    t.equal(prompt.body.system, 'System context');
    t.same(prompt.body.parts, [{ type: 'text', text: 'Question' }, { type: 'file', mime: 'image/png', url: 'data:image/png;base64,YQ==' }]);
    t.same(requests.find(request => request.path === '/session')!.body.permission, [{ permission: '*', pattern: '*', action: 'deny' }]);
    t.ok(requests.some(request => request.method === 'DELETE'));
    t.notOk(requests.some(request => request.path.endsWith('/abort')), 'successful requests are not aborted');
});

t.test('final response works when no streaming deltas arrive', async t => {
    const { service } = await fixture(t, { noEvents: true });
    t.equal(await service.complete('opencode:openrouter/vendor/model', 'Question'), 'Hello world');
});

t.test('provider errors and empty responses surface with session cleanup', async t => {
    for (const options of [{ error: true }, { empty: true }]) {
        const { service, requests } = await fixture(t, { ...options, noEvents: true });
        await t.rejects(service.complete('opencode:openrouter/vendor/model', 'Question'), options.error ? /Provider quota exhausted/ : /empty response/);
        t.ok(requests.some(request => request.method === 'DELETE'));
    }
});

t.test('closing the stream aborts the request and cleans up its session', async t => {
    const { service, requests } = await fixture(t, { hang: true });
    const stream = service.stream('opencode:openrouter/vendor/model', 'Question');
    t.equal((await stream.next()).value, 'Hello ');
    await stream.return(undefined);
    t.ok(requests.some(request => request.path.endsWith('/abort')));
    t.ok(requests.some(request => request.method === 'DELETE'));
});

t.test('disabled integrations do not connect; HTTP authentication failures reject', async t => {
    let calls = 0;
    const disabled = new OpenCodeService(() => DEFAULT_OPENCODE_SETTINGS, undefined, async () => { calls++; throw new Error('unexpected fetch'); });
    await t.rejects(disabled.models(), /disabled/);
    t.equal(calls, 0);
    const { service } = await fixture(t, { unauthorized: true });
    await t.rejects(service.models());
});

t.test('saved provider keys cannot be sent to a remote server', async t => {
    const { service, requests } = await fixture(t);
    await t.rejects(service.connectApiKey('opencode-go', 'saved-key'), /only be imported into local OpenCode/);
    t.equal(requests.length, 0);
});

t.test('saved local connections use official SDK auth and refresh the OpenCode instance', async t => {
    const { requests, baseUrl } = await fixture(t);
    const service = new OpenCodeService(() => ({ ...DEFAULT_OPENCODE_SETTINGS, enabled: true }), undefined, async (input, init) => {
        const request = new Request(input, init);
        const target = new URL(request.url);
        return fetch(new Request(`${baseUrl}${target.pathname}`, request));
    });
    await service.connectApiKey('opencode-go', 'local-import-test-key');
    t.same(requests.map(request => ({ path: request.path, method: request.method, body: request.body })), [
        { path: '/auth/opencode-go', method: 'PUT', body: { type: 'api', key: 'local-import-test-key' } },
        { path: '/instance/dispose', method: 'POST', body: undefined },
    ]);
});

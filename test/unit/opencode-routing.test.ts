import t from 'tap';
import path from 'node:path';
import { mockRequire } from '../../node_modules/@tapjs/mock/dist/esm/mock-require.js';

t.test('selected OpenCode model routes chat, structured tasks, vision and summaries without Groq overriding it', async t => {
    const calls: any[] = [];
    const service = {
        async complete(...args: any[]) { calls.push(args); return 'OpenCode answer'; },
        async *stream(...args: any[]) { calls.push(args); yield 'OpenCode '; yield 'answer'; },
    };
    const { LLMHelper } = mockRequire(path.resolve('electron/core/LLMHelper.ts'), {
        [path.resolve('electron/services/OpenCodeManager.ts')]: { openCodeService: service },
        [path.resolve('electron/services/ModelVersionManager.ts')]: { ModelVersionManager: class { stopScheduler() {} } },
    });
    const helper = new LLMHelper();
    t.teardown(() => helper.scrubKeys());
    helper.setGroqFastTextMode(true);
    helper.groqClient = { chat: { completions: { create() { throw new Error('Groq must not override OpenCode'); } } } };
    helper.setModel('opencode:openrouter/vendor/model');
    t.equal(helper.getCurrentProvider(), 'opencode');
    t.equal(helper.getCurrentModel(), 'opencode:openrouter/vendor/model');
    t.equal(await helper.chat('Question', undefined, 'Transcript', 'Custom system'), 'OpenCode answer');
    t.equal(calls[0][0], 'opencode:openrouter/vendor/model');
    t.match(calls[0][1], /Transcript/);
    t.equal(calls[0][2], 'Custom system');
    t.equal(await helper.generateContentStructured('JSON question'), 'OpenCode answer');
    t.equal(await helper.generateMeetingSummary('Summary system', 'Meeting transcript'), 'OpenCode answer');
    t.equal(await helper.generateWithVisionFallback('Vision system', 'Read screenshot'), 'OpenCode answer');
    t.equal(await helper.chatWithGemini('Legacy chat', undefined, 'Transcript'), 'OpenCode answer');
    helper.setModel('gpt-5.4');
    t.equal(helper.activeOpenCodeModel, null, 'switching to cloud clears OpenCode routing');
    helper.setModel('opencode:openrouter/vendor/model');
    helper.setModel('ollama-qwen');
    t.equal(helper.activeOpenCodeModel, null, 'switching to Ollama clears OpenCode routing');
    t.throws(() => helper.setModel('opencode:invalid'));
});

t.test('OpenCode IPC hides passwords, persists validated settings and exposes discovery errors', async t => {
    const handlers = new Map<string, (...args: any[]) => any>();
    let settings = { enabled: true, baseUrl: 'http://localhost:4096', username: 'opencode', password: 'stored-secret' };
    let changes = 0;
    let stops = 0;
    let fail = false;
    const imported: string[][] = [];
    const { registerModelDiscoveryHandlers } = mockRequire(path.resolve('electron/ipc/model-discovery.ts'), {
        [path.resolve('electron/main.ts')]: {},
        [path.resolve('electron/ipc/safeHandle.ts')]: {
            safeHandle: (name: string, handler: any) => handlers.set(name, handler),
            broadcastOpenAICompatibleProvidersChanged: () => { changes++; },
        },
        [path.resolve('electron/services/CredentialsManager.ts')]: { CredentialsManager: { getInstance: () => ({
            getOpenCodeSettings: () => settings,
            getOpenAICompatibleProviders: () => [{ baseUrl: 'https://opencode.ai/zen/go/v1/', apiKey: 'saved-go-key' }],
            setOpenCodeSettings: (value: typeof settings) => { settings = value; },
        }) } },
        [path.resolve('electron/services/OpenCodeManager.ts')]: {
            stopOpenCode: () => { stops++; },
            openCodeService: {
                models: async () => { if (fail) throw new Error('Server unavailable'); return [{ id: 'opencode:test/model' }]; },
                connectApiKey: async (...args: string[]) => { imported.push(args); },
            },
        },
    });
    registerModelDiscoveryHandlers({});
    const invoke = (name: string, ...args: any[]) => handlers.get(name)!(null, ...args);
    t.match(invoke('get-opencode-settings'), { enabled: true, baseUrl: 'http://localhost:4096', username: 'opencode', hasPassword: true, canImport: true, hasApiKey: true, providerID: 'opencode-go', subscriptionUrl: 'https://opencode.ai/go' });
    t.same(await invoke('save-opencode-settings', { ...settings, baseUrl: 'file:///bad' }), { success: false, error: 'Use an HTTP(S) server URL without credentials, query or fragment' });
    t.equal(stops, 0, 'invalid settings do not stop the running server');
    t.same(await invoke('save-opencode-settings', { enabled: true, baseUrl: 'http://localhost:4096/', username: 'opencode' }), { success: true });
    t.equal(settings.password, 'stored-secret', 'an omitted password retains saved credentials');
    t.equal(settings.baseUrl, 'http://localhost:4096');
    t.equal(changes, 1);
    t.same(await invoke('get-opencode-models'), { success: true, models: [{ id: 'opencode:test/model' }] });
    fail = true;
    t.same(await invoke('get-opencode-models'), { success: false, models: [], error: 'Server unavailable' });
    settings.enabled = false;
    t.same(await invoke('get-opencode-models'), { success: true, models: [] });
    t.same(await invoke('import-opencode-connection'), { success: false, error: 'Saved keys can only be imported into local OpenCode' });
    settings.baseUrl = 'http://127.0.0.1:4096';
    t.same(await invoke('import-opencode-connection'), { success: true });
    t.same(imported, [['opencode-go', 'saved-go-key']]);
    t.equal(settings.enabled, true, 'import enables the local integration');
});

t.test('saved Go token connects automatically once, and token edits keep the existing account', async t => {
    const handlers = new Map<string, (...args: any[]) => any>();
    let settings = { enabled: false, baseUrl: 'http://127.0.0.1:4096', username: 'opencode', password: '' };
    let providers = [{ id: 'existing-go', name: 'My OpenCode', baseUrl: 'https://opencode.ai/zen/go/v1/', apiKey: 'saved-go-key', preferredModel: 'deepseek-v4-flash' }];
    const imported: string[][] = [];
    const { registerModelDiscoveryHandlers } = mockRequire(path.resolve('electron/ipc/model-discovery.ts'), {
        [path.resolve('electron/main.ts')]: {},
        [path.resolve('electron/ipc/safeHandle.ts')]: { safeHandle: (name: string, handler: any) => handlers.set(name, handler), broadcastOpenAICompatibleProvidersChanged() {} },
        [path.resolve('electron/services/CredentialsManager.ts')]: { CredentialsManager: { getInstance: () => ({
            getOpenCodeSettings: () => settings,
            getOpenAICompatibleProviders: () => providers,
            setOpenCodeSettings: (value: typeof settings) => { settings = value; },
            saveOpenAICompatibleProvider: (value: typeof providers[number]) => { providers = [value]; },
        }) } },
        [path.resolve('electron/services/OpenCodeManager.ts')]: { stopOpenCode() {}, openCodeService: {
            models: async () => [{ id: 'opencode:opencode-go/deepseek-v4-flash' }],
            connectApiKey: async (...args: string[]) => { imported.push(args); },
        } },
    });
    registerModelDiscoveryHandlers({});
    const invoke = (name: string, ...args: any[]) => handlers.get(name)!(null, ...args);
    const status = invoke('get-opencode-settings');
    t.equal(status.hasApiKey, true, 'saved token is detected before local server is enabled');
    t.notOk('apiKey' in status || 'password' in status, 'credentials are not returned to the renderer');
    await Promise.all([invoke('get-opencode-models'), invoke('get-opencode-models')]);
    t.same(imported, [['opencode-go', 'saved-go-key']], 'concurrent selectors share one SDK connection');
    t.equal(settings.enabled, true);
    await invoke('get-opencode-models');
    t.equal(imported.length, 1, 'refresh does not repeatedly reset the OpenCode instance');
    t.same(await invoke('save-opencode-api-key', '  replacement-token  '), { success: true });
    t.same(imported[1], ['opencode-go', 'replacement-token']);
    t.equal(providers[0].id, 'existing-go');
    t.equal(providers[0].preferredModel, 'deepseek-v4-flash');
    t.equal(providers[0].apiKey, 'replacement-token');
    t.match(await invoke('save-opencode-api-key', ''), { success: false });
    t.match(await invoke('save-opencode-api-key', null), { success: false });
    t.equal(providers[0].apiKey, 'replacement-token', 'invalid input never replaces the saved token');
});

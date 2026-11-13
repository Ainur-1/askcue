import t from 'tap';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { mockRequire } from '../../node_modules/@tapjs/mock/dist/esm/mock-require.js';
import { traceAIAction, getAIActionIssue, recordAIEvent, type DiagnosticRecord } from '../../electron/lib/aiDiagnostics';

t.test('real action IPC correlates provider failure, context health and UI reason without inventing an answer', async t => {
    const handlers = new Map<string, (...args: any[]) => any>();
    const records: DiagnosticRecord[] = [];
    let scenario = 'error';
    const manager = Object.assign(new EventEmitter(), {
        getFormattedContext: () => 'Private transcript', getContext: () => [{ role: 'interviewer', timestamp: Date.now() }],
        getSessionStartTime: () => 123,
        runWhatShouldISay: async () => {
            if (scenario === 'error') manager.emit('error', new Error('This API key has expired'), 'what_to_say');
            else recordAIEvent('action.skipped', { reason: scenario });
            return null;
        },
    });
    const { registerIntelligenceHandlers } = mockRequire(path.resolve('electron/ipc/intelligence.ts'), {
        electron: { BrowserWindow: {}, dialog: {}, shell: {} },
        [path.resolve('electron/main.ts')]: {},
        [path.resolve('electron/ipc/safeHandle.ts')]: { safeHandle: (channel: string, callback: any) => handlers.set(channel, callback) },
        [path.resolve('electron/lib/aiDiagnostics.ts')]: {
            traceAIAction: (options: any, execute: any) => traceAIAction({ ...options, sink: record => records.push(record) }, execute),
            getAIActionIssue, recordAIEvent,
        },
    });
    registerIntelligenceHandlers({
        getIntelligenceManager: () => manager,
        getNativeAudioStatus: () => ({ hasRecentInterviewerTranscript: false, hasRecentSystemAudioChunk: true, lastInterviewerTranscriptAt: 456 }),
        processingHelper: { getLLMHelper: () => ({ getCurrentModel: () => 'opencode:opencode-go/test' }) },
    });
    const result = await handlers.get('generate-what-to-say')!(null);
    t.match(result, { answer: null, reason: 'api_key_expired' });
    t.match(records[0], { contextChars: 18, interviewerTurns: 1, hasRecentInterviewerTranscript: false, model: 'opencode:opencode-go/test' });
    t.match(records.at(-1), { outcome: 'error', outputChars: 0, errorCode: 'api_key_expired' });
    t.notMatch(JSON.stringify(records), /Private transcript/);
    scenario = 'cooldown';
    t.match(await handlers.get('generate-what-to-say')!(null), { answer: null, reason: 'cooldown' });
    scenario = 'no_context';
    t.match(await handlers.get('generate-what-to-say')!(null), { answer: null, reason: 'no_context' });
    t.equal(manager.listenerCount('error'), 0);
});

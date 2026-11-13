import t from 'tap';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { traceAIAction, recordAIEvent, getAIActionIssue, appendDiagnosticRecord, type DiagnosticRecord } from '../../electron/lib/aiDiagnostics';
import { formatLogArguments, redactLogText } from '../../electron/lib/logRedaction';
import { aiActionErrorMessage } from '../../src/lib/aiActionErrors';

t.test('parallel actions have separate IDs, first-token timing and metadata without response content', async t => {
    const emitter = new EventEmitter();
    const records: DiagnosticRecord[] = [];
    const run = (action: string, delay: number) => traceAIAction({ action, emitter, metadata: { model: 'opencode:test/model', contextChars: 42 }, sink: record => records.push(record) }, async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        recordAIEvent('llm.request', { messageChars: 123 });
        emitter.emit('suggested_answer_token', 'private response');
        emitter.emit('suggested_answer_token', 'continued');
        return { answer: 'private response continued' };
    });
    await Promise.all([run('what_to_say', 5), run('recap', 10)]);
    t.equal(new Set(records.map(record => record.requestId)).size, 2);
    for (const action of ['what_to_say', 'recap']) {
        const group = records.filter(record => record.action === action);
        t.equal(group.filter(record => record.event === 'response.first_token').length, 1);
        t.match(group.find(record => record.event === 'action.finished'), { outcome: 'completed', chunks: 2, outputChars: 26 });
    }
    t.notMatch(JSON.stringify(records), /private response|continued/);
    t.equal(emitter.listenerCount('error'), 0);
    t.equal(emitter.listenerCount('suggested_answer_token'), 0);
});

t.test('engine-emitted failures are recorded as errors even when the handler returns null', async t => {
    const emitter = new EventEmitter();
    const records: DiagnosticRecord[] = [];
    await traceAIAction({ action: 'brainstorm', emitter, metadata: {}, sink: record => records.push(record) }, async () => {
        emitter.emit('error', new Error('This API key has expired'), 'brainstorm');
        t.equal(getAIActionIssue(), 'api_key_expired');
        return { answer: null, question: 'must not count as output' };
    });
    t.match(records.at(-1), { event: 'action.finished', outcome: 'error', errorCode: 'api_key_expired', outputChars: 0 });
    t.match(aiActionErrorMessage('This API key has expired', 'ru'), /токена истёк/);
    t.match(aiActionErrorMessage('HTTP 429 quota exceeded', 'ru'), /лимит/);
});

t.test('cooldown is visible, transport rejections propagate, and unavailable logging cannot break requests', async t => {
    const emitter = new EventEmitter();
    const records: DiagnosticRecord[] = [];
    await traceAIAction({ action: 'what_to_say', emitter, metadata: {}, sink: record => records.push(record) }, async () => {
        recordAIEvent('action.skipped', { reason: 'cooldown', retryAfterMs: 1200 });
        return { answer: null, question: 'inferred' };
    });
    t.match(records.at(-1), { outcome: 'skipped', reason: 'cooldown', outputChars: 0 });
    await t.rejects(traceAIAction({ action: 'recap', emitter, metadata: {}, sink: record => records.push(record) }, async () => { throw new Error('HTTP 429'); }), /429/);
    t.match(records.at(-1), { outcome: 'error', errorCode: 'rate_limited' });
    t.equal(await traceAIAction({ action: 'recap', emitter, metadata: {}, sink: () => { throw new Error('disk full'); } }, async () => 'answer'), 'answer');
});

t.test('diagnostic files rotate and retain only three previous files', t => {
    const directory = t.testdir({});
    const file = path.join(directory, 'ai-actions.jsonl');
    for (let index = 0; index < 5; index++) appendDiagnosticRecord(file, { timestamp: 'now', requestId: String(index), action: 'recap', event: 'action.started' }, 1);
    t.same(fs.readdirSync(directory).sort(), ['ai-actions.jsonl', 'ai-actions.jsonl.1', 'ai-actions.jsonl.2', 'ai-actions.jsonl.3']);
    t.equal(JSON.parse(fs.readFileSync(file, 'utf8')).requestId, '4');
    t.equal(JSON.parse(fs.readFileSync(file + '.3', 'utf8')).requestId, '1');
    t.end();
});

t.test('console and file formatting redact nested credentials, quoted passwords and circular objects', t => {
    const input: any = { openaiKey: 'plain-secret', nested: { apiKey: 'other-secret', authorization: 'Bearer raw-secret' }, token: 'opaque-token', chunks: 5 };
    input.circular = input;
    const formatted = formatLogArguments([input, new Error('password="contains spaces" Bearer abcdefg sk-testsecret0123456789')]);
    t.notMatch(formatted, /plain-secret|other-secret|raw-secret|opaque-token|contains spaces|abcdefg|sk-testsecret0123456789/);
    t.match(formatted, /REDACTED/);
    t.match(formatted, /Circular/);
    t.match(formatted, /"chunks":5/);
    t.equal(redactLogText('API key has expired'), 'API key has expired', 'useful error descriptions survive');
    t.end();
});

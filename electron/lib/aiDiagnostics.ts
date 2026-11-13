import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { redactLogText } from './logRedaction';

type Fields = Record<string, string | number | boolean | null | undefined>;
export type DiagnosticRecord = Fields & { timestamp: string; requestId: string; action: string; event: string };
type Sink = (record: DiagnosticRecord) => void;
const storage = new AsyncLocalStorage<{ requestId: string; action: string; write: (event: string, fields?: Fields) => void; skipReason?: string; issue?: string }>();

export function aiErrorCode(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/key.*expired|expired.*key/i.test(message)) return 'api_key_expired';
    if (/429|rate.limit|too many requests|quota/i.test(message)) return 'rate_limited';
    if (/401|403|unauthorized|authentication|invalid.*key/i.test(message)) return 'authentication';
    if (/timeout|timed out/i.test(message)) return 'timeout';
    if (/abort|cancel/i.test(message)) return 'cancelled';
    if (/fetch failed|network|ECONN|ENOTFOUND/i.test(message)) return 'network';
    return 'provider_error';
}

export function getAIActionId(): string | undefined { return storage.getStore()?.requestId; }
export function getAIActionIssue(): string | undefined { return storage.getStore()?.issue; }
export function recordAIEvent(event: string, fields: Fields = {}): void {
    const current = storage.getStore();
    if (event === 'action.skipped' && current) { current.skipReason = String(fields.reason); current.issue = current.skipReason; }
    current?.write(event, fields);
}

export function getAIDiagnosticsDirectory(): string {
    // Lazy Electron access keeps import safe before app.ready and makes the tracer testable in Node.
    return path.join(require('electron').app.getPath('userData'), 'logs');
}

export function appendDiagnosticRecord(file: string, record: DiagnosticRecord, maxBytes = 5 * 1024 * 1024): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size >= maxBytes) {
        for (let index = 3; index >= 1; index--) {
            const source = index === 1 ? file : `${file}.${index - 1}`;
            const target = `${file}.${index}`;
            if (fs.existsSync(target)) fs.unlinkSync(target);
            if (fs.existsSync(source)) fs.renameSync(source, target);
        }
    }
    fs.appendFileSync(file, JSON.stringify(record) + '\n');
}

const defaultSink: Sink = record => appendDiagnosticRecord(path.join(getAIDiagnosticsDirectory(), 'ai-actions.jsonl'), record);

export function initializeAIDiagnostics(): void {
    try { defaultSink({ timestamp: new Date().toISOString(), requestId: randomUUID(), action: 'system', event: 'diagnostics.started', schemaVersion: 1 }); }
    catch { /* Startup must continue if the log directory is unavailable. */ }
}

/** Records metadata only: never prompts, transcripts, responses, images or credentials. */
export async function traceAIAction<T>(options: {
    action: string;
    metadata: Fields;
    emitter: EventEmitter;
    sink?: Sink;
}, execute: () => Promise<T>): Promise<T> {
    const started = Date.now();
    const requestId = randomUUID();
    const sink = options.sink || defaultSink;
    const write = (event: string, fields: Fields = {}) => {
        try { sink({ ...options.metadata, ...fields, timestamp: new Date().toISOString(), requestId, action: options.action, event }); }
        catch { /* Diagnostics must never block an AI request. */ }
    };
    return storage.run({ requestId, action: options.action, write }, async () => {
        let failure: unknown;
        let chunks = 0;
        let streamedChars = 0;
        const onToken = (token: string) => {
            if (getAIActionId() !== requestId) return;
            if (!chunks) write('response.first_token', { latencyMs: Date.now() - started });
            chunks++;
            streamedChars += typeof token === 'string' ? token.length : 0;
        };
        const onError = (error: unknown) => {
            if (getAIActionId() !== requestId) return;
            failure = error;
            storage.getStore()!.issue = aiErrorCode(error);
            write('response.error', { errorCode: aiErrorCode(error), message: redactLogText(error instanceof Error ? error.message : String(error)).slice(0, 1000) });
        };
        const tokenEvents = ['suggested_answer_token', 'refined_answer_token', 'recap_token', 'clarify_token', 'follow_up_questions_token'];
        for (const event of tokenEvents) options.emitter.on(event, onToken);
        options.emitter.on('error', onError);
        write('action.started');
        try {
            const result = await execute();
            const payload = result && typeof result === 'object'
                ? ['answer', 'insight', 'clarification', 'hint', 'script', 'refined', 'summary', 'questions']
                    .map(key => (result as Record<string, unknown>)[key]).find(value => typeof value === 'string') : result;
            const outputChars = typeof payload === 'string' ? payload.length : 0;
            const skipped = storage.getStore()?.skipReason;
            write('action.finished', {
                outcome: failure ? 'error' : skipped ? 'skipped' : outputChars ? 'completed' : 'no_response',
                reason: skipped, errorCode: failure ? aiErrorCode(failure) : undefined,
                durationMs: Date.now() - started, chunks, outputChars, streamedChars,
            });
            return result;
        } catch (error) {
            if (!failure) onError(error);
            write('action.finished', { outcome: 'error', errorCode: aiErrorCode(error), durationMs: Date.now() - started, chunks, streamedChars });
            throw error;
        } finally {
            for (const event of tokenEvents) options.emitter.removeListener(event, onToken);
            options.emitter.removeListener('error', onError);
        }
    });
}

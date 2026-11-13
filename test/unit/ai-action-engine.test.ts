import t from 'tap';
import path from 'node:path';
import { mockRequire } from '../../node_modules/@tapjs/mock/dist/esm/mock-require.js';
import { SessionTracker } from '../../electron/core/SessionTracker';
import { WhatToAnswerLLM } from '../../electron/llm/WhatToAnswerLLM';
import { AnswerLLM } from '../../electron/llm/AnswerLLM';
import { AssistLLM } from '../../electron/llm/AssistLLM';
import { ClarifyLLM } from '../../electron/llm/ClarifyLLM';
import { RecapLLM } from '../../electron/llm/RecapLLM';
import { FollowUpQuestionsLLM } from '../../electron/llm/FollowUpQuestionsLLM';
import { FollowUpLLM } from '../../electron/llm/FollowUpLLM';
import { CodeHintLLM } from '../../electron/llm/CodeHintLLM';
import { BrainstormLLM } from '../../electron/llm/BrainstormLLM';

function engineFixture(options: { fail?: boolean; empty?: boolean; context?: boolean } = {}) {
    const messages: string[] = [];
    const helper = {
        async *streamChat(message: string) {
            messages.push(message);
            if (options.fail) throw new Error('This API key has expired');
            if (!options.empty) { yield 'Готовая '; yield 'реплика.'; }
        },
    };
    const { IntelligenceEngine } = mockRequire(path.resolve('electron/core/IntelligenceEngine.ts'), {
        [path.resolve('electron/llm/index.ts')]: {
            WhatToAnswerLLM, AnswerLLM, AssistLLM, ClarifyLLM, RecapLLM, FollowUpQuestionsLLM, FollowUpLLM, CodeHintLLM, BrainstormLLM,
            prepareTranscriptForWhatToAnswer: (turns: any[]) => turns.map(turn => turn.text).join('\n'),
            buildTemporalContext: () => ({ previousResponses: [], toneSignals: [], hasRecentResponses: false }),
            classifyIntent: async () => ({ intent: 'explanation', answerShape: 'short' }),
        },
    });
    const session = new SessionTracker();
    if (options.context !== false) session.handleTranscript({ speaker: 'interviewer', text: 'Как ограничить запросы к API?', timestamp: Date.now(), final: true });
    const engine = new IntelligenceEngine(helper, session);
    const errors: { message: string; mode: string }[] = [];
    const answers: string[] = [];
    engine.on('error', (error: Error, mode: string) => errors.push({ message: error.message, mode }));
    for (const event of ['suggested_answer', 'clarify', 'recap', 'follow_up_questions_update', 'manual_answer_result', 'refined_answer']) engine.on(event, (answer: string) => answers.push(answer));
    return { engine, session, errors, answers, messages };
}

t.test('all quick-action modes expose expired-token errors and never save canned successful answers', async t => {
    for (const [method, mode] of [
        ['runWhatShouldISay', 'what_to_say'], ['runClarify', 'clarify'], ['runRecap', 'recap'],
        ['runFollowUpQuestions', 'follow_up_questions'], ['runBrainstorm', 'brainstorm'],
        ['runCodeHint', 'code_hint'], ['runManualAnswer', 'manual'], ['runFollowUp', 'follow_up'],
    ]) {
        const fixture = engineFixture({ fail: true });
        if (mode === 'follow_up') fixture.session.addAssistantMessage('Previous answer');
        const result = mode === 'code_hint' || mode === 'brainstorm'
            ? await fixture.engine[method](undefined, 'question') : await fixture.engine[method]('question');
        t.equal(result, null, mode);
        t.same(fixture.errors, [{ message: 'This API key has expired', mode }]);
        t.same(fixture.answers, [], 'no fake answer is emitted');
        t.same(fixture.session.getFullUsage(), [], 'failed generation is not persisted as a successful interaction');
        t.equal(fixture.engine.getActiveMode(), 'idle');
    }
});

t.test('successful suggestions stream, save exactly one result and honor explicit questions', async t => {
    const fixture = engineFixture();
    t.equal(await fixture.engine.runWhatShouldISay('Explain Redis atomic counters'), 'Готовая реплика.');
    t.match(fixture.messages[0], /Explain Redis atomic counters/);
    t.match(fixture.messages[0], /Как ограничить запросы/);
    t.equal(fixture.session.getFullUsage().length, 1);
    t.same(fixture.answers, ['Готовая реплика.']);
    t.equal(await fixture.engine.runWhatShouldISay(), null, 'cooldown does not issue a second request');
    t.equal(fixture.messages.length, 1);
});

t.test('missing context and empty provider responses are distinguishable and never create fake history', async t => {
    const missing = engineFixture({ context: false });
    t.equal(await missing.engine.runWhatShouldISay(), null);
    t.equal(missing.messages.length, 0, 'no paid request without context or explicit question');
    const empty = engineFixture({ empty: true });
    t.equal(await empty.engine.runWhatShouldISay(), null);
    t.match(empty.errors[0].message, /empty response/);
    t.same(empty.session.getFullUsage(), []);
});

import t from 'tap';
import { firstResponseToken, finishResponseTiming, formatResponseDuration, responseElapsedMs, resumeResponseTiming, startResponseTiming } from '../../src/lib/responseTiming';

t.test('timer separates wait time from streaming and freezes on the final response', t => {
    const waiting = startResponseTiming(100, 1);
    t.equal(waiting.status, 'waiting');
    t.equal(responseElapsedMs(waiting, 2600), 2500);
    const streaming = firstResponseToken(waiting, 900)!;
    t.match(streaming, { firstTokenAt: 900, status: 'streaming' });
    t.equal(firstResponseToken(streaming, 1400), streaming, 'later tokens do not overwrite first-token latency');
    const completed = finishResponseTiming(streaming, 5100, 'completed')!;
    t.equal(responseElapsedMs(completed, 999999), 5000, 'completed timer cannot drift');
    t.equal(firstResponseToken(completed, 7000), completed, 'late chunks cannot restart a stopped timer');
    t.equal(finishResponseTiming(completed, 8000, 'error'), completed, 'late events cannot change a terminal result');
    t.end();
});

t.test('errors, cancellation and skipped requests stop the timer; another request starts fresh', t => {
    for (const status of ['error', 'cancelled', 'skipped'] as const) {
        const stopped = finishResponseTiming(startResponseTiming(50, 1), 450, status)!;
        t.equal(stopped.status, status);
        t.equal(responseElapsedMs(stopped, 10000), 400);
    }
    const next = startResponseTiming(10000, 2);
    t.match(next, { id: 2, status: 'waiting', firstTokenAt: null, finishedAt: null });
    t.equal(responseElapsedMs(next, 10020), 20);
    t.equal(responseElapsedMs(next, 9000), 0);
    t.equal(finishResponseTiming(null, 0, 'cancelled'), null);
    t.end();
});

t.test('durations format cleanly across minute boundaries and both interface languages', t => {
    t.equal(formatResponseDuration(1250, 'ru'), '1,2');
    t.equal(formatResponseDuration(1250, 'en'), '1.2');
    t.equal(formatResponseDuration(59999, 'ru'), '59,9');
    t.equal(formatResponseDuration(60000, 'ru'), '1:00,0');
    t.equal(formatResponseDuration(62300, 'en'), '1:02.3');
    t.equal(formatResponseDuration(-100, 'ru'), '0,0');
    t.end();
});

t.test('direct-chat fallback preserves overall wait time and cannot revive cancellation', t => {
    const request = startResponseTiming(100, 1);
    const failedContext = finishResponseTiming(request, 800, 'error')!;
    const fallback = resumeResponseTiming(failedContext)!;
    t.match(fallback, { startedAt: 100, finishedAt: null, firstTokenAt: null, status: 'waiting' });
    t.equal(responseElapsedMs(fallback, 1000), 900);
    const cancelled = finishResponseTiming(request, 500, 'cancelled')!;
    t.equal(resumeResponseTiming(cancelled), cancelled);
    t.equal(resumeResponseTiming(null), null);
    t.end();
});

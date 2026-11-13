export type ResponseTimingStatus = 'waiting' | 'streaming' | 'completed' | 'error' | 'cancelled' | 'skipped';
export interface ResponseTiming {
    id: number;
    startedAt: number;
    firstTokenAt: number | null;
    finishedAt: number | null;
    status: ResponseTimingStatus;
}

export function startResponseTiming(now: number, id: number): ResponseTiming {
    return { id, startedAt: now, firstTokenAt: null, finishedAt: null, status: 'waiting' };
}

export function firstResponseToken(timing: ResponseTiming | null, now: number): ResponseTiming | null {
    if (!timing || timing.status !== 'waiting') return timing;
    return { ...timing, firstTokenAt: Math.max(now, timing.startedAt), status: 'streaming' };
}

export function finishResponseTiming(timing: ResponseTiming | null, now: number, status: Exclude<ResponseTimingStatus, 'waiting' | 'streaming'>): ResponseTiming | null {
    if (!timing || timing.finishedAt !== null) return timing;
    return { ...timing, finishedAt: Math.max(now, timing.firstTokenAt ?? timing.startedAt), status };
}

export function responseElapsedMs(timing: ResponseTiming, now: number): number {
    return Math.max(0, (timing.finishedAt ?? now) - timing.startedAt);
}

/** An internal RAG failure can fall back to direct chat within the same user request. */
export function resumeResponseTiming(timing: ResponseTiming | null): ResponseTiming | null {
    if (!timing || timing.status !== 'error') return timing;
    return { ...timing, firstTokenAt: null, finishedAt: null, status: 'waiting' };
}

export function formatResponseDuration(milliseconds: number, language: string): string {
    const tenths = Math.floor(Math.max(0, milliseconds) / 100);
    const seconds = tenths / 10;
    if (seconds < 60) return seconds.toFixed(1).replace('.', language === 'ru' ? ',' : '.');
    const remainder = (seconds % 60).toFixed(1).padStart(4, '0').replace('.', language === 'ru' ? ',' : '.');
    return `${Math.floor(seconds / 60)}:${remainder}`;
}

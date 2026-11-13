import { useCallback, useRef, useState } from 'react';
import { firstResponseToken, finishResponseTiming, resumeResponseTiming, startResponseTiming, type ResponseTiming, type ResponseTimingStatus } from '../lib/responseTiming';

export function useResponseTimer() {
    const [timing, setTiming] = useState<ResponseTiming | null>(null);
    const current = useRef<ResponseTiming | null>(null);
    const sequence = useRef(0);
    const update = useCallback((value: ResponseTiming | null) => {
        if (value === current.current) return;
        current.current = value;
        setTiming(value);
    }, []);
    const start = useCallback(() => update(startResponseTiming(performance.now(), ++sequence.current)), [update]);
    const ensureStarted = useCallback(() => {
        if (!current.current || current.current.finishedAt !== null) start();
    }, [start]);
    const firstToken = useCallback(() => update(firstResponseToken(current.current, performance.now())), [update]);
    const finish = useCallback((status: Exclude<ResponseTimingStatus, 'waiting' | 'streaming'> = 'completed') => {
        update(finishResponseTiming(current.current, performance.now(), status));
    }, [update]);
    const reset = useCallback(() => update(null), [update]);
    const resume = useCallback(() => {
        update(resumeResponseTiming(current.current));
        return current.current !== null && current.current.finishedAt === null;
    }, [update]);
    return { timing, start, ensureStarted, firstToken, finish, reset, resume };
}

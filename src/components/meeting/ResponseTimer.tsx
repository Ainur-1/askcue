import { useEffect, useState } from 'react';
import { Check, CircleAlert, Timer, X } from 'lucide-react';
import { t, useInterfaceLanguage } from '../../i18n';
import { formatResponseDuration, responseElapsedMs, type ResponseTiming } from '../../lib/responseTiming';

export function ResponseTimer({ timing }: { timing: ResponseTiming | null }) {
    const { language } = useInterfaceLanguage();
    const [now, setNow] = useState(() => performance.now());
    const running = timing !== null && timing.finishedAt === null;
    useEffect(() => {
        if (!running) return;
        setNow(performance.now());
        const interval = window.setInterval(() => setNow(performance.now()), 100);
        return () => window.clearInterval(interval);
    }, [running, timing?.id]);
    if (!timing) return null;
    const elapsed = responseElapsedMs(timing, now);
    const labels = {
        waiting: 'Waiting for the model', streaming: 'Model is responding', completed: 'Response complete',
        error: 'Request failed', cancelled: 'Response stopped', skipped: 'Request skipped',
    };
    const Icon = timing.status === 'completed' ? Check : timing.status === 'error' ? CircleAlert : timing.status === 'cancelled' ? X : Timer;
    return (
        <div className="response-timer" data-testid="response-timer" data-status={timing.status} data-elapsed-ms={Math.floor(elapsed)} title={t('Time from sending the question until the response finishes, including context preparation.')}>
            <span className="response-timer-icon"><Icon size={15} aria-hidden="true" /></span>
            <div className="response-timer-details">
                <span className="response-timer-label" aria-live="polite">{t(labels[timing.status])}</span>
                {timing.firstTokenAt !== null && <span className="response-timer-first-token">{t('First text')}: {formatResponseDuration(timing.firstTokenAt - timing.startedAt, language)} {t('sec')}</span>}
            </div>
            <time className="response-timer-value" role="timer" aria-live="off" dateTime={`PT${(elapsed / 1000).toFixed(1)}S`}>
                {formatResponseDuration(elapsed, language)}<span>{elapsed < 60000 ? t('sec') : t('min:sec')}</span>
            </time>
        </div>
    );
}

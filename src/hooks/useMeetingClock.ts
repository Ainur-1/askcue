import { useEffect, useState } from 'react';
import { formatMeetingDuration } from '../lib/meetingDuration';

export function useMeetingClock() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const update = (state: { isActive: boolean; startedAt?: number | null }) => {
      if (!mounted) return;
      setStartedAt(state.isActive ? state.startedAt ?? null : null);
      setNow(Date.now());
    };
    const remove = window.electronAPI.onMeetingStateChanged(state => { revision++; update(state); });
    window.electronAPI.getMeetingState().then(state => { if (revision === 0) update(state); }).catch(console.error);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted = false; remove?.(); window.clearInterval(timer); };
  }, []);
  return formatMeetingDuration(startedAt, now);
}

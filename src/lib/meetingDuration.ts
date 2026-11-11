export function formatMeetingDuration(startedAt: number | null, now: number): string {
  const seconds = startedAt === null || !Number.isFinite(startedAt) || !Number.isFinite(now)
    ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

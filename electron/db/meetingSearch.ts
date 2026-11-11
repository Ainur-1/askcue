export interface MeetingSearchHit { id: string; title: string; date: string; snippet: string }

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function searchSnippet(text: string, query: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const index = normalizeSearchText(clean).indexOf(normalizeSearchText(query));
  const start = Math.max(0, index - 45);
  const snippet = clean.slice(start, start + 180);
  return `${start ? '…' : ''}${snippet}${start + 180 < clean.length ? '…' : ''}`;
}

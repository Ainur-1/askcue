import { t } from '../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, Sparkles, FileText, X, Loader2 } from 'lucide-react';

type SearchHit = { id: string; title: string; date: string; snippet: string };
interface TopSearchPillProps {
  meetings: Array<{id:string;title:string;date:string;summary?:string}>;
  onAIQuery: (query: string) => void;
  onOpenMeeting: (id: string) => void;
}

export default function TopSearchPill({ meetings, onAIQuery, onOpenMeeting }: TopSearchPillProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const needle = query.trim();
  const entries = needle ? results : meetings.slice(0, 8).map(meeting => ({ ...meeting, snippet: meeting.summary || '' }));

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setOpen(value => !value);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    setActive(0); setFailed(false);
    if (!open || !needle) { setResults([]); setLoading(false); setResultQuery(''); return; }
    let cancelled = false;
    setLoading(true); setResults([]);
    const timer = setTimeout(() => {
      window.electronAPI.searchMeetings(needle).then(found => {
        if (!cancelled) { setResults(found); setResultQuery(needle); setLoading(false); }
      }).catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, needle]);

  const select = (index: number) => {
    if (loading || (needle && resultQuery !== needle)) return;
    const hit = entries[index];
    if (hit) { onOpenMeeting(hit.id); setOpen(false); }
  };

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" className="header-search-button no-drag" aria-label={t('Search meetings')} title={`${t('Search meetings')} · Ctrl+K`}><Search size={14}/><span>{t('Search meetings')}</span><kbd>⌃K</kbd></button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="global-search-overlay"/>
      <Dialog.Content className="global-search-dialog" onOpenAutoFocus={event => {event.preventDefault();input.current?.focus();}}>
        <div className="flex items-center justify-between px-5 pt-4">
          <Dialog.Title className="text-base font-semibold">{t('Search meetings')}</Dialog.Title>
          <Dialog.Close asChild><button type="button" aria-label={t('Close')} className="p-2 text-text-secondary"><X size={16}/></button></Dialog.Close>
        </div>
        <Dialog.Description className="px-5 text-xs text-text-secondary mb-3">{t('Search titles, notes and transcripts.')}</Dialog.Description>
        <div className="mx-5 relative"><Search size={16} className="absolute left-3 top-3 text-text-secondary"/>
          <input ref={input} aria-label={t('Search meetings')} role="combobox" aria-expanded={entries.length > 0} aria-controls={listId}
            aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined} autoComplete="off" maxLength={200}
            value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search saved conversations…')}
            className="w-full border border-border-muted bg-bg-input text-text-primary py-2 pl-10 pr-3 outline-none focus:border-accent-primary text-sm"
            onKeyDown={event => {
              if (event.key === 'ArrowDown') { event.preventDefault();setActive(value => Math.min(entries.length - 1, value + 1)); }
              else if (event.key === 'ArrowUp') {event.preventDefault();setActive(value => Math.max(0,value - 1));}
              else if (event.key === 'Enter') {event.preventDefault();select(Math.max(0,active));}
            }}/>
        </div>
        <div id={listId} role="listbox" aria-label={t('Meetings')} className="global-search-results mt-3 px-3">
          {loading ? <p role="status" className="flex gap-2 items-center text-xs text-text-secondary p-4"><Loader2 size={14} className="animate-spin"/>{t('Searching…')}</p>
            : failed ? <p role="alert" className="p-4 text-sm text-state-danger">{t('Search failed. Try again.')}</p>
            : entries.length ? entries.map((hit,index) => <button key={hit.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={active===index}
                className={`global-search-result ${active===index ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => select(index)}>
                <FileText size={16} className="shrink-0 text-accent-primary"/>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{hit.title}</strong><span className="block truncate text-xs text-text-secondary mt-1">{hit.snippet}</span></span>
              </button>)
            : <p className="p-4 text-sm text-text-secondary">{t(needle ? 'No meetings found.' : 'No saved conversations yet.')}</p>}
        </div>
        {needle && <div className="border-t border-border-subtle p-3"><button type="button" className="w-full text-left text-xs px-3 py-2 flex gap-2 items-center text-accent-primary" onClick={() => {onAIQuery(needle);setOpen(false);}}><Sparkles size={14}/>{t('Ask AI')}</button></div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

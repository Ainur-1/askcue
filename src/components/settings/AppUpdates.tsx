import { useEffect, useState } from 'react';
import { RefreshCw, Download, Check, AlertCircle } from 'lucide-react';
import { t } from '../../i18n';
import packageJson from '../../../package.json';

export default function AppUpdates() {
  const [status, setStatus] = useState<'idle'|'checking'|'available'|'downloading'|'ready'|'current'|'error'>('idle');
  const [error, setError] = useState('');
  useEffect(() => {
    const api = window.electronAPI;
    const remove = [api.onUpdateChecking(() => setStatus('checking')),
      api.onUpdateAvailable(() => setStatus('available')),
      api.onUpdateNotAvailable(() => setStatus('current')),
      api.onUpdateDownloaded(() => setStatus('ready')),
      api.onUpdateError(message => { setError(message); setStatus('error'); })];
    return () => remove.forEach(fn => fn());
  }, []);
  const act = async () => {
    setError('');
    try {
      if (status === 'ready') await window.electronAPI.restartAndInstall();
      else if (status === 'available') { setStatus('downloading'); await window.electronAPI.downloadUpdate(); }
      else { setStatus('checking'); await window.electronAPI.checkForUpdates(); }
    } catch (failure) { setStatus('error'); setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  return <section className="app-updates border-y border-border-subtle py-6 my-2" aria-label={t('Updates')}>
    <div className="flex flex-wrap gap-4 items-center justify-between">
      <div><h4 className="text-sm font-semibold">{t('Updates')}</h4><p className="text-xs text-text-secondary mt-1">{t('Version')} {packageJson.version}</p></div>
      <button className="flex items-center gap-2 border border-border-muted px-4 py-2 text-xs" onClick={() => { void act(); }} disabled={status === 'checking' || status === 'downloading'}>
        {status === 'current' ? <Check size={14}/> : status === 'error' ? <AlertCircle size={14}/> : status === 'available' ? <Download size={14}/> : <RefreshCw size={14} className={status==='checking'?'animate-spin':''}/>}
        {t(status === 'checking' ? 'Checking...' : status === 'available' ? 'Update Now' : status === 'downloading' ? 'Downloading Update...' : status === 'ready' ? 'Restart & Install' : status === 'current' ? 'Up to date' : 'Check for updates')}
      </button>
    </div>
    {error && <p role="alert" className="text-xs text-state-danger mt-3 break-words">{error}</p>}
  </section>;
}

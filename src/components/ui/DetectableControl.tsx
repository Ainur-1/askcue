import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function DetectableControl() {
  const [undetectable, setUndetectable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let mounted = true;
    window.electronAPI.getUndetectable().then(value => { if (mounted) setUndetectable(value); }).catch(() => {});
    const remove = window.electronAPI.onUndetectableChanged(value => setUndetectable(value));
    return () => { mounted = false; remove?.(); };
  }, []);
  const toggle = async () => {
    if (undetectable === null || saving) return;
    setSaving(true);
    try {
      await window.electronAPI.setUndetectable(!undetectable);
      setUndetectable(await window.electronAPI.getUndetectable());
    } finally { setSaving(false); }
  };
  return <button type="button" role="switch" aria-label="Undetectable" aria-checked={undetectable === true}
    disabled={undetectable === null || saving} onClick={() => { void toggle().catch(console.error); }} className="detectable-control no-drag"
    title="Защита окна от захвата экрана. Поддержка зависит от программы демонстрации экрана.">
    {undetectable ? <EyeOff size={14} /> : <Eye size={14} />}
    <span>{undetectable === null ? 'Проверка…' : undetectable ? 'Undetectable' : 'Detectable'}</span>
    <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
  </button>;
}

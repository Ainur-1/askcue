import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';

export function SystemProxySettings() {
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let mounted = true;
        window.electronAPI.getSystemProxyEnabled().then((value) => {
            if (mounted) setEnabled(value);
        }).catch(() => { if (mounted) setMessage('Could not load network settings. Reopen Settings to retry.'); });
        return () => { mounted = false; };
    }, []);

    const toggle = async () => {
        if (enabled === null || saving) return;
        setSaving(true);
        setMessage('');
        try {
            const result = await window.electronAPI.setSystemProxyEnabled(!enabled);
            if (!result.success) throw new Error(result.error || 'Could not apply proxy settings');
            setEnabled(!enabled);
            setMessage(result.warning || 'Applied. No application restart required.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not apply proxy settings');
        } finally { setSaving(false); }
    };

    return (
        <div className="settings-behavior-row px-4 py-3">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-bg-item-surface rounded-lg border border-border-subtle flex items-center justify-center text-text-tertiary"><Globe size={20}/></div>
                    <div><h3 className="text-sm font-bold text-text-primary">{t("Use system proxy")}</h3>
                    <p className="text-xs text-text-secondary mt-0.5">{t("Use your operating system's proxy settings. Changes apply without restarting Pika.")}</p></div>
                </div>
                <button type="button" role="switch" aria-label={t("Use system proxy")}
                    aria-checked={enabled === true} disabled={enabled === null || saving} onClick={toggle}
                    className={`settings-switch shrink-0 w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 ${enabled ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}>
                    {saving ? <Loader2 size={16} className="absolute top-1 left-3.5 animate-spin text-white" />
                        : <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />}
                </button>
            </div>
            {message && <p role="status" className="text-xs text-text-secondary mt-2">{t(message)}</p>}
        </div>
    );
}

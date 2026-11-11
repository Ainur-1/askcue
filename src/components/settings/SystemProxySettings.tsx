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
        <div className="bg-bg-card rounded-xl p-5 border border-border-subtle">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Globe size={18} className="text-text-secondary" />
                        <h3 className="text-sm font-bold text-text-primary">Use system proxy</h3>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                        Use your operating system's proxy settings. When off, connect directly.
                        Changes apply immediately; active requests may be interrupted while speech reconnects.
                    </p>
                </div>
                <button type="button" role="switch" aria-label="Use system proxy"
                    aria-checked={enabled === true} disabled={enabled === null || saving}
                    onClick={toggle}
                    className={`shrink-0 w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 ${enabled ? 'bg-accent-primary' : 'bg-bg-toggle-switch border border-border-muted'}`}>
                    {saving ? <Loader2 size={16} className="absolute top-1 left-3.5 animate-spin text-white" />
                        : <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />}
                </button>
            </div>
            {message && <p role="status" className="text-xs text-text-secondary mt-2">{message}</p>}
        </div>
    );
}

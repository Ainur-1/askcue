import { useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw, Loader2, Search, X } from 'lucide-react';
import { t } from '../../i18n';
import { OPENCODE_GO_SUBSCRIPTION_URL, type OpenCodeConnectionInfo, type OpenCodeModel } from '../../../shared/opencode';

export function OpenCodeSettingsCard({ onModelsChanged }: { onModelsChanged: (models: OpenCodeModel[]) => void }) {
    const [connection, setConnection] = useState<OpenCodeConnectionInfo | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [models, setModels] = useState<OpenCodeModel[]>([]);
    const [search, setSearch] = useState('');
    const [currentModel, setCurrentModel] = useState('');

    const refresh = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await window.electronAPI.getOpenCodeModels();
            if (!result.success) throw new Error(result.error || t('Cannot load OpenCode models. Try refreshing the list.'));
            setModels(result.models);
            onModelsChanged(result.models);
        } catch (error) {
            setModels([]);
            onModelsChanged([]);
            setError(error instanceof Error ? error.message : String(error));
        } finally { setBusy(false); }
    };

    useEffect(() => {
        let cancelled = false;
        window.electronAPI.getOpenCodeSettings().then(async value => {
            if (cancelled) return;
            setConnection(value);
            if (value.hasApiKey || value.enabled) await refresh();
        }).catch(error => { if (!cancelled) setError(error.message); });
        window.electronAPI.getDefaultModel().then(value => { if (!cancelled) setCurrentModel(value.model); }).catch(() => {});
        const unsubscribe = window.electronAPI.onModelChanged(setCurrentModel);
        return () => { cancelled = true; unsubscribe?.(); };
    }, []);

    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await window.electronAPI.saveOpenCodeApiKey(apiKey);
            if (!result.success) throw new Error(result.error);
            setApiKey('');
            setConnection(await window.electronAPI.getOpenCodeSettings());
            await refresh();
        } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
        finally { setBusy(false); }
    };

    const filtered = models.filter(model => model.name.toLowerCase().includes(search.trim().toLowerCase()));
    const hasKey = connection?.hasApiKey;
    return (
        <section className="opencode-card min-w-0 space-y-4 rounded-xl border border-border-subtle bg-bg-item-surface p-5" data-testid="opencode-settings">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-text-primary">{connection?.providerID === 'opencode' ? 'OpenCode' : 'OpenCode Go'}</h3>
                    <p className="mt-1 text-xs text-text-secondary">{t('Connect with your OpenCode API token and choose a model.')}</p>
                </div>
                <button type="button" onClick={() => window.electronAPI.openExternal(connection?.subscriptionUrl || OPENCODE_GO_SUBSCRIPTION_URL)} className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent-primary">
                    {t('OpenCode Go subscription')}<ExternalLink size={12} />
                </button>
            </div>
            <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <label htmlFor="opencode-api-token" className="font-medium text-text-primary">{t('API token')}</label>
                    {hasKey && <span className="inline-flex items-center gap-1 text-state-success" role="status"><Check size={12} />{t('Saved connection detected')}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <input id="opencode-api-token" type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={hasKey ? '••••••••••••' : t('Paste your OpenCode API token')} className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-input px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary" />
                    <button type="button" disabled={busy || !apiKey.trim()} onClick={save} className="rounded-lg border border-border-subtle bg-bg-input px-4 py-2 text-xs text-text-primary hover:bg-bg-elevated disabled:opacity-50">{t('Save token')}</button>
                </div>
                <p className="mt-2 text-xs text-text-secondary">{hasKey ? t('Your saved API token is used automatically. No need to enter it again.') : t('Get an API token in the OpenCode console after subscribing to Go.')}</p>
            </div>
            <div className="opencode-model-tools">
                <label className="opencode-model-search" htmlFor="opencode-model-search">
                    <Search size={15} aria-hidden="true" /><span className="sr-only">{t('Search OpenCode models')}</span>
                    <input id="opencode-model-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search by model or provider')} />
                    {search && <button type="button" aria-label={t('Clear model search')} onClick={() => setSearch('')}><X size={13} /></button>}
                </label>
                <button type="button" disabled={busy || (!hasKey && !connection?.enabled)} onClick={refresh} className="opencode-refresh inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary hover:bg-bg-elevated disabled:opacity-50">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}{t('Refresh models')}
                </button>
            </div>
            {error && <p role="alert" className="break-words text-xs text-state-error">{error}</p>}
            {models.length > 0 && <>
                <p className="text-xs text-text-secondary">{t('Choose a model to use it as the default for chat.')}</p>
                <div className="max-h-60 space-y-1 overflow-y-auto">
                    {filtered.map(model => <button type="button" key={model.id} data-model-id={model.id} aria-pressed={currentModel === model.id} disabled={busy} onClick={async () => {
                        setBusy(true);
                        try {
                            const result = await window.electronAPI.setDefaultModel(model.id);
                            if (!result.success) throw new Error(result.error);
                            setCurrentModel(model.id);
                            setError('');
                        } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
                        finally { setBusy(false); }
                    }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-text-primary hover:bg-bg-input aria-pressed:bg-bg-input disabled:opacity-50">
                        <span className="min-w-0 flex-1"><span className="block truncate" title={model.name}>{model.name}</span>
                            {model.supportsImages && <span className="text-[10px] text-text-secondary">{t('Supports images')}</span>}
                        </span>
                        {currentModel === model.id && <Check size={14} className="shrink-0 text-accent-primary" />}
                    </button>)}
                    {!filtered.length && <p className="px-3 py-4 text-xs text-text-secondary">{t('No models found.')}</p>}
                </div>
            </>}
        </section>
    );
}

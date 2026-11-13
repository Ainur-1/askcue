import { useEffect, useState } from 'react';
import { Check, Download, ExternalLink, HardDrive, Loader2, Pause, Play, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { SPEECH_MODELS, wordErrors, type LocalSpeechState, type SpeechReply, type SpeechTestAudio, type SpeechTestReport } from '../../../shared/localSpeech';
import { t } from '../../i18n';

export const formatSpeechBytes = (bytes: number) => `${Math.round(bytes / 1_000_000 * 10) / 10} ${t('MB')}`;

export function LocalSpeechSettings({state}: {state: LocalSpeechState | null}) {
  const [view, setView] = useState<'catalog' | 'test'>('catalog');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [audio, setAudio] = useState<SpeechTestAudio | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reference, setReference] = useState('');
  const [report, setReport] = useState<SpeechTestReport | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => () => { void window.electronAPI.cancelSpeechTest(); }, []);
  useEffect(() => {
    if (!remove) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setRemove(null); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [remove]);
  const action = async (id: string, fn: () => Promise<SpeechReply>) => {
    setPending(id); setError('');
    try { const result = await fn(); if (!result.success) throw new Error(result.error || 'Operation failed'); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setPending(null); }
  };
  const installed = state?.models.filter(item => item.phase === 'installed') || [];
  const chosen = selected.filter(id => installed.some(item => item.id === id));
  const chooseAudio = async () => {
    setError('');
    try {
      const result = await window.electronAPI.chooseSpeechTestAudio();
      if (result.cancelled) return;
      if (!result.success || !result.audio) throw new Error(result.error || 'Could not open audio');
      setAudio(result.audio); setReport(null);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  };
  const test = async () => {
    setRunning(true); setReport(null); setError('');
    try {
      const result = await window.electronAPI.testSpeechModels(chosen);
      if (!result.success || !result.report) throw new Error(result.error || 'Recognition failed');
      setReport(result.report);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setRunning(false); }
  };
  return <div className="local-speech-settings" data-testid="local-speech-settings">
    <div className="speech-catalog-toolbar"><h3>{t(view === 'catalog' ? 'Models for transcription' : 'Compare recognition models')}</h3><button type="button" className="speech-text-button" onClick={() => {setView(view === 'catalog' ? 'test' : 'catalog');setError('');}}>{t(view === 'catalog' ? 'Compare models' : 'Model catalog')}</button></div>
    {error && <div className="speech-error" role="alert">{t(error)}</div>}
    {!state ? <p role="status"><Loader2 className="animate-spin" size={16}/>{t('Loading models…')}</p> : view === 'catalog' ? <>
      <div className="speech-model-list">
        {SPEECH_MODELS.map(model => {
          const status = state.models.find(item => item.id === model.id)!;
          const active = state.activeProvider === 'local' && state.activeModel === model.id;
          const progress = Math.min(100, Math.round(status.received / status.total * 100));
          return <article className="speech-model-row" key={model.id} data-speech-model={model.id}>
            <HardDrive size={19}/><div className="speech-model-info"><h4>{model.name}{active && <span className="speech-tag">{t('In use')}</span>}</h4><p>{t(model.languages === 'ru' ? 'Russian · CPU · INT8' : 'Multilingual · CPU · INT8')}</p>
              <details><summary>{t('About this model')}</summary><p>{model.license} · ONNX</p><button type="button" className="speech-text-button" onClick={() => window.electronAPI.openExternal(model.source)}>{t('Model source')}<ExternalLink size={12}/></button>{model.id === 'zipformer-ru' && <p>{t('Compact Vosk Russian model exported to ONNX. No separate Vosk engine is required.')}</p>}</details>
              {['downloading','paused','verifying'].includes(status.phase) && <div className="speech-download"><div role="progressbar" aria-label={model.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div><small>{t(status.phase === 'verifying' ? 'Verifying files…' : status.phase === 'paused' ? 'Paused' : 'Downloading…')} · {formatSpeechBytes(status.received)} / {formatSpeechBytes(status.total)}</small></div>}
              {status.error && <p className="speech-error" role="alert">{t(status.error)}</p>}
            </div>
            <span className="speech-model-size">{formatSpeechBytes(status.total)}</span>
            <div className="speech-model-actions">
              {status.phase === 'installed' ? <><button type="button" className="speech-button" disabled={active || state.busy || !!pending} onClick={() => action(model.id, () => window.electronAPI.activateSpeechModel(model.id))}>{pending === model.id ? <Loader2 size={14} className="animate-spin"/> : active ? <Check size={14}/> : null}{t(active ? 'Selected' : 'Use model')}</button><button type="button" className="speech-icon-button" aria-label={`${t('Remove')} ${model.name}`} disabled={active || state.busy || !!pending} onClick={() => setRemove(model.id)}><Trash2 size={15}/></button></>
                : status.phase === 'downloading' || status.phase === 'verifying' ? <><button type="button" className="speech-icon-button" disabled={!!pending} aria-label={`${t('Pause')} ${model.name}`} onClick={() => action(model.id, () => window.electronAPI.pauseSpeechModel(model.id))}><Pause size={15}/></button><button type="button" className="speech-icon-button" disabled={state.busy || !!pending} aria-label={`${t('Cancel download')} ${model.name}`} onClick={() => action(model.id, () => window.electronAPI.removeSpeechModel(model.id))}><X size={15}/></button></>
                : <><button type="button" className="speech-button" disabled={!!pending} onClick={() => action(model.id, () => window.electronAPI.downloadSpeechModel(model.id))}>{status.phase === 'paused' ? <Play size={14}/> : status.phase === 'error' ? <RotateCcw size={14}/> : <Download size={14}/>}{t(status.phase === 'paused' ? 'Resume' : status.phase === 'error' ? 'Retry' : 'Download')}</button>{status.received > 0 && <button type="button" className="speech-icon-button" disabled={state.busy || !!pending} aria-label={`${t('Cancel download')} ${model.name}`} onClick={() => action(model.id, () => window.electronAPI.removeSpeechModel(model.id))}><X size={15}/></button>}</>}
            </div>
          </article>;
        })}
      </div>
      <p className="speech-storage"><HardDrive size={14}/>{t('Downloaded')}: {formatSpeechBytes(installed.reduce((sum,item) => sum + item.total,0))}<span>·</span>{t('Sizes are model files, not RAM or the recognition engine.')}</p>
    </> : <div className="speech-test-panel">
      <div className="speech-test-audio"><div><strong>{audio?.name || t('Choose a recording')}</strong><p>{audio ? `${Math.round(audio.seconds * 10)/10} ${t('sec')}` : t('WAV · PCM16 / float32 · up to 2 minutes')}</p></div><button type="button" className="speech-button" disabled={state.busy} onClick={chooseAudio}><Upload size={14}/>{t('Choose WAV')}</button></div>
      <p className="speech-note">{t('The recording stays on your computer. Each selected model processes the same audio.')}</p>
      <fieldset className="speech-model-checks"><legend>{t('Models to compare')}</legend>{SPEECH_MODELS.map(model => <label key={model.id}><input type="checkbox" disabled={running || !installed.some(item => item.id === model.id)} checked={chosen.includes(model.id)} onChange={event => {setSelected(before => event.target.checked ? [...before,model.id] : before.filter(id => id !== model.id));setReport(null);}}/>{model.name}{!installed.some(item => item.id === model.id) && <small>{t('Download first')}</small>}</label>)}</fieldset>
      <details className="speech-reference"><summary>{t('Reference text for error comparison')}</summary><textarea aria-label={t('Reference transcript')} rows={4} value={reference} onChange={event => setReference(event.target.value)}/><small>{t('Enter the actual words spoken in the recording. Punctuation and case are ignored.')}</small></details>
      <div className="speech-test-run"><button type="button" className="speech-button speech-primary" disabled={state.busy || !audio || !chosen.length} onClick={test}>{running ? <Loader2 size={15} className="animate-spin"/> : <Play size={15}/>}{t(running ? 'Recognizing…' : 'Run test')}</button>{running && <button type="button" className="speech-text-button" onClick={() => window.electronAPI.cancelSpeechTest()}>{t('Cancel')}</button>}</div>
      {report && <div className="speech-results" aria-live="polite">{report.results.map(result => {
        const model = SPEECH_MODELS.find(model => model.id === result.modelId)!;
        const errors = wordErrors(reference, result.text);
        return <article className="speech-result" key={result.modelId}><h4>{model.name}</h4>{result.error ? <p className="speech-error">{t(result.error)}</p> : <><p className="speech-result-text">{result.text || t('No speech recognized')}</p><dl><div><dt>{t('Processing time')}</dt><dd>{(result.durationMs/1000).toFixed(2)} {t('sec')}</dd></div><div><dt>{t('Worker peak RAM')}</dt><dd>{formatSpeechBytes(result.peakMemoryBytes)}</dd></div><div><dt>{t('Word errors')}</dt><dd>{errors.rate === null ? '—' : `${errors.errors} / ${errors.words} (${Math.round(errors.rate*100)}%)`}</dd></div></dl><button type="button" className="speech-button" disabled={state.busy || !!pending || (state.activeProvider === 'local' && state.activeModel === result.modelId)} onClick={() => action(result.modelId, () => window.electronAPI.activateSpeechModel(result.modelId))}>{t('Use model')}</button></>}</article>;
      })}<p className="speech-note">{t('Measured on this computer. Time includes model loading; RAM is the peak of the separate recognition process. Quality depends on the recording.')}</p></div>}
    </div>}
    {remove && <div className="speech-dialog-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="speech-remove-title" className="speech-dialog"><h3 id="speech-remove-title">{t('Remove model?')}</h3><p>{SPEECH_MODELS.find(item => item.id === remove)?.name}. {t('You can download it again later.')}</p><div><button autoFocus type="button" className="speech-button" onClick={() => setRemove(null)}>{t('Cancel')}</button><button type="button" className="speech-button" onClick={() => {const id=remove;setRemove(null);void action(id, () => window.electronAPI.removeSpeechModel(id));}}>{t('Remove')}</button></div></section></div>}
  </div>;
}

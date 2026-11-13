import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AppState } from '../main';
import { getSpeechModelStore, setLocalSpeechBusy } from '../services/localSpeech';
import { SettingsManager } from '../services/SettingsManager';
import { CredentialsManager } from '../services/CredentialsManager';
import { SpeechWorker } from '../services/SpeechWorker';
import { readSpeechWave } from '../audio/localSpeechAudio';
import { RECOGNITION_LANGUAGES } from '../config/languages';
import { getSpeechModel, type LocalSpeechState, type SpeechTestResult } from '../../shared/localSpeech';
import { safeHandle } from './safeHandle';

export function registerLocalSpeechHandlers(appState: AppState): void {
  const store = getSpeechModelStore();
  let busy = false, testing = false, testEpoch = 0, worker: SpeechWorker | null = null;
  const setBusy = (value: boolean) => { busy = value; setLocalSpeechBusy(value); };
  let audio: {name: string; samples: Float32Array; sampleRate: number} | null = null;
  const state = (): LocalSpeechState => ({models: store.statuses(), activeModel: SettingsManager.getInstance().get('localSpeechModel') || null, activeProvider: CredentialsManager.getInstance().getSttProvider(), busy, systemAudioEnabled: SettingsManager.getInstance().get('systemAudioEnabled') !== false});
  const publish = () => appState.broadcast('local-speech-changed', state());
  store.on('change', publish);
  app.once('before-quit', () => { worker?.close(); void store.close(); });
  const protect = <T extends unknown[]>(fn: (...args: T) => unknown) => async (_event: unknown, ...args: T) => {
    try { return await fn(...args); } catch (error) { return {success: false, error: error instanceof Error ? error.message : String(error)}; }
  };
  safeHandle('local-speech:state', async () => state());
  safeHandle('audio:set-system-capture', protect(async (enabled: boolean) => {
    if (typeof enabled !== 'boolean') throw new Error('Invalid system-audio setting');
    if (busy) throw new Error('Wait until the current recognition operation finishes');
    const settings = SettingsManager.getInstance(), previous = settings.get('systemAudioEnabled');
    settings.set('systemAudioEnabled', enabled);
    try {
      if (appState.getMeetingState().isActive) {
        if (enabled) { appState.googleSTT?.start(); appState.systemAudioCapture?.start(); }
        else { appState.systemAudioCapture?.stop(); appState.googleSTT?.stop(); }
      }
    } catch (error) { settings.set('systemAudioEnabled', previous); throw error; }
    publish(); return {success: true};
  }));
  safeHandle('local-speech:download', protect((id: string) => { store.download(id); return {success: true}; }));
  safeHandle('local-speech:pause', protect(async (id: string) => { await store.pause(id); return {success: true}; }));
  safeHandle('local-speech:remove', protect(async (id: string) => {
    if (busy) throw new Error('Wait until the current recognition operation finishes');
    if (state().activeProvider === 'local' && state().activeModel === id) throw new Error('Choose another recognition provider before deleting the active model');
    setBusy(true); publish();
    try { await store.remove(id); return {success: true}; } finally { setBusy(false); publish(); }
  }));
  safeHandle('local-speech:activate', protect(async (id: string) => {
    if (busy) throw new Error('Wait until the current recognition operation finishes');
    setBusy(true); publish();
    const settings = SettingsManager.getInstance(), credentials = CredentialsManager.getInstance();
    const previousModel = settings.get('localSpeechModel'), previousProvider = credentials.getSttProvider();
    try {
      await store.verify(id);
      const language = credentials.getSttLanguage();
      worker = new SpeechWorker(id, store.directory(id), language === 'auto' ? '' : RECOGNITION_LANGUAGES[language]?.iso639 || '');
      // Validate native loading before switching a running meeting away from its provider.
      await worker.recognize(new Float32Array(16000), 16000);
      settings.set('localSpeechModel', id); credentials.setSttProvider('local');
      try { await appState.reconfigureSttProvider(); }
      catch (error) { settings.set('localSpeechModel', previousModel); credentials.setSttProvider(previousProvider); await appState.reconfigureSttProvider(); throw error; }
      appState.broadcast('stt-provider-changed', 'local');
      return {success: true};
    } finally { worker?.close(); worker = null; setBusy(false); publish(); }
  }));
  safeHandle('local-speech:choose-audio', protect(async () => {
    if (busy) throw new Error('Wait until the test finishes');
    const options = {properties: ['openFile'] as Array<'openFile'>, filters: [{name: 'WAV audio', extensions: ['wav']}]};
    const window = BrowserWindow.getFocusedWindow();
    const choice = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (choice.canceled || !choice.filePaths[0]) return {success: false, cancelled: true};
    const filename = choice.filePaths[0];
    if (fs.statSync(filename).size > 50 * 1024 * 1024) throw new Error('Select a WAV file smaller than 50 MB');
    const wave = readSpeechWave(await fs.promises.readFile(filename));
    audio = {...wave, name: path.basename(filename)};
    return {success: true, audio: {name: audio.name, seconds: wave.samples.length / wave.sampleRate}};
  }));
  safeHandle('local-speech:test', protect(async (ids: string[]) => {
    if (busy) throw new Error('A recognition operation is already running');
    if (!audio) throw new Error('Select a WAV recording first');
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error('Select one to four installed models');
    for (const id of ids) { getSpeechModel(id); if (!store.isInstalled(id)) throw new Error('Download the selected models first'); }
    setBusy(true); testing = true; const epoch = ++testEpoch, clip = audio; publish();
    try {
      const results: SpeechTestResult[] = [];
      const language = CredentialsManager.getInstance().getSttLanguage();
      for (const id of ids) {
        if (epoch !== testEpoch) throw new Error('Recognition test cancelled');
        await store.verify(id);
        if (epoch !== testEpoch) throw new Error('Recognition test cancelled');
        worker = new SpeechWorker(id, store.directory(id), language === 'auto' ? '' : RECOGNITION_LANGUAGES[language]?.iso639 || '');
        try { results.push(await worker.recognize(clip.samples, clip.sampleRate)); }
        catch (error) { if (epoch !== testEpoch) throw error; results.push({modelId:id, text:'', durationMs:0, audioSeconds:clip.samples.length/clip.sampleRate, peakMemoryBytes:0, error: error instanceof Error ? error.message : String(error)}); }
        finally { worker.close(); worker = null; }
      }
      if (epoch !== testEpoch) throw new Error('Recognition test cancelled');
      return {success: true, report: {results, audio: {name: clip.name, seconds: clip.samples.length / clip.sampleRate}}};
    } finally { testing = false; setBusy(false); publish(); }
  }));
  safeHandle('local-speech:cancel-test', async () => { if (testing) { ++testEpoch; worker?.close(); } return {success: true}; });
}

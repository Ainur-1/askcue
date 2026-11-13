import { app, net } from 'electron';
import path from 'node:path';
import { SpeechModelStore } from './SpeechModelStore';
let store: SpeechModelStore | undefined;
let operationBusy = false;
export function isLocalSpeechBusy(): boolean { return operationBusy; }
export function setLocalSpeechBusy(value: boolean): void { operationBusy = value; }
export function getSpeechModelStore(): SpeechModelStore {
  // Electron's default session honors AskCue's system-proxy setting, including PAC.
  return store ||= new SpeechModelStore(path.join(app.getPath('userData'), 'local-speech'), net.fetch.bind(net) as typeof fetch);
}

import path from 'node:path';
import { microphoneLevel } from './microphoneLevel';

// Driver/native failures must never take down the Electron browser process.
const channel = process.parentPort;
const [appRoot, deviceId] = process.argv.slice(2);
const binary = process.platform === 'win32' ? `index.win32-${process.arch}-msvc.node`
  : process.platform === 'darwin' ? `index.darwin-${process.arch}.node` : `index.linux-${process.arch}-gnu.node`;
const root = appRoot.replace(/app\.asar$/, 'app.asar.unpacked');
let microphone: any;
try {
  const native = require(path.join(root, 'native-module', binary));
  let fallbackUsed = false;
  try { microphone = new native.MicrophoneCapture(deviceId || null); }
  catch (error) {
    if (!deviceId || deviceId === 'default') throw error;
    microphone = new native.MicrophoneCapture(null); fallbackUsed = true;
  }
  microphone.start((error: Error | null, chunk: Buffer) => {
    if (error) { channel.postMessage({ type: 'error', message: error.message }); return; }
    if (chunk?.length) channel.postMessage({ type: 'level', level: microphoneLevel(chunk) });
  }, () => {});
  channel.postMessage({ type: 'ready', fallbackUsed });
} catch (error) {
  channel.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}

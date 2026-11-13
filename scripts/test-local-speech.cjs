// Explicit integration check: downloads a real model and transcribes its author's sample.
// Run after build:electron:raw. Data stays under temp/local-speech-integration.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { SpeechModelStore } = require('../dist-electron/electron/services/SpeechModelStore');
const { SpeechWorker } = require('../dist-electron/electron/services/SpeechWorker');
const { readSpeechWave } = require('../dist-electron/electron/audio/localSpeechAudio');
const { SPEECH_MODELS } = require('../dist-electron/shared/localSpeech');
async function main() {
  const id = process.argv[2] || 'zipformer-ru';
  const model = SPEECH_MODELS.find(model => model.id === id);
  assert.ok(model, 'known model');
  const root = path.resolve('temp/local-speech-integration');
  const store = new SpeechModelStore(root);
  if (!store.isInstalled(id)) {
    console.log('Downloading', model.name);
    await new Promise((resolve,reject) => {
      const timer=setTimeout(()=>reject(Error('Download timeout')),300000);
      store.on('change',()=>{ const state=store.status(id); if(state.phase==='installed'||state.phase==='error'){clearTimeout(timer);state.phase==='installed'?resolve():reject(Error(state.error));} });
      store.download(id);
    });
  }
  await store.verify(id);
  const sample = path.join(root, 'russian-sample.wav');
  if (!fs.existsSync(sample)) {
    const source = SPEECH_MODELS[0].files[0].url.replace(/\/am\/[^/]+$/, '/test.wav');
    const response = await fetch(source); assert.ok(response.ok, 'sample download');
    fs.writeFileSync(sample, Buffer.from(await response.arrayBuffer()));
  }
  const wave = readSpeechWave(fs.readFileSync(sample));
  const worker = new SpeechWorker(id, store.directory(id), 'ru');
  try {
    const result = await worker.recognize(wave.samples,wave.sampleRate);
    assert.ok(result.text.length>10,'real speech recognized');
    assert.ok(result.durationMs>0); assert.ok(result.peakMemoryBytes>0);
    console.log(JSON.stringify(result,null,2));
    console.log('PASS: verified download and real local inference in an isolated process.');
  } finally {worker.close();await store.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});

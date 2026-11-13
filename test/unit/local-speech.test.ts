import t from 'tap';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {SpeechModelStore} from '../../electron/services/SpeechModelStore';
import {readSpeechWave, pcm16Samples} from '../../electron/audio/localSpeechAudio';
import {SPEECH_MODELS, getSpeechModel, wordErrors} from '../../shared/localSpeech';

t.test('catalog paths and word error comparison', t => {
  t.throws(()=>getSpeechModel('../escape'));
  t.same(wordErrors('Привет, Ёлка! 42', 'привет елка 43'),{errors:1,words:3,rate:1/3});
  t.equal(wordErrors('one two','one three two').errors,1);
  t.equal(wordErrors('one two','one').errors,1);
  t.equal(wordErrors('','anything').rate,null,'no invented quality score without reference');
  for(const model of SPEECH_MODELS) for(const asset of model.files) {
    t.match(asset.url,/^https:\/\/huggingface.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{40}\//,'immutable revision');
    t.match(asset.sha256,/^[a-f0-9]{64}$/);
    t.ok(!asset.name.includes('/'));
  }
  t.end();
});

t.test('downloads resume, verify, reject corrupt files and survive a restart', async t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'askcue-speech-'));
  t.teardown(()=>fs.rmSync(root,{recursive:true,force:true}));
  const model=SPEECH_MODELS[0], original=model.files;
  const bytes=Buffer.from('verified local model'), sha256=createHash('sha256').update(bytes).digest('hex');
  model.files=[{name:'weights.onnx',url:'https://example.test/weights',bytes:bytes.length,sha256}];
  t.teardown(()=>{model.files=original});
  const requests: string[]=[];
  const fetcher = async (_url: any, options: any) => {
    const range=options.headers.Range; requests.push(range||'full');
    const offset=range ? Number(range.match(/\d+/)[0]) : 0;
    return new Response(bytes.subarray(offset),{status:offset?206:200,headers:offset?{'content-range':`bytes ${offset}-${bytes.length-1}/${bytes.length}`}:{}});
  };
  const store=new SpeechModelStore(root,fetcher as typeof fetch);
  const done = () => new Promise<void>((resolve,reject)=>{
    const changed=()=>{const state=store.status(model.id);if(state.phase==='installed'||state.phase==='error'){store.off('change',changed);state.phase==='installed'?resolve():reject(new Error(state.error))}};
    store.on('change',changed);
  });
  const dir=store.directory(model.id);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'weights.onnx.part'),bytes.subarray(0,5));
  t.equal(store.status(model.id).phase,'paused');
  let completion=done();store.download(model.id);await completion;
  t.same(requests,['bytes=5-']);
  await store.verify(model.id);
  t.equal(new SpeechModelStore(root).status(model.id).phase,'installed');
  fs.writeFileSync(path.join(dir,'weights.onnx'),Buffer.alloc(bytes.length));
  await t.rejects(store.verify(model.id),/damaged/,'activation cannot trust file size alone');
  await store.remove(model.id);t.equal(store.status(model.id).phase,'available');
  const corrupted=new SpeechModelStore(root,async()=>new Response(Buffer.alloc(bytes.length)));
  const failed=new Promise<void>(resolve=>corrupted.on('change',()=>{if(corrupted.status(model.id).phase==='error')resolve()}));
  corrupted.download(model.id);await failed;
  t.equal(corrupted.isInstalled(model.id),false);t.match(corrupted.status(model.id).error!,/checksum/);
  t.throws(()=>store.directory('../escape'));t.ok(fs.existsSync(root));
});

t.test('pause aborts an active download without marking partial data installed',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'askcue-speech-pause-'));t.teardown(()=>fs.rmSync(root,{recursive:true,force:true}));
  let requested!: ()=>void;
  const started=new Promise<void>(resolve=>{requested=resolve});
  const store=new SpeechModelStore(root,async(_url,options)=>{requested();return await new Promise<Response>((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('aborted'))));});
  store.download('zipformer-ru');await started;await store.pause('zipformer-ru');
  t.equal(store.status('zipformer-ru').phase,'paused');t.equal(store.isInstalled('zipformer-ru'),false);
  await store.remove('zipformer-ru');t.equal(store.status('zipformer-ru').phase,'available');
});

t.test('WAV parsing validates format and downmixes stereo',t=>{
  const frames=1600, buffer=Buffer.alloc(44+frames*4);
  buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(16000,24);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*4,40);
  for(let i=0;i<frames;i++){buffer.writeInt16LE(16384,44+i*4);buffer.writeInt16LE(-8192,46+i*4)}
  const wave=readSpeechWave(buffer);t.equal(wave.sampleRate,16000);t.equal(wave.samples.length,frames);t.equal(wave.samples[0],.125);
  t.same([...pcm16Samples(buffer.subarray(44,48),2)],[.125]);
  t.throws(()=>readSpeechWave(buffer.subarray(0,50)),/Truncated/);
  buffer.writeUInt16LE(6,20);t.throws(()=>readSpeechWave(buffer),/Supported audio/);
  t.end();
});

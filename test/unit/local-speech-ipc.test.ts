import t from 'tap';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {mockRequire} from '../../node_modules/@tapjs/mock/dist/esm/mock-require.js';

t.test('local activation validates before switching, excludes concurrent changes and rolls back errors',async t=>{
  const handlers=new Map<string,Function>(), settings=new Map<string,unknown>();
  const broadcasts: unknown[]=[];
  let provider='groq', failPipeline=false, verifies=0, removals=0, closed=0;
  const store=Object.assign(new EventEmitter(),{
    statuses:()=>[],isInstalled:()=>true,directory:()=>'/models/zipformer-ru',
    verify:async()=>{verifies++},
    download:()=>{},pause:async()=>{},remove:async()=>{removals++},close:async()=>{},
  });
  let holdWorker=false, finishWorker: ((value: unknown)=>void)|undefined;
  class Worker {
    recognize(){return holdWorker?new Promise(resolve=>{finishWorker=resolve}):Promise.resolve({text:'local transcript'})}
    close(){closed++}
  }
  const {registerLocalSpeechHandlers}=mockRequire(path.resolve('electron/ipc/local-speech.ts'),{
    electron:{app:new EventEmitter(),BrowserWindow:{getFocusedWindow:()=>null},dialog:{}},
    [path.resolve('electron/services/localSpeech.ts')]:{getSpeechModelStore:()=>store,setLocalSpeechBusy:()=>{}},
    [path.resolve('electron/services/SettingsManager.ts')]:{SettingsManager:{getInstance:()=>({get:(key:string)=>settings.get(key),set:(key:string,value:unknown)=>settings.set(key,value)})}},
    [path.resolve('electron/services/CredentialsManager.ts')]:{CredentialsManager:{getInstance:()=>({getSttProvider:()=>provider,setSttProvider:(value:string)=>{provider=value},getSttLanguage:()=> 'russian'})}},
    [path.resolve('electron/services/SpeechWorker.ts')]:{SpeechWorker:Worker},
    [path.resolve('electron/ipc/safeHandle.ts')]:{safeHandle:(name:string,handler:Function)=>handlers.set(name,handler)},
  });
  const invoke=(name:string,...args:unknown[])=>handlers.get(name)!(null,...args);
  registerLocalSpeechHandlers({broadcast:(...args:unknown[])=>broadcasts.push(args),getMeetingState:()=>({isActive:false}),reconfigureSttProvider:async()=>{if(failPipeline){failPipeline=false;throw new Error('pipeline failed')}}});
  t.same(await invoke('local-speech:activate','zipformer-ru'),{success:true});
  t.equal(verifies,1);t.equal(provider,'local');t.equal(settings.get('localSpeechModel'),'zipformer-ru');
  t.ok(broadcasts.some((item:any)=>item[0]==='stt-provider-changed'&&item[1]==='local'));
  t.match(await invoke('local-speech:remove','zipformer-ru'),{success:false,error:/active model/});t.equal(removals,0);
  provider='groq';settings.set('localSpeechModel','whisper-base');failPipeline=true;
  t.match(await invoke('local-speech:activate','zipformer-ru'),{success:false,error:'pipeline failed'});
  t.equal(provider,'groq');t.equal(settings.get('localSpeechModel'),'whisper-base','failed pipeline restores saved model');
  holdWorker=true;
  const pending=invoke('local-speech:activate','zipformer-ru');
  await new Promise(resolve=>setImmediate(resolve));
  t.match(await invoke('local-speech:remove','whisper-base'),{success:false,error:/Wait until/});
  const beforeCancel=closed;await invoke('local-speech:cancel-test');t.equal(closed,beforeCancel,'leaving test UI cannot cancel model activation');
  finishWorker!({text:''});await pending;
  t.equal((await invoke('local-speech:state')).busy,false);
});

t.test('LocalSTT stops native work and rejects late transcript events',async t=>{
  let finish: ((value: unknown)=>void)|undefined, closed=0, calls=0;
  class Worker {
    recognize(){calls++;return new Promise(resolve=>{finish=resolve})}
    close(){closed++}
  }
  const {LocalSTT}=mockRequire(path.resolve('electron/audio/LocalSTT.ts'),{[path.resolve('electron/services/SpeechWorker.ts')]:{SpeechWorker:Worker}});
  const stt=new LocalSTT('zipformer-ru','/models'), segments:unknown[]=[],errors:Error[]=[];
  stt.on('transcript',(value:unknown)=>segments.push(value));stt.on('error',(error:Error)=>errors.push(error));
  const audio=Buffer.alloc(16000*2);for(let i=0;i<audio.length;i+=2)audio.writeInt16LE(3000,i);
  stt.write(audio);t.equal(calls,0,'capture is ignored before start');
  stt.start();stt.write(Buffer.alloc(16000*2));stt.notifySpeechEnded();t.equal(calls,0,'silence is not decoded');
  stt.write(audio);stt.notifySpeechEnded();t.equal(calls,1);
  stt.stop();finish!({text:'late words'});await new Promise(resolve=>setImmediate(resolve));
  t.same(segments,[],'stopped sessions cannot leak transcript');t.equal(closed,1);
  stt.start();stt.write(Buffer.alloc(16000*2*21));t.match(errors[0].message,/cannot keep up/,'queue growth is bounded');
  t.equal(closed,2);stt.stop();
});

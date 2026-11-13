const listeners = new Map();
const calls = [];
let undetectable = false;
let proxyEnabled = true;
let active = location.search.includes('overlay');
let startedAt = active ? Date.now() - 65_000 : null;
const emit = (name, data) => (listeners.get(name) || []).forEach(fn => fn(data));
const health = { connected: true, meetingActive: true, hasRecentSystemAudioChunk: true, hasRecentInterviewerTranscript: true, lastSystemAudioChunkAt: Date.now(), lastInterviewerTranscriptAt: Date.now(), lastError: null };
const speechState = {models:[['zipformer-ru',26664874],['whisper-tiny',103609903],['whisper-base',160609290],['whisper-small',375485327]].map(([id,total],i)=>({id,total,received:i===0?total:0,phase:i===0?'installed':'available'})),activeModel:'zipformer-ru',activeProvider:'groq',busy:false,systemAudioEnabled:true};
const responses = {
  getOpenCodeSettings: {enabled:false,baseUrl:'http://127.0.0.1:4096',username:'opencode',hasPassword:false,canImport:true,hasApiKey:true,providerID:'opencode-go',apiUrl:'https://opencode.ai/zen/go/v1/',subscriptionUrl:'https://opencode.ai/go'},
  getOpenCodeModels: {success:true,models:[
    {id:'opencode:openrouter/vendor/model:free',name:'Example Model · OpenRouter (OpenCode)',provider:'OpenRouter',supportsImages:true},
    {id:'opencode:opencode/fast-model',name:'Fast Model · OpenCode (OpenCode)',provider:'OpenCode',supportsImages:false},
  ]},
  getSystemLocale:'ru-RU', getThemeMode: {mode:'light',resolved:'light'}, getMeetingActive: false,
  getRecentMeetings: [], getUpcomingEvents: [], getCustomProviders: [], getOpenAICompatibleProviders: [],
  getAvailableOllamaModels: [], knowledgeGetAllJDs: [], knowledgeGetDocuments: [],
  profileGetProfile: null, profileGetStatus: {hasProfile:false,profileMode:false},
  getStoredCredentials: {sttProvider:'groq',hasOpenaiKey:true,openaiPreferredModel:'vendor/long-namespace-for-layout-tests/very-long-model-name-that-must-not-overflow-2026'}, getPermissionStatus: {}, getRecognitionLanguages: {en:{label:'English'}},
  getAiResponseLanguages: [{label:'English',value:'English'}], getSttLanguage:'en',getAiResponseLanguage:'en',
  getInputDevices: [], getOutputDevices: [], getOpenAtLogin: false,
  getDisguise:'askcue', getOverlayMousePassthrough:false, getVerboseLogging:false,
  getTranscriptAssemblerProfile:'sentence_bias', getSttProvider:'groq', getGroqSttModel:'whisper-large-v3-turbo',
  getTranscriptTranslationSettings:{enabled:false,displayMode:'original',provider:'ollama'},
  getKeybinds: [], getShortcuts:{}, getActionButtonMode:'recap', getDefaultModel:{model:'gpt-5.4'},
  getNativeAudioStatus: health, getSystemProxyEnabled:true, getSystemProxySettings:{enabled:true},
};
window.electronAPI = new Proxy({platform:'win32'}, {get(target, name) {
  if(name in target) return target[name];
  if(name === 'then') return undefined;
  if(String(name).startsWith('on')) return fn => { const list=listeners.get(name)||[]; list.push(fn); listeners.set(name,list); return ()=>listeners.set(name,(listeners.get(name)||[]).filter(item=>item!==fn)); };
  return async (...args) => {
    calls.push({name,args});
    if(name === 'getLocalSpeechState') return structuredClone(speechState);
    if(name === 'setSystemAudioCapture') {speechState.systemAudioEnabled=args[0];emit('onLocalSpeechChanged',structuredClone(speechState));return {success:true};}
    if(name === 'setSttProvider') {speechState.activeProvider=args[0];emit('onSttProviderChanged',args[0]);return {success:true};}
    if(name === 'activateSpeechModel') {speechState.activeModel=args[0];speechState.activeProvider='local';emit('onLocalSpeechChanged',structuredClone(speechState));emit('onSttProviderChanged','local');return {success:true};}
    if(name === 'chooseSpeechTestAudio') return {success:true,audio:{name:'Russian speech.wav',seconds:7.08}};
    if(name === 'testSpeechModels') return {success:true,report:{audio:{name:'Russian speech.wav',seconds:7.08},results:args[0].map(modelId=>({modelId,text:'Проверка локального распознавания.',durationMs:1250,audioSeconds:7.08,peakMemoryBytes:190000000}))}};
    if(name === 'downloadSpeechModel') {const item=speechState.models.find(item=>item.id===args[0]);item.phase='downloading';item.received=10;emit('onLocalSpeechChanged',structuredClone(speechState));return {success:true};}
    if(name === 'pauseSpeechModel') {speechState.models.find(item=>item.id===args[0]).phase='paused';emit('onLocalSpeechChanged',structuredClone(speechState));return {success:true};}
    if(name === 'removeSpeechModel') {const item=speechState.models.find(item=>item.id===args[0]);item.phase='available';item.received=0;emit('onLocalSpeechChanged',structuredClone(speechState));return {success:true};}
    if(name === 'getSystemProxyEnabled') return proxyEnabled;
    if(['generateWhatToSay','generateClarify','generateRecap','generateFollowUpQuestions','generateBrainstorm'].includes(name)) {
      if(window.__uitest.actionResult === 'no_context') return {answer:null,reason:'no_context'};
      if(window.__uitest.actionResult === 'cooldown') return {answer:null,reason:'cooldown'};
      await new Promise(resolve=>setTimeout(resolve,window.__uitest.actionDelay ?? 100));
      if(window.__uitest.actionResult === 'expired') {
        emit('onIntelligenceError',{error:'This API key has expired',mode:'what_to_say',requestId:'test-action-request'});
        return {answer:null,reason:'api_key_expired'};
      }
      const actions = {
        generateWhatToSay:['onIntelligenceSuggestedAnswerToken','onIntelligenceSuggestedAnswer','answer','Готовая реплика по разговору.'],
        generateBrainstorm:['onIntelligenceSuggestedAnswerToken','onIntelligenceSuggestedAnswer','answer','Два подхода к решению задачи.'],
        generateClarify:['onIntelligenceClarifyToken','onIntelligenceClarify','clarification','Какие ограничения по нагрузке?'],
        generateRecap:['onIntelligenceRecapToken','onIntelligenceRecap','summary','Обсудили атомарные счётчики Redis.'],
        generateFollowUpQuestions:['onIntelligenceFollowUpQuestionsToken','onIntelligenceFollowUpQuestionsUpdate','questions','1. Какой ожидается объём запросов?'],
      };
      const [tokenEvent,finalEvent,field,text] = actions[name];
      emit(tokenEvent,{token:text});
      if(window.__uitest.actionStreamDelay) await new Promise(resolve=>setTimeout(resolve,window.__uitest.actionStreamDelay));
      emit(finalEvent,{[field]:text}); return {[field]:text};
    }
    if(name === 'getOpenCodeModels' && window.__uitest.openCodeFailure) return {success:false,models:[],error:'OpenCode server unavailable'};
    if(name === 'saveOpenCodeSettings') {responses.getOpenCodeSettings={...args[0],hasPassword:Boolean(args[0].password)};return {success:true};}
    if(name === 'importOpenCodeConnection') return {success:true};
    if(name === 'saveOpenCodeApiKey') return {success:true};
    if(name === 'setDefaultModel') {responses.getDefaultModel={model:args[0]};emit('onModelChanged',args[0]);return {success:true};}
    if(name === 'setSystemProxyEnabled') {proxyEnabled=args[0]; return {success:true};}
    if(name === 'getMeetingDetails') return {id:'old-meeting',title:'Redis architecture',date:'2026-11-10',duration:'01:00',summary:'Redis notes',transcript:[],usage:[]};
    if(name === 'searchMeetings') return String(args[0]).toLowerCase().includes('redis') ? [{id:'old-meeting',title:'Redis architecture',date:'2026-11-10',snippet:'Лимиты запросов и Redis'}] : [];
    if(name === 'getUndetectable') return undetectable;
    if(name === 'setUndetectable') { undetectable=args[0]; emit('onUndetectableChanged',undetectable); return; }
    if(name === 'getMeetingActive') return active;
    if(name === 'getMeetingState') return {isActive:active,startedAt};
    if(name === 'startMeeting') {active=true;startedAt=Date.now();emit('onMeetingStateChanged',{isActive:true,startedAt});return {success:true};}
    if(name === 'endMeeting') {active=false;startedAt=null;emit('onMeetingStateChanged',{isActive:false,startedAt:null});return {success:true};}
    if(name === 'setThemeMode') { emit('onThemeChanged',{mode:args[0],resolved:args[0]}); return; }
    if(name === 'invoke') return [];
    return name in responses ? responses[name] : {};
  };
}});
window.__uitest = {emit,calls};



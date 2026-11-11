const listeners = new Map();
const calls = [];
let undetectable = false;
let proxyEnabled = true;
let active = location.search.includes('overlay');
let startedAt = active ? Date.now() - 65_000 : null;
const emit = (name, data) => (listeners.get(name) || []).forEach(fn => fn(data));
const health = { connected: true, meetingActive: true, hasRecentSystemAudioChunk: true, hasRecentInterviewerTranscript: true, lastSystemAudioChunkAt: Date.now(), lastInterviewerTranscriptAt: Date.now(), lastError: null };
const responses = {
  getSystemLocale:'ru-RU', getThemeMode: {mode:'light',resolved:'light'}, getMeetingActive: false,
  getRecentMeetings: [], getUpcomingEvents: [], getCustomProviders: [], getOpenAICompatibleProviders: [],
  getAvailableOllamaModels: [], knowledgeGetAllJDs: [], knowledgeGetDocuments: [],
  profileGetProfile: null, profileGetStatus: {hasProfile:false,profileMode:false},
  getStoredCredentials: {hasOpenaiKey:true,openaiPreferredModel:'vendor/long-namespace-for-layout-tests/very-long-model-name-that-must-not-overflow-2026'}, getPermissionStatus: {}, getRecognitionLanguages: {en:{label:'English'}},
  getAiResponseLanguages: [{label:'English',value:'English'}], getSttLanguage:'en',getAiResponseLanguage:'en',
  getInputDevices: [], getOutputDevices: [], getOpenAtLogin: false,
  getDisguise:'pika', getOverlayMousePassthrough:false, getVerboseLogging:false,
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
    if(name === 'getSystemProxyEnabled') return proxyEnabled;
    if(name === 'setSystemProxyEnabled') {proxyEnabled=args[0]; return {success:true};}
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



'use strict';

// All demo content is illustrative and stays in the browser. No microphone or API access.
const english = {
  skip: 'Skip to content', navFeatures: 'Features', navWorkflow: 'How it works', navFaq: 'Questions',
  eyebrow: 'OPEN SOURCE. OPEN CONVERSATION.', headline1: 'Stay in the conversation.', headline2: 'Find your next words.',
  heroDescription: 'Listen to the person, not the voice searching for words. AskCue follows the context of your meeting and helps you put your thoughts into a reply.',
  try: 'Try AskCue', see: 'See it in action', desktop: 'For Windows & macOS', ownKeys: 'Bring your own API keys',
  previewHeading: 'The conversation comes first', demoLabel: 'INTERACTIVE DEMO · FICTIONAL DATA',
  workspace: 'Workspace', meetingName: 'Project discussion', transcript: 'TRANSCRIPT', them: 'Other speaker', you: 'You',
  line1: 'We want to launch the first version this month. What do you think we should focus on?',
  line2: 'I would start with the core experience and get feedback from our first users.',
  line3: 'Sounds good. How will we know that experience actually works?',
  assistant: 'YOUR CUE', context: 'From the meeting context', reply: 'Suggest a reply', clarify: 'Clarify', recap: 'Recap',
  audio: 'Microphone + system audio', previewNote: 'Interface example. No audio is recorded.',
  demoHint: 'Try the buttons — a different cue for each moment ↗', demoDisclaimer: 'Example content and response timing.',
  featuresEyebrow: 'A LITTLE LESS ON YOUR MIND', featuresHeading: 'Everything to help you\nkeep the thread.',
  featuresDescription: 'For work meetings, exchanging ideas, and interview practice. In one calm workspace.',
  f1title: 'Listen, instead of taking notes', f1text: 'Live transcription of your microphone and system audio. Revisit a line while the conversation moves on.',
  f2title: 'From context to a reply', f2text: 'A ready-to-say response, a clarifying question, a quick recap, or a fresh idea. Choose what the moment needs.',
  f3title: 'Show what you mean', f3text: 'Add a screen or region capture. A model with image support can help make sense of the details.',
  f4title: 'Make the model your choice', f4text: 'OpenCode, cloud providers, compatible APIs, or a local model with Ollama. Your choice, your keys.',
  f5title: 'Return to what matters', f5text: 'Meeting history and transcript search. Keep past conversations within reach in a local database.',
  f6title: 'Know what is happening', f6text: 'Time to first text, response duration, and clear errors. Less guesswork, more clarity.',
  modelsEyebrow: 'YOUR ASSISTANT. YOUR MODEL.', modelsHeading: 'A good conversation\nis bigger than one AI.',
  modelsText: 'Connect a familiar service or explore something new. With OpenCode, discover models and stream answers right inside AskCue.',
  modelsLink: 'Explore the integration', integrated: 'INTEGRATED', yourApi: 'Your API ↗',
  providerNote: 'Model access and request pricing depend on your provider. Speech recognition is configured separately.',
  workflowEyebrow: 'KEEP THE SETUP SIMPLE', workflowHeading: 'Connect. Listen. Speak.',
  workflowText: 'AskCue keeps track of the context.\nYou stay in the conversation.',
  step1title: 'Connect your providers', step1text: 'Choose an AI model and a speech recognition service. Add your own API keys in Settings.',
  step2title: 'Start a meeting', step2text: 'Choose your microphone, enable system audio, and check the first lines of the transcript.',
  step3title: 'Get a cue when you need one', step3text: 'Use an action button at the right moment, or ask your own question in the chat.',
  early: 'EARLY STAGE', startHeading: 'Your next conversation.\nWith AskCue.',
  startText: 'We are just getting started. Try it, share your feedback, and help build an assistant you will want to use.',
  releases: 'Explore releases', releaseNote: 'Ready-to-use builds appear as they are published. Until then, you can run the app from source.',
  sourceSetup: 'RUN FROM SOURCE', buildGuide: 'Full setup guide', copy: 'Copy commands',
  faqEyebrow: 'A FEW GOOD QUESTIONS', faqHeading: 'No fine print.',
  q1: 'Is it free?', a1: 'AskCue is open source under MIT. The app does not require an AskCue subscription. Cloud AI and speech recognition services are billed under your chosen provider’s terms.',
  q2: 'Where does my data go?', a2: 'Meeting history is stored locally. Cloud services receive the audio, text, or screenshots needed for your requests. In version 0.0.1, API keys are stored in a local plaintext credentials.json file, rather than an OS keychain.',
  q3: 'Can I use it completely offline?', a3: 'Ollama lets you run a language model locally. The built-in speech recognition integrations use cloud services, so a local AI model alone does not make the whole pipeline offline.',
  q4: 'Which systems are supported?', a4: 'Windows is the current development and validation environment. macOS code is included, but builds need validation on target hardware; the default packaging targets Apple Silicon. Linux support is not yet validated.',
  q5: 'How can I contribute?', a5: 'Report an issue, suggest an improvement, or open a pull request. The repository has a guide for contributors.',
  contribute: 'Get involved ↗', footerTagline: 'Less noise. More meaning.', footerGit: 'Let’s make it better together',
  based: 'Built on the open-source work of', feedback: 'Share feedback ↗',
  supportHeading: 'Help AskCue grow.', supportText: 'If the project has been useful, you can buy the maintainer a coffee. Thank you for your support!',
};
const localizedElements = [...document.querySelectorAll('[data-i18n]')];
const russian = Object.fromEntries(localizedElements.map(element => [
  element.dataset.i18n,
  [...element.childNodes].map(node => node.nodeName === 'BR' ? '\n' : node.textContent).join(''),
]));
const ariaRussian = { nav: 'Основная навигация', demoActions: 'Действия демо' };
const ariaEnglish = { nav: 'Main navigation', demoActions: 'Demo actions' };
const demo = {
  ru: {
    reply: { label: 'МОЖНО ОТВЕТИТЬ ТАК', text: '«Давай проверим весь путь: от первого запуска до полезного результата. Посмотрим, где люди останавливаются, и спросим, что им помогло. Это даст нам основу для следующей итерации».', timing: 'Ответ готов · 1,8 с' },
    clarify: { label: 'СТОИТ УТОЧНИТЬ', text: '«Какой конкретный результат должен получить человек после первого использования, чтобы мы считали запуск успешным?»', timing: 'Уточнение готово · 1,2 с' },
    recap: { label: 'ГЛАВНОЕ К ЭТОМУ МОМЕНТУ', text: 'Первую версию планируем запустить в этом месяце. Фокус — основной сценарий и обратная связь первых пользователей. Осталось договориться о критерии успешного запуска.', timing: 'Итоги готовы · 1,5 с' },
  },
  en: {
    reply: { label: 'YOU COULD SAY', text: '“Let’s test the whole journey: from first launch to a useful result. We can see where people get stuck and ask what helped them. That will give us a starting point for the next iteration.”', timing: 'Reply ready · 1.8 s' },
    clarify: { label: 'A QUESTION WORTH ASKING', text: '“What specific result should someone get from their first use for us to consider the launch a success?”', timing: 'Question ready · 1.2 s' },
    recap: { label: 'THE CONVERSATION SO FAR', text: 'The first version is planned for this month. The focus is the core experience and feedback from early users. The next step is agreeing on what makes the launch successful.', timing: 'Recap ready · 1.5 s' },
  },
};
let language = 'ru';
let currentAction = 'reply';

function renderDemo(action) {
  currentAction = action;
  const response = demo[language][action];
  document.getElementById('answer-kicker').textContent = response.label;
  document.getElementById('answer-text').textContent = response.text;
  document.getElementById('answer-timing').textContent = response.timing;
  document.querySelectorAll('[data-demo]').forEach(button => {
    const active = button.dataset.demo === action;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setLanguage(nextLanguage) {
  language = nextLanguage === 'en' ? 'en' : 'ru';
  const messages = language === 'en' ? english : russian;
  localizedElements.forEach(element => {
    const value = messages[element.dataset.i18n];
    if (typeof value !== 'string') throw new Error('Missing translation: ' + element.dataset.i18n);
    element.textContent = value;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', (language === 'en' ? ariaEnglish : ariaRussian)[element.dataset.i18nAria]);
  });
  document.documentElement.lang = language;
  document.title = language === 'en' ? 'AskCue — Stay in the conversation' : 'AskCue — Главное в разговоре';
  document.querySelector('meta[name="description"]').content = language === 'en'
    ? 'An open-source desktop assistant for meetings. Live transcription, contextual AI answers, and your choice of models.'
    : 'AskCue — открытый AI-помощник для встреч и разговоров. Живая расшифровка, ответы с учётом контекста и ваши любимые модели.';
  const button = document.getElementById('language');
  button.textContent = language === 'ru' ? 'EN ↗' : 'RU ↗';
  button.setAttribute('aria-label', language === 'ru' ? 'Switch to English' : 'Переключить на русский');
  document.getElementById('copy-status').textContent = '';
  renderDemo(currentAction);
  try { localStorage.setItem('askcue_site_language', language); } catch { /* Preferences are optional. */ }
}

document.getElementById('language').addEventListener('click', () => setLanguage(language === 'ru' ? 'en' : 'ru'));
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => renderDemo(button.dataset.demo)));
document.getElementById('copy-command').addEventListener('click', async () => {
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(document.getElementById('install-command').textContent.trim());
    status.textContent = language === 'ru' ? 'Команды скопированы ✓' : 'Commands copied ✓';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('install-command'));
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = language === 'ru' ? 'Команды выделены — нажми Ctrl+C / ⌘C.' : 'Commands selected — press Ctrl+C / ⌘C.';
  }
});

let initialLanguage = new URLSearchParams(location.search).get('lang');
if (!initialLanguage) {
  try { initialLanguage = localStorage.getItem('askcue_site_language'); } catch { /* Use Russian by default. */ }
}
setLanguage(initialLanguage);

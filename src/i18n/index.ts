import { useSyncExternalStore } from 'react';
import { normalizeLanguagePreference, resolveInterfaceLanguage, type LanguagePreference } from './language';
import { englishToRussian, russianToEnglish } from './messages';

const preferenceKey = 'pika_interface_language';
const localeKey = 'pika_system_locale';
const listeners = new Set<() => void>();
let preference = normalizeLanguagePreference(localStorage.getItem(preferenceKey));
let systemLocale = localStorage.getItem(localeKey) || navigator.language;
const snapshot = () => `${preference}:${resolveInterfaceLanguage(preference, systemLocale)}`;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => {
  document.documentElement.lang = resolveInterfaceLanguage(preference, systemLocale);
  listeners.forEach(listener => listener());
};

export function initializeInterfaceLanguage() {
  const updateSystemLocale = () => {
    window.electronAPI?.getSystemLocale?.().then(locale => {
      if (typeof locale !== 'string' || !locale) return;
      systemLocale = locale; localStorage.setItem(localeKey, locale); notify();
    }).catch(() => {});
  };
  window.addEventListener('storage', event => {
    if (!event.key || event.key === preferenceKey || event.key === localeKey) {
      preference = normalizeLanguagePreference(localStorage.getItem(preferenceKey));
      systemLocale = localStorage.getItem(localeKey) || navigator.language;
      notify();
    }
  });
  window.addEventListener('languagechange', updateSystemLocale);
  notify(); updateSystemLocale();
}

export function setInterfaceLanguage(value: LanguagePreference) {
  preference = normalizeLanguagePreference(value);
  localStorage.setItem(preferenceKey, preference); notify();
}

export function useInterfaceLanguage() {
  useSyncExternalStore(subscribe, snapshot);
  return { preference, language: resolveInterfaceLanguage(preference, systemLocale), setPreference: setInterfaceLanguage };
}

/** Only UI-owned text is passed here; meeting content and model responses stay as received. */
export function t(text: string): string {
  const dictionary = resolveInterfaceLanguage(preference, systemLocale) === 'ru' ? englishToRussian : russianToEnglish;
  return dictionary[text] ?? text;
}

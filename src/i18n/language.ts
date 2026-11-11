export type InterfaceLanguage = 'ru' | 'en';
export type LanguagePreference = InterfaceLanguage | 'system';

export function normalizeLanguagePreference(value: string | null): LanguagePreference {
  return value === 'ru' || value === 'en' ? value : 'system';
}

export function resolveInterfaceLanguage(preference: LanguagePreference, systemLocale: string): InterfaceLanguage {
  return preference === 'system' ? (/^ru(?:[-_]|$)/i.test(systemLocale) ? 'ru' : 'en') : preference;
}

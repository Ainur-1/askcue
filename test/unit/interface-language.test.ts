import t from 'tap';
import { normalizeLanguagePreference, resolveInterfaceLanguage } from '../../src/i18n/language';
import { englishToRussian, russianToEnglish } from '../../src/i18n/messages';

t.test('interface defaults to the OS locale and supports explicit Russian or English', t => {
  t.equal(normalizeLanguagePreference(null), 'system');
  t.equal(normalizeLanguagePreference('invalid'), 'system');
  t.equal(resolveInterfaceLanguage('system', 'ru-RU'), 'ru');
  t.equal(resolveInterfaceLanguage('system', 'ru_RU'), 'ru');
  t.equal(resolveInterfaceLanguage('system', 'en-US'), 'en');
  t.equal(resolveInterfaceLanguage('system', 'ja-JP'), 'en');
  t.equal(resolveInterfaceLanguage('ru', 'en-US'), 'ru');
  t.equal(resolveInterfaceLanguage('en', 'ru-RU'), 'en');
  t.end();
});

t.test('both languages cover core settings and workspace navigation', t => {
  for (const label of ['Use system proxy', 'Mouse Passthrough', 'Open Pika when you log in', 'App behavior', 'Interface language', 'Theme', 'Meeting history', 'Materials', 'Settings']) {
    t.type(englishToRussian[label], 'string', label);
    t.type(russianToEnglish[englishToRussian[label]], 'string', 'reverse translation');
  }
  t.end();
});

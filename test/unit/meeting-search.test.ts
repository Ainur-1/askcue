import t from 'tap';
import { normalizeSearchText, searchSnippet } from '../../electron/db/meetingSearch';

t.test('local history search normalizes Russian, casing and whitespace', t => {
  t.equal(normalizeSearchText('  Собеседование   ЁЛКА '), 'собеседование елка');
  t.equal(normalizeSearchText('API %_ \'quote\''), "api %_ 'quote'");
  t.equal(normalizeSearchText('ＡＰＩ'), 'api');
  t.match(searchSnippet('Вопрос про Redis и лимиты запросов', 'redis'), /Redis/);
  t.ok(searchSnippet('a'.repeat(300) + 'needle', 'needle').length < 185);
  t.end();
});

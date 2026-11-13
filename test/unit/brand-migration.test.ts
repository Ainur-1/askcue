import t from 'tap';
import fs from 'node:fs';
import path from 'node:path';
import { PREVIOUS_PROFILE_NAME } from '../../shared/branding';
import { migratePreferences } from '../../src/lib/migratePreferences';
import { migrateProfileDirectory } from '../../electron/services/profileMigration';

t.test('preferences retain existing values, import earlier settings, and migrate only owned keys', t => {
  const values = new Map([
    [`${PREVIOUS_PROFILE_NAME}_interface_language`, 'ru'],
    [`${PREVIOUS_PROFILE_NAME}_resolved_theme`, 'dark'],
    ['askcue_resolved_theme', 'light'],
    ['natively_user_name', 'Alex'],
    ['unrelated_setting', 'preserve'],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  } as Storage;
  migratePreferences(storage);
  t.same(Object.fromEntries(values), { askcue_interface_language: 'ru', askcue_resolved_theme: 'light', askcue_user_name: 'Alex', unrelated_setting: 'preserve' });
  migratePreferences(storage);
  t.equal(values.size, 4, 'a second launch is idempotent');
  t.end();
});

t.test('profile migration preserves credentials, browser storage and documents without replacing newer files', async t => {
  const folder = t.testdir({ old: { 'credentials.json': '{"provider":"test"}', 'settings.json': 'old', 'Local Storage': { leveldb: { 'data.ldb': 'theme and language' } }, documents: { 'cv.pdf': 'resume' }, Cache: { disposable: 'cache' }, SingletonLock: 'old lock' }, current: { 'settings.json': 'current' } });
  const from = path.join(folder, 'old');
  const to = path.join(folder, 'current');
  await migrateProfileDirectory(from, to);
  t.equal(fs.readFileSync(path.join(to, 'credentials.json'), 'utf8'), '{"provider":"test"}');
  t.equal(fs.readFileSync(path.join(to, 'settings.json'), 'utf8'), 'current');
  t.equal(fs.readFileSync(path.join(to, 'Local Storage/leveldb/data.ldb'), 'utf8'), 'theme and language');
  t.equal(fs.readFileSync(path.join(to, 'documents/cv.pdf'), 'utf8'), 'resume');
  t.notOk(fs.existsSync(path.join(to, 'Cache')), 'disposable cache omitted');
  t.notOk(fs.existsSync(path.join(to, 'SingletonLock')), 'old process locks omitted');
  t.ok(fs.existsSync(path.join(from, 'credentials.json')), 'source retained for rollback');
  await migrateProfileDirectory(from, to);
  t.equal(fs.readFileSync(path.join(to, 'settings.json'), 'utf8'), 'current');
});

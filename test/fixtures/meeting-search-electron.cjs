const path = require('node:path');
const assert = require('node:assert/strict');
if (!process.versions.electron) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], { env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || ''); process.exit(result.status ?? 1);
}
const { app } = require('electron');
app.setPath('userData', path.resolve('temp/search-test-profile'));
app.whenReady().then(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('CREATE TABLE meetings(id TEXT,title TEXT,created_at TEXT,summary_json TEXT); CREATE TABLE transcripts(meeting_id TEXT,content TEXT)');
  const insert = db.prepare('INSERT INTO meetings VALUES(?,?,?,?)');
  for (let index = 0; index < 65; index++) insert.run(String(index), `Recent meeting ${index}`, '2026-11-11', '{}');
  insert.run('old', 'Интервью ЁЛКА', '2020-01-01', JSON.stringify({ legacySummary: 'Обсудили Кафку и очереди' }));
  db.prepare('INSERT INTO transcripts VALUES(?,?)').run('old', 'Лимиты Redis и квоты запросов');
  const { DatabaseManager } = require('../../dist-electron/electron/db/DatabaseManager.js');
  const manager = Object.create(DatabaseManager.prototype); manager.db = db;
  for (const query of ['redis', 'КАФКУ', 'ИнТеРвЬю', 'елка']) assert.equal(manager.searchMeetings(query)[0]?.id, 'old', query);
  assert.match(manager.searchMeetings('redis')[0].snippet, /Redis/);
  assert.equal(manager.searchMeetings('recent').length, 30);
  assert.deepEqual(manager.searchMeetings("%' OR 1=1 --"), []);
  assert.deepEqual(manager.searchMeetings(''), []);
  db.close(); console.log('PASS SQLite history search: Unicode/casing, notes/transcript, meetings beyond recent 50, snippets, literal punctuation and result cap.'); app.quit();
}).catch(error => { console.error(error); app.exit(1); });

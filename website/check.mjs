import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(directory, 'app.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(directory, '..', 'package.json'), 'utf8'));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const target = match[1];
  if (target === '#' || /^https?:\/\//.test(target)) continue;
  if (target.startsWith('#')) assert.ok(ids.includes(target.slice(1)), 'Missing anchor: ' + target);
  else assert.ok(fs.existsSync(path.resolve(directory, target)), 'Missing local asset: ' + target);
}
const translations = script.match(/const english = (\{[\s\S]*?\n\});/);
assert.ok(translations, 'English translations must exist');
const english = vm.runInNewContext('(' + translations[1] + ')', {}, { timeout: 1000 });
for (const match of html.matchAll(/\bdata-i18n="([^"]+)"/g)) {
  assert.equal(typeof english[match[1]], 'string', 'Missing English translation: ' + match[1]);
}
for (const match of html.matchAll(/\bdata-demo="([^"]+)"/g)) assert.ok(['reply', 'clarify', 'recap'].includes(match[1]), 'Unknown demo action');
assert.ok(html.includes('v' + pkg.version), 'Landing version must match the app');
assert.ok(html.includes(pkg.license + ' License'), 'Show the current license');
assert.ok(html.includes('https://github.com/Ainur-1/askcue/releases'), 'Point downloads to AskCue releases');
assert.ok(fs.existsSync(path.join(directory, '.nojekyll')));
assert.ok(fs.readFileSync(path.join(directory, 'styles.css'), 'utf8').includes('prefers-reduced-motion'));
console.log('PASS landing assets, anchors, translations, version, license, demo actions and reduced-motion support');

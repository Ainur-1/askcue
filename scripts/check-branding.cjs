const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const previous = String.fromCharCode(112, 105, 107, 97);
const forbidden = new RegExp(`${previous}|${String.fromCharCode(1087, 1080, 1082, 1072)}`, 'i');
const files = new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean));
if (process.argv.includes('--built')) {
  const addTree = folder => {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) addTree(file);
      else if (entry.isFile()) files.add(file);
    }
  };
  addTree('dist'); addTree('dist-electron');
}
const failures = [];
let checked = 0;
for (const file of files) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  if (forbidden.test(file)) failures.push(`${file}: filename`);
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) continue;
  const contents = buffer.toString('utf8').replace(/(?:git\+)?https?:\/\/[^\s<>"'`)\]]+/g, url =>
    /(?:github\.com\/|img\.shields\.io\/)/.test(url) ? '' : url);
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    if (forbidden.test(line)) failures.push(`${file}:${index + 1}`);
  }
  checked++;
}
if (failures.length) { console.error('Outdated branding remains:\n' + failures.join('\n')); process.exit(1); }
console.log(`PASS AskCue branding: ${checked} text files, zero old names outside repository links; filenames checked.`);

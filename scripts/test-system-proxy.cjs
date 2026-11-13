// Run Electron without opening windows or touching the user's AskCue profile.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const profile = path.resolve(__dirname, '../temp', `proxy-test-${process.pid}`);
fs.mkdirSync(profile, { recursive: true });
const env = { ...process.env, ASKCUE_PROXY_TEST_PROFILE: profile, APPDATA: profile };
if (process.argv.includes('--external')) env.ASKCUE_PROXY_TEST_EXTERNAL = '1';
if (process.argv.includes('--start-direct')) env.ASKCUE_PROXY_TEST_START_DIRECT = '1';
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.join(__dirname, '../test/fixtures/system-proxy-electron.cjs')], {
    env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; console.error('Proxy smoke test timed out'); }, 60_000);
child.on('error', (error) => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { clearTimeout(timer); process.exitCode = code ?? 1; });

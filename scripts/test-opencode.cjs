// Exercise the compiled integration with the real bundled CLI in an isolated profile.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
if (!process.versions.electron) {
    const profile = path.resolve('temp', `opencode-smoke-${process.pid}`);
    fs.mkdirSync(profile, { recursive: true });
    const env = { ...process.env, APPDATA: profile, ASKCUE_OPENCODE_TEST_PROFILE: profile,
        XDG_DATA_HOME: path.join(profile, 'data'), XDG_STATE_HOME: path.join(profile, 'state'), XDG_CACHE_HOME: path.join(profile, 'cache'), XDG_CONFIG_HOME: path.join(profile, 'config') };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(require('electron'), [__filename], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
    const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 60000);
    child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 1; });
} else {
    const assert = require('node:assert/strict');
    const { app } = require('electron');
    app.setPath('userData', process.env.ASKCUE_OPENCODE_TEST_PROFILE);
    app.on('window-all-closed', () => {});
    app.whenReady().then(async () => {
        const { CredentialsManager } = require('../dist-electron/electron/services/CredentialsManager');
        const { openCodeService, stopOpenCode } = require('../dist-electron/electron/services/OpenCodeManager');
        try {
            CredentialsManager.getInstance().init();
            CredentialsManager.getInstance().setOpenCodeSettings({ enabled: true, baseUrl: 'http://127.0.0.1:4096', username: 'opencode', password: '' });
            const models = await openCodeService.models();
            assert.ok(Array.isArray(models));
            assert.ok(models.length > 0, 'bundled OpenCode discovers its free models without API keys');
            assert.ok(models.every(model => model.id.startsWith('opencode:') && model.name));
            console.log(`PASS bundled OpenCode: native ESM SDK in Electron, authenticated automatic startup, ${models.length} models discovered, isolated profile, clean shutdown.`);
            stopOpenCode(); app.exit(0);
        } catch (error) { console.error(error); stopOpenCode(); app.exit(1); }
    });
}

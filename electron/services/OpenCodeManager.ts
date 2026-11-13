import { app } from 'electron';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { CredentialsManager } from './CredentialsManager';
import { OpenCodeService } from './OpenCodeService';

let processHandle: ChildProcess | undefined;
let starting: Promise<string> | undefined;
let ownedUrl: string | undefined;
let ownedPassword = '';

/** Reuse the user's server; otherwise own one isolated, authenticated local process. */
async function startLocal(): Promise<string> {
    if (ownedUrl) return ownedUrl;
    if (starting) return starting;
    starting = (async () => {
        const settings = CredentialsManager.getInstance().getOpenCodeSettings();
        try {
            const response = await fetch(`${settings.baseUrl}/global/health`, {
                headers: settings.password ? { Authorization: `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}` } : {},
                signal: AbortSignal.timeout(2000),
            });
            if (response.status === 401 || response.status === 403) throw new Error('OpenCode server authentication failed');
            if (!response.ok || !(await response.json()).healthy) throw new Error('Invalid OpenCode health response');
            return settings.baseUrl;
        } catch (error) {
            if (error instanceof Error && error.message === 'OpenCode server authentication failed') throw error;
        }
        const packageDir = path.dirname(require.resolve('opencode-ai/package.json'));
        const binary = path.join(packageDir, 'bin', 'opencode.exe').replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
        if (!fs.existsSync(binary)) throw new Error('OpenCode executable is missing. Reinstall the application or connect an OpenCode server.');
        const directory = path.join(app.getPath('userData'), 'opencode');
        fs.mkdirSync(directory, { recursive: true });
        ownedPassword = randomBytes(24).toString('hex');
        const child = spawn(binary, ['serve', '--hostname=127.0.0.1', '--port=0'], {
            cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, OPENCODE_SERVER_PASSWORD: ownedPassword, OPENCODE_SERVER_USERNAME: 'opencode' },
        });
        processHandle = child;
        child.once('exit', () => {
            if (processHandle === child) { processHandle = undefined; ownedUrl = undefined; ownedPassword = ''; }
        });
        return new Promise<string>((resolve, reject) => {
            let output = '';
            const timer = setTimeout(() => { child.kill(); reject(new Error('OpenCode startup timed out. Check OpenCode configuration.')); }, 30000);
            child.stdout.on('data', (chunk: Buffer) => {
                output = (output + chunk.toString()).slice(-8192);
                const match = output.match(/opencode server listening on (http:\/\/127\.0\.0\.1:\d+)/);
                if (!match) return;
                clearTimeout(timer);
                ownedUrl = match[1];
                resolve(ownedUrl);
            });
            // Drain stderr without persisting provider credentials or prompt contents.
            child.stderr.resume();
            child.once('error', error => { clearTimeout(timer); reject(error); });
            child.once('exit', code => { clearTimeout(timer); reject(new Error(`OpenCode exited (${code}). Check OpenCode configuration.`)); });
        });
    })().finally(() => { starting = undefined; });
    return starting;
}

export function stopOpenCode(): void {
    processHandle?.kill();
    processHandle = undefined;
    ownedUrl = undefined;
    ownedPassword = '';
}

export const openCodeService = new OpenCodeService(() => {
    const settings = CredentialsManager.getInstance().getOpenCodeSettings();
    return ownedUrl && settings.baseUrl === 'http://127.0.0.1:4096'
        ? { ...settings, username: 'opencode', password: ownedPassword } : settings;
}, startLocal, async (input, init) => {
    // startLocal may have generated a password after client() read settings.
    const request = new Request(input, init);
    if (ownedUrl && new URL(request.url).origin === ownedUrl) {
        request.headers.set('Authorization', `Basic ${Buffer.from(`opencode:${ownedPassword}`).toString('base64')}`);
    }
    return fetch(request);
});

/**
 * Centralised config paths for AskCue.
 *
 * Config is stored in a platform-appropriate, upgrade-safe location:
 *   - macOS / Linux: ~/.config/askcue/
 *   - Windows:       %APPDATA%\askcue\  (C:\Users\xxx\AppData\Roaming\askcue\)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_DIR =
    process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'askcue')
        : path.join(os.homedir(), '.config', 'askcue');

/** Ensure ~/.config/askcue/ exists (idempotent). */
function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

export function getConfigDir(): string {
    ensureConfigDir();
    return CONFIG_DIR;
}

export function getCredentialsJsonPath(): string {
    ensureConfigDir();
    return path.join(CONFIG_DIR, 'credentials.json');
}

export function getSettingsJsonPath(): string {
    ensureConfigDir();
    return path.join(CONFIG_DIR, 'settings.json');
}

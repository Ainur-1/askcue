#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

if (process.platform === 'darwin') {
    const required = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
        console.warn(
            `[build-app] WARNING: Missing ${missing.join(', ')} in .env — notarization will be skipped or fail. ` +
                `App will be signed but Gatekeeper will quarantine it on download (users would need xattr -cr).`
        );
    } else {
        console.log('[build-app] Apple notarization credentials detected (APPLE_ID / APPLE_TEAM_ID).');
    }
}

// Invoke JavaScript directly: Windows cannot spawn a .cmd shim without a shell.
const builderCli = require.resolve('electron-builder/out/cli/cli.js');

const args = ['--publish', 'never', ...process.argv.slice(2)];
// Packaging reads the already verified dependency tree; nested pnpm exec calls
// must not run an install and change native bindings underneath the build.
const buildEnv = { ...process.env, pnpm_config_verify_deps_before_run: 'false' };
const result = spawnSync(process.execPath, [builderCli, ...args], { stdio: 'inherit', env: buildEnv, windowsHide: true });
if (result.error) console.error('[build-app]', result.error.message);
process.exit(result.status ?? 1);

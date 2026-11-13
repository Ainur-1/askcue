import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PREVIOUS_PROFILE_NAME, PROFILE_NAME } from '../../shared/branding';

const marker = '.brand-migration-v1';
const excluded = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Crashpad', 'SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile']);

async function snapshotDatabase(source: string, destination: string): Promise<void> {
  // SQLite's backup API also snapshots committed WAL transactions while an old
  // version is running. Copying just the database file could lose recent meetings.
  const { default: Database } = await import('better-sqlite3');
  const database = new Database(source, { readonly: true, fileMustExist: true });
  try { await database.backup(destination); } finally { database.close(); }
}

export async function migrateProfileDirectory(source: string, destination: string): Promise<void> {
  if (!fs.existsSync(source) || path.resolve(source).toLowerCase() === path.resolve(destination).toLowerCase()) return;
  fs.mkdirSync(destination, { recursive: true });
  const sourceDatabase = [PREVIOUS_PROFILE_NAME, 'natively'].map(name => path.join(source, `${name}.db`)).find(file => fs.existsSync(file));
  const destinationDatabase = path.join(destination, `${PROFILE_NAME}.db`);
  if (sourceDatabase && !fs.existsSync(destinationDatabase)) {
    const temporary = `${destinationDatabase}.migration`;
    await snapshotDatabase(sourceDatabase, temporary);
    fs.renameSync(temporary, destinationDatabase);
  }
  const copyMissing = (from: string, to: string): void => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (excluded.has(entry.name) || entry.name === marker || entry.isSymbolicLink()) continue;
      if ([PREVIOUS_PROFILE_NAME, 'natively'].some(name => entry.name === `${name}.db` || entry.name.startsWith(`${name}.db-`))) continue;
      const name = entry.name.startsWith(`${PREVIOUS_PROFILE_NAME}-`) ? `${PROFILE_NAME}${entry.name.slice(PREVIOUS_PROFILE_NAME.length)}` : entry.name;
      const target = path.join(to, name);
      if (entry.isDirectory()) copyMissing(path.join(from, entry.name), target);
      else if (entry.isFile() && !fs.existsSync(target)) fs.copyFileSync(path.join(from, entry.name), target, fs.constants.COPYFILE_EXCL);
    }
  };
  copyMissing(source, destination);
}

export async function migrateAppProfile(appData: string): Promise<void> {
  const bases = new Set([appData, process.platform === 'win32' ? (process.env.APPDATA || appData) : path.join(os.homedir(), '.config')]);
  for (const base of bases) {
    const destination = path.join(base, PROFILE_NAME);
    if (fs.existsSync(path.join(destination, marker))) continue;
    for (const name of [PREVIOUS_PROFILE_NAME, PREVIOUS_PROFILE_NAME[0].toUpperCase() + PREVIOUS_PROFILE_NAME.slice(1)]) {
      await migrateProfileDirectory(path.join(base, name), destination);
    }
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, marker), '1');
  }
}

import { PREVIOUS_PROFILE_NAME, PROFILE_NAME } from '../../shared/branding';

export function migratePreferences(storage: Storage): void {
  try {
    for (const prefix of [PREVIOUS_PROFILE_NAME, 'natively']) {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) {
        if (!key?.startsWith(`${prefix}_`)) continue;
        const next = `${PROFILE_NAME}_${key.slice(prefix.length + 1)}`;
        const value = storage.getItem(key);
        if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
        storage.removeItem(key);
      }
    }
  } catch { /* Storage may be unavailable in a restricted browser context. */ }
}

import type Database from 'better-sqlite3';
import { rebrandBuiltInText } from '../../shared/branding';

/** Update only the application-owned demo. Real conversations stay verbatim. */
export function migrateDemoBranding(database: Database.Database): void {
  database.function('askcue_brand_text', { deterministic: true }, (value: unknown) =>
    value === null ? null : rebrandBuiltInText(String(value)));
  database.transaction(() => {
    for (const [table, key, columns] of [
      ['meetings', 'id', ['title', 'summary_json']],
      ['transcripts', 'meeting_id', ['speaker', 'content']],
      ['ai_interactions', 'meeting_id', ['user_query', 'ai_response', 'metadata_json']],
      ['chunks', 'meeting_id', ['speaker', 'cleaned_text']],
      ['chunk_summaries', 'meeting_id', ['summary_text']],
    ] as const) {
      database.prepare(`UPDATE ${table} SET ${columns.map(column => `${column}=askcue_brand_text(${column})`).join(',')} WHERE ${key}=?`).run('demo-meeting');
    }
  })();
}

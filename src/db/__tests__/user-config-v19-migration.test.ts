import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

describe('User config v19 migration', () => {
  test('adds the artist confirmation preference and preserves the existing profile', async () => {
    const db = new Database(':memory:');
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
    db.exec(`
      DROP TABLE user_config;
      CREATE TABLE user_config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'Otaku',
        avatar_uri TEXT,
        avatar_emoji TEXT NOT NULL DEFAULT '🎤',
        oshi_artist_id TEXT,
        updated_at TEXT NOT NULL
      );
      INSERT INTO user_config
        (id, name, avatar_uri, avatar_emoji, oshi_artist_id, updated_at)
      VALUES
        ('default', 'Harold', 'file:///avatar.jpg', '🎸', 'artist-1', '2026-08-01T00:00:00.000Z');
      PRAGMA user_version = 18;
    `);

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(db.pragma('user_version', { simple: true })).toBe(22);
    expect(db.prepare(`SELECT name, avatar_uri, avatar_emoji, oshi_artist_id,
      artist_confirmation_mode, updated_at FROM user_config WHERE id = 'default'`).get())
      .toEqual({
        name: 'Harold',
        avatar_uri: 'file:///avatar.jpg',
        avatar_emoji: '🎸',
        oshi_artist_id: 'artist-1',
        artist_confirmation_mode: 'always',
        updated_at: '2026-08-01T00:00:00.000Z',
      });
    expect(() => db.prepare(
      "UPDATE user_config SET artist_confirmation_mode = 'unknown' WHERE id = 'default'",
    ).run()).toThrow();

    db.close();
  });
});

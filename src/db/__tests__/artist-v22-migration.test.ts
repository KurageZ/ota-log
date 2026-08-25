import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { createV11Db } from './fixtures/createV11Db';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

let mockUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `90000000-0000-4000-8000-${String(++mockUuidIndex).padStart(12, '0')}`,
}));

describe('Artist relationship v22 migration', () => {
  let db: Database.Database;

  beforeEach(() => {
    mockUuidIndex = 0;
    db = createV11Db();
    db.prepare(
      `INSERT INTO artists
        (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'artist-child',
      'Fixture Child',
      null,
      'artist-v11',
      null,
      null,
      0,
      '2026-01-02T00:00:00.000Z',
    );
  });

  afterEach(() => db.close());

  test('rebuilds artists, preserves legacy affiliations, and keeps all artists unset', async () => {
    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(db.pragma('user_version', { simple: true })).toBe(23);
    const columns = (db.pragma('table_info(artists)') as Array<{ name: string }>).map(({ name }) => name);
    expect(columns).toEqual([
      'id', 'name', 'short_name', 'artist_type', 'avatar_uri', 'background_uri',
      'background_color', 'url', 'is_favorite', 'created_at',
    ]);
    expect(db.prepare('SELECT id, artist_type FROM artists ORDER BY id').all()).toEqual([
      { id: 'artist-child', artist_type: null },
      { id: 'artist-v11', artist_type: null },
    ]);
    expect(db.prepare('SELECT member_artist_id, parent_artist_id FROM artist_basic_affiliations').all())
      .toEqual([{ member_artist_id: 'artist-child', parent_artist_id: 'artist-v11' }]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM artist_group_memberships').get())
      .toEqual({ count: 0 });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  test('keeps existing artist references valid after the table rebuild', async () => {
    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(db.prepare('SELECT artist_id FROM cheki_records LIMIT 1').get())
      .toEqual({ artist_id: 'artist-v11' });
    expect(db.prepare("SELECT oshi_artist_id FROM user_config WHERE id = 'default'").get())
      .toEqual({ oshi_artist_id: 'artist-v11' });
  });
});

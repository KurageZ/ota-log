import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';

function columns(db: Database.Database, table: string): string[] {
  return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
}

function indexes(db: Database.Database, table: string): string[] {
  return (db.pragma(`index_list(${table})`) as Array<{ name: string }>).map((index) => index.name);
}

function tables(db: Database.Database): string[] {
  const rows = (
    db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
  ) as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

function tableSql(db: Database.Database, table: string): string {
  return db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?")
    .pluck()
    .get(table) as string;
}

describe('Fresh schema smoke test', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    for (const stmt of SCHEMA_STATEMENTS) {
      db.exec(stmt);
    }
  });

  afterEach(() => db.close());

  test('creates all required tables', () => {
    expect(tables(db)).toEqual(expect.arrayContaining([
      'artists', 'cheki', 'cheki_manual_entries', 'event_artists', 'events',
      'expenses', 'photos', 'trips', 'user_config',
    ]));
  });

  test('artists has all expected columns', () => {
    expect(columns(db, 'artists')).toEqual(
      expect.arrayContaining(['id', 'name', 'short_name', 'parent_id', 'avatar_uri', 'background_uri', 'background_color', 'url', 'is_favorite', 'created_at'])
    );
  });

  test('cheki has all expected columns', () => {
    expect(columns(db, 'cheki')).toEqual(
      expect.arrayContaining(['id', 'event_id', 'artist_id', 'photo_uri', 'date', 'price', 'notes', 'created_at'])
    );
  });

  test('user_config has oshi_artist_id column', () => {
    expect(columns(db, 'user_config')).toContain('oshi_artist_id');
  });

  test('cheki_manual_entries has all expected columns', () => {
    expect(columns(db, 'cheki_manual_entries')).toEqual(
      expect.arrayContaining(['id', 'artist_id', 'event_id', 'date', 'count', 'total_price', 'created_at', 'updated_at'])
    );
  });

  test('cheki_manual_entries enforces non-negative manual aggregates', () => {
    const sql = tableSql(db, 'cheki_manual_entries');
    expect(sql).toContain('CHECK (count >= 1 AND count = CAST(count AS INTEGER))');
    expect(sql).toContain('CHECK (total_price IS NULL OR total_price >= 0)');
  });

  test('cheki sort indexes exist', () => {
    const idx = indexes(db, 'cheki');
    expect(idx).toContain('idx_cheki_sort_date');
    expect(idx).toContain('idx_cheki_artist_sort');
    expect(idx).toContain('idx_cheki_event_sort');
  });

  test('cheki_manual_entries sort indexes exist', () => {
    const idx = indexes(db, 'cheki_manual_entries');
    expect(idx).toContain('idx_cheki_manual_artist_sort');
    expect(idx).toContain('idx_cheki_manual_event_sort');
  });
});

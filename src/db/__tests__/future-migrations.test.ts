import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { createV11Db } from './fixtures/createV11Db';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

function getScalar<T>(db: Database.Database, sql: string): T {
  return db.prepare(sql).pluck().get() as T;
}

function createV12DbWithManualEntries(): Database.Database {
  const db = new Database(':memory:');

  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`CREATE TABLE artists (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    short_name  TEXT,
    parent_id   TEXT REFERENCES artists(id) ON DELETE SET NULL,
    avatar_uri  TEXT,
    url         TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE events (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    event_type   TEXT NOT NULL DEFAULT 'livehouse',
    event_date   TEXT NOT NULL,
    event_time   TEXT,
    city         TEXT,
    venue        TEXT,
    ticket_price REAL,
    status       TEXT NOT NULL,
    review_score INTEGER,
    notes        TEXT,
    details      TEXT,
    url          TEXT,
    setlist_text TEXT,
    trip_id      TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE cheki_manual_entries (
    id          TEXT PRIMARY KEY,
    artist_id   TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
    date        TEXT,
    count       INTEGER NOT NULL,
    total_price REAL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`);
  db.exec(
    'CREATE INDEX idx_cheki_manual_artist_sort ON cheki_manual_entries (artist_id, COALESCE(date, created_at) DESC, created_at DESC)'
  );
  db.exec(
    'CREATE INDEX idx_cheki_manual_event_sort ON cheki_manual_entries (event_id, COALESCE(date, created_at) DESC, created_at DESC)'
  );

  db.prepare(
    `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('artist-v12', 'Fixture Artist V12', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');

  db.prepare(
    `INSERT INTO cheki_manual_entries
       (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('manual-valid', 'artist-v12', null, '2026-01-02', 2, 60, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z');

  db.prepare(
    `INSERT INTO cheki_manual_entries
       (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('manual-invalid', 'artist-v12', null, '2026-01-03', 2.5, -10, '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z');

  db.pragma('user_version = 12');
  return db;
}

describe('Forward migrations from v11', () => {
  test('fresh database seeds only the build-time bundled artist catalog', async () => {
    const db = new Database(':memory:');
    const expectedArtistCount = Number(process.env.OTA_LOG_EXPECT_BUNDLED_ARTISTS ?? 0);
    const expectedAvatarCount = Number(process.env.OTA_LOG_EXPECT_BUNDLED_ARTIST_AVATARS ?? 0);

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(getScalar<number>(db, 'PRAGMA user_version')).toBe(16);
    expect(getScalar<number>(db, 'SELECT COUNT(*) FROM artists')).toBe(expectedArtistCount);
    expect(getScalar<number>(db, "SELECT COUNT(*) FROM artists WHERE avatar_uri LIKE 'preset://%'"))
      .toBe(expectedAvatarCount);

    db.close();
  });

  test('provides a reusable v11 baseline fixture with representative data', () => {
    const db = createV11Db();

    expect(getScalar<string>(db, "SELECT name FROM user_config WHERE id = 'default'")).toBe('Otaku');
    expect(getScalar<string>(db, "SELECT oshi_artist_id FROM user_config WHERE id = 'default'")).toBe('artist-v11');
    expect(getScalar<string>(db, "SELECT notes FROM cheki WHERE id = 'cheki-v11'")).toBe('fixture cheki');
    expect(getScalar<number>(db, "SELECT is_favorite FROM artists WHERE id = 'artist-v11'")).toBe(1);

    db.close();
  });

  test('upgrades v11 fixture to v16 and preserves representative data', async () => {
    const db = createV11Db();

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(getScalar<number>(db, 'PRAGMA user_version')).toBe(16);
    expect(getScalar<string>(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cheki_manual_entries'")).toBe('cheki_manual_entries');
    expect(getScalar<string>(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'important_dates'")).toBe('important_dates');
    expect(getScalar<string>(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'important_date_anniversary_rules'")).toBe('important_date_anniversary_rules');
    expect(getScalar<string>(db, "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_cheki_manual_artist_sort'")).toBe('idx_cheki_manual_artist_sort');
    expect(getScalar<string>(db, "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_important_dates_date'")).toBe('idx_important_dates_date');
    expect(getScalar<string>(db, "SELECT name FROM user_config WHERE id = 'default'")).toBe('Otaku');
    expect(getScalar<string>(db, "SELECT oshi_artist_id FROM user_config WHERE id = 'default'")).toBe('artist-v11');
    expect(getScalar<string>(db, "SELECT notes FROM cheki WHERE id = 'cheki-v11'")).toBe('fixture cheki');
    expect(getScalar<number>(db, "SELECT COUNT(*) FROM cheki_manual_entries")).toBe(0);

    db.close();
  });

  test('upgrades v12 manual entries to v16 constraints and normalizes invalid legacy values', async () => {
    const db = createV12DbWithManualEntries();

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(getScalar<number>(db, 'PRAGMA user_version')).toBe(16);
    expect(getScalar<number>(db, "SELECT count FROM cheki_manual_entries WHERE id = 'manual-valid'")).toBe(2);
    expect(getScalar<number>(db, "SELECT total_price FROM cheki_manual_entries WHERE id = 'manual-valid'")).toBe(60);
    expect(getScalar<number>(db, "SELECT count FROM cheki_manual_entries WHERE id = 'manual-invalid'")).toBe(2);
    expect(getScalar<number>(db, "SELECT total_price FROM cheki_manual_entries WHERE id = 'manual-invalid'")).toBe(0);
    expect(getScalar<string>(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cheki_manual_entries'")).toContain('CHECK (count >= 1 AND count = CAST(count AS INTEGER))');
    expect(getScalar<string>(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cheki_manual_entries'")).toContain('CHECK (total_price IS NULL OR total_price >= 0)');

    db.close();
  });

  test('upgrades v13 artists to v16 artist backdrop columns and preserves data', async () => {
    const db = new Database(':memory:');

    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`CREATE TABLE artists (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      short_name  TEXT,
      parent_id   TEXT REFERENCES artists(id) ON DELETE SET NULL,
      avatar_uri  TEXT,
      url         TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      origin_city TEXT,
      dest_city TEXT,
      depart_date TEXT,
      return_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE events (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      event_type   TEXT NOT NULL DEFAULT 'livehouse',
      event_date   TEXT NOT NULL,
      event_time   TEXT,
      city         TEXT,
      venue        TEXT,
      ticket_price REAL,
      status       TEXT NOT NULL,
      review_score INTEGER,
      notes        TEXT,
      details      TEXT,
      url          TEXT,
      setlist_text TEXT,
      trip_id      TEXT REFERENCES trips(id) ON DELETE SET NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE event_artists (
      event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, artist_id)
    )`);
    db.exec(`CREATE TABLE photos (
      id         TEXT PRIMARY KEY,
      event_id   TEXT REFERENCES events(id) ON DELETE SET NULL,
      local_uri  TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE expenses (
      id         TEXT PRIMARY KEY,
      trip_id    TEXT REFERENCES trips(id) ON DELETE CASCADE,
      event_id   TEXT REFERENCES events(id) ON DELETE CASCADE,
      category   TEXT NOT NULL,
      amount     REAL NOT NULL,
      notes      TEXT,
      created_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE cheki (
      id         TEXT PRIMARY KEY,
      event_id   TEXT REFERENCES events(id) ON DELETE SET NULL,
      artist_id  TEXT REFERENCES artists(id) ON DELETE SET NULL,
      photo_uri  TEXT NOT NULL,
      date       TEXT,
      price      REAL,
      notes      TEXT,
      created_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE cheki_manual_entries (
      id          TEXT PRIMARY KEY,
      artist_id   TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
      date        TEXT,
      count       INTEGER NOT NULL CHECK (count >= 1 AND count = CAST(count AS INTEGER)),
      total_price REAL CHECK (total_price IS NULL OR total_price >= 0),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE user_config (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL DEFAULT 'Otaku',
      avatar_uri     TEXT,
      avatar_emoji   TEXT NOT NULL DEFAULT '🎤',
      oshi_artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
      updated_at     TEXT NOT NULL
    )`);
    db.exec('CREATE INDEX idx_cheki_sort_date ON cheki (COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_artist_sort ON cheki (artist_id, COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_event_sort ON cheki (event_id, COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_manual_artist_sort ON cheki_manual_entries (artist_id, COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_manual_event_sort ON cheki_manual_entries (event_id, COALESCE(date, created_at) DESC, created_at DESC)');

    db.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('artist-v13', 'Fixture Artist V13', 'Fixture', null, 'file:///artist-avatar.jpg', 'https://example.com', 1, '2026-01-01T00:00:00.000Z');

    db.pragma('user_version = 13');

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(getScalar<number>(db, 'PRAGMA user_version')).toBe(16);
    expect(getScalar<string>(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artists'")).toBe('artists');
    expect(getScalar<string>(db, "SELECT name FROM pragma_table_info('artists') WHERE name = 'background_uri'")).toBe('background_uri');
    expect(getScalar<string>(db, "SELECT name FROM pragma_table_info('artists') WHERE name = 'background_color'")).toBe('background_color');
    expect(getScalar<string>(db, "SELECT name FROM artists WHERE id = 'artist-v13'")).toBe('Fixture Artist V13');
    expect(getScalar<string>(db, "SELECT avatar_uri FROM artists WHERE id = 'artist-v13'")).toBe('file:///artist-avatar.jpg');
    expect(getScalar<null>(db, "SELECT background_uri FROM artists WHERE id = 'artist-v13'")).toBeNull();
    expect(getScalar<null>(db, "SELECT background_color FROM artists WHERE id = 'artist-v13'")).toBeNull();

    db.close();
  });

  test('upgrades v14 artists to v16 background_color column and preserves background_uri data', async () => {
    const db = new Database(':memory:');

    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`CREATE TABLE artists (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      short_name     TEXT,
      parent_id      TEXT REFERENCES artists(id) ON DELETE SET NULL,
      avatar_uri     TEXT,
      background_uri TEXT,
      url            TEXT,
      is_favorite    INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      origin_city TEXT,
      dest_city TEXT,
      depart_date TEXT,
      return_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE events (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      event_type   TEXT NOT NULL DEFAULT 'livehouse',
      event_date   TEXT NOT NULL,
      event_time   TEXT,
      city         TEXT,
      venue        TEXT,
      ticket_price REAL,
      status       TEXT NOT NULL,
      review_score INTEGER,
      notes        TEXT,
      details      TEXT,
      url          TEXT,
      setlist_text TEXT,
      trip_id      TEXT REFERENCES trips(id) ON DELETE SET NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE event_artists (
      event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, artist_id)
    )`);
    db.exec(`CREATE TABLE photos (
      id         TEXT PRIMARY KEY,
      event_id   TEXT REFERENCES events(id) ON DELETE SET NULL,
      local_uri  TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE expenses (
      id         TEXT PRIMARY KEY,
      trip_id    TEXT REFERENCES trips(id) ON DELETE CASCADE,
      event_id   TEXT REFERENCES events(id) ON DELETE CASCADE,
      category   TEXT NOT NULL,
      amount     REAL NOT NULL,
      notes      TEXT,
      created_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE cheki (
      id         TEXT PRIMARY KEY,
      event_id   TEXT REFERENCES events(id) ON DELETE SET NULL,
      artist_id  TEXT REFERENCES artists(id) ON DELETE SET NULL,
      photo_uri  TEXT NOT NULL,
      date       TEXT,
      price      REAL,
      notes      TEXT,
      created_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE cheki_manual_entries (
      id          TEXT PRIMARY KEY,
      artist_id   TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
      date        TEXT,
      count       INTEGER NOT NULL CHECK (count >= 1 AND count = CAST(count AS INTEGER)),
      total_price REAL CHECK (total_price IS NULL OR total_price >= 0),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE user_config (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL DEFAULT 'Otaku',
      avatar_uri     TEXT,
      avatar_emoji   TEXT NOT NULL DEFAULT '🎤',
      oshi_artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
      updated_at     TEXT NOT NULL
    )`);
    db.exec('CREATE INDEX idx_cheki_sort_date ON cheki (COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_artist_sort ON cheki (artist_id, COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_event_sort ON cheki (event_id, COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_manual_artist_sort ON cheki_manual_entries (artist_id, COALESCE(date, created_at) DESC, created_at DESC)');
    db.exec('CREATE INDEX idx_cheki_manual_event_sort ON cheki_manual_entries (event_id, COALESCE(date, created_at) DESC, created_at DESC)');

    db.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-v14',
      'Fixture Artist V14',
      null,
      null,
      'file:///artist-avatar-v14.jpg',
      'file:///artist-background-v14.jpg',
      'https://example.com/v14',
      1,
      '2026-02-01T00:00:00.000Z',
    );

    db.pragma('user_version = 14');

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(getScalar<number>(db, 'PRAGMA user_version')).toBe(16);
    expect(getScalar<string>(db, "SELECT name FROM pragma_table_info('artists') WHERE name = 'background_color'")).toBe('background_color');
    expect(getScalar<string>(db, "SELECT background_uri FROM artists WHERE id = 'artist-v14'")).toBe('file:///artist-background-v14.jpg');
    expect(getScalar<null>(db, "SELECT background_color FROM artists WHERE id = 'artist-v14'")).toBeNull();

    db.close();
  });
});

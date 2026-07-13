import Database from 'better-sqlite3';

const V11_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS artists (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    short_name  TEXT,
    parent_id   TEXT REFERENCES artists(id) ON DELETE SET NULL,
    avatar_uri  TEXT,
    url         TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS trips (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    origin_city TEXT,
    dest_city   TEXT,
    depart_date TEXT,
    return_date TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS events (
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
  )`,

  `CREATE TABLE IF NOT EXISTS event_artists (
    event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, artist_id)
  )`,

  `CREATE TABLE IF NOT EXISTS photos (
    id         TEXT PRIMARY KEY,
    event_id   TEXT REFERENCES events(id) ON DELETE SET NULL,
    local_uri  TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id         TEXT PRIMARY KEY,
    trip_id    TEXT REFERENCES trips(id) ON DELETE CASCADE,
    event_id   TEXT REFERENCES events(id) ON DELETE CASCADE,
    category   TEXT NOT NULL,
    amount     REAL NOT NULL,
    notes      TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS cheki (
    id         TEXT PRIMARY KEY,
    event_id   TEXT REFERENCES events(id) ON DELETE SET NULL,
    artist_id  TEXT REFERENCES artists(id) ON DELETE SET NULL,
    photo_uri  TEXT NOT NULL,
    date       TEXT,
    price      REAL,
    notes      TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_config (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL DEFAULT 'Otaku',
    avatar_uri     TEXT,
    avatar_emoji   TEXT NOT NULL DEFAULT '🎤',
    oshi_artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
    updated_at     TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_cheki_sort_date
    ON cheki (COALESCE(date, created_at) DESC, created_at DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_cheki_artist_sort
    ON cheki (artist_id, COALESCE(date, created_at) DESC, created_at DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_cheki_event_sort
    ON cheki (event_id, COALESCE(date, created_at) DESC, created_at DESC)`,
];

export function createV11Db(): Database.Database {
  const db = new Database(':memory:');

  db.exec('PRAGMA foreign_keys = ON');

  for (const stmt of V11_SCHEMA_STATEMENTS) {
    db.exec(stmt);
  }

  db.prepare(
    `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'artist-v11',
    'Fixture Artist',
    'Fixture',
    null,
    null,
    null,
    1,
    '2026-01-01T00:00:00.000Z'
  );

  db.prepare(
    `INSERT INTO user_config (id, name, avatar_uri, avatar_emoji, oshi_artist_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    'default',
    'Otaku',
    null,
    '🎤',
    'artist-v11',
    '2026-01-01T00:00:00.000Z'
  );

  db.prepare(
    `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'cheki-v11',
    null,
    'artist-v11',
    'file:///fixture-cheki.jpg',
    '2026-01-02',
    50,
    'fixture cheki',
    '2026-01-02T00:00:00.000Z'
  );

  db.pragma('user_version = 11');
  return db;
}

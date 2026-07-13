import { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_STATEMENTS } from './schema';
import { insertBundledArtists } from './bundledArtistCatalog';

const CURRENT_VERSION = 16;

async function createImportantDateTables(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(`CREATE TABLE IF NOT EXISTS important_dates (
    id                   TEXT PRIMARY KEY,
    title                TEXT NOT NULL,
    date                 TEXT NOT NULL,
    source_kind          TEXT NOT NULL CHECK (source_kind IN ('manual', 'linked_activity', 'first_cheki', 'first_live')),
    linked_event_id      TEXT REFERENCES events(id) ON DELETE SET NULL,
    notes                TEXT,
    show_on_calendar     INTEGER NOT NULL DEFAULT 1 CHECK (show_on_calendar IN (0, 1)),
    reminder_enabled     INTEGER NOT NULL DEFAULT 0 CHECK (reminder_enabled IN (0, 1)),
    reminder_offset_days INTEGER NOT NULL DEFAULT 0 CHECK (reminder_offset_days >= 0),
    reminder_time        TEXT NOT NULL DEFAULT '09:00',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    CHECK (
      (source_kind = 'linked_activity' AND linked_event_id IS NOT NULL)
      OR (source_kind != 'linked_activity' AND linked_event_id IS NULL)
    )
  )`);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS important_date_artists (
    important_date_id TEXT NOT NULL REFERENCES important_dates(id) ON DELETE CASCADE,
    artist_id         TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (important_date_id, artist_id)
  )`);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS important_date_anniversary_rules (
    id                 TEXT PRIMARY KEY,
    important_date_id  TEXT NOT NULL REFERENCES important_dates(id) ON DELETE CASCADE,
    anniversary_kind   TEXT NOT NULL CHECK (anniversary_kind IN ('day', 'month', 'year')),
    anniversary_value  INTEGER NOT NULL CHECK (anniversary_value > 0),
    label              TEXT NOT NULL,
    enabled            INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    UNIQUE (important_date_id, anniversary_kind, anniversary_value)
  )`);
  await db.runAsync(`CREATE TABLE IF NOT EXISTS scheduled_reminder_state (
    id              TEXT PRIMARY KEY,
    target_kind     TEXT NOT NULL CHECK (target_kind IN ('important_date', 'important_date_anniversary')),
    target_id       TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    scheduled_for   TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )`);
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_important_dates_date ON important_dates (date ASC, updated_at DESC)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_important_dates_linked_event ON important_dates (linked_event_id)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_important_dates_source ON important_dates (source_kind)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_important_date_artists_artist ON important_date_artists (artist_id, important_date_id)');
  await db.runAsync('CREATE INDEX IF NOT EXISTS idx_important_date_anniversaries_item ON important_date_anniversary_rules (important_date_id, anniversary_kind, anniversary_value)');
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version === 0) {
    // Fresh install: create all tables from schema
    await db.runAsync('PRAGMA foreign_keys = OFF');
    for (const stmt of SCHEMA_STATEMENTS) {
      await db.runAsync(stmt);
    }
    await db.runAsync('PRAGMA foreign_keys = ON');
  } else if (version < CURRENT_VERSION) {
    // Upgrade: incremental migrations, user data preserved
    if (version < 6) {
      await db.runAsync('ALTER TABLE events ADD COLUMN details TEXT');
    }
    if (version < 7) {
      await db.runAsync('ALTER TABLE cheki ADD COLUMN price REAL');
      await db.runAsync('ALTER TABLE cheki ADD COLUMN notes TEXT');
    }
    if (version < 8) {
      await db.runAsync(`CREATE TABLE IF NOT EXISTS user_config (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL DEFAULT 'Otaku',
        avatar_uri    TEXT,
        avatar_emoji  TEXT NOT NULL DEFAULT '🎤',
        updated_at    TEXT NOT NULL
      )`);
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT OR IGNORE INTO user_config (id, name, avatar_uri, avatar_emoji, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['default', 'Otaku', null, '🎤', now]
      );
    }
    if (version < 9) {
      await db.runAsync('ALTER TABLE user_config ADD COLUMN oshi_artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL');
    }
    if (version < 10) {
      await db.runAsync(
        'UPDATE user_config SET name = ?, updated_at = ? WHERE id = ? AND name = ?',
        ['Otaku', new Date().toISOString(), 'default', '跑活粉']
      );
    }
    if (version < 11) {
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_cheki_sort_date ON cheki (COALESCE(date, created_at) DESC, created_at DESC)'
      );
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_cheki_artist_sort ON cheki (artist_id, COALESCE(date, created_at) DESC, created_at DESC)'
      );
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_cheki_event_sort ON cheki (event_id, COALESCE(date, created_at) DESC, created_at DESC)'
      );
    }
    if (version < 12) {
      await db.runAsync(`CREATE TABLE IF NOT EXISTS cheki_manual_entries (
        id          TEXT PRIMARY KEY,
        artist_id   TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
        event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
        date        TEXT,
        count       INTEGER NOT NULL,
        total_price REAL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )`);
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_cheki_manual_artist_sort ON cheki_manual_entries (artist_id, COALESCE(date, created_at) DESC, created_at DESC)'
      );
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_cheki_manual_event_sort ON cheki_manual_entries (event_id, COALESCE(date, created_at) DESC, created_at DESC)'
      );
    }
    if (version < 13) {
      await db.runAsync('PRAGMA foreign_keys = OFF');
      await db.runAsync(`CREATE TABLE IF NOT EXISTS cheki_manual_entries_next (
        id          TEXT PRIMARY KEY,
        artist_id   TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
        event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
        date        TEXT,
        count       INTEGER NOT NULL CHECK (count >= 1 AND count = CAST(count AS INTEGER)),
        total_price REAL CHECK (total_price IS NULL OR total_price >= 0),
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )`);
      await db.runAsync(
        `INSERT INTO cheki_manual_entries_next
           (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
         SELECT
           id,
           artist_id,
           event_id,
           date,
           CASE WHEN count IS NULL OR count < 1 THEN 1 ELSE CAST(count AS INTEGER) END,
           CASE WHEN total_price IS NOT NULL AND total_price < 0 THEN 0 ELSE total_price END,
           created_at,
           updated_at
         FROM cheki_manual_entries`
      );
      await db.runAsync('DROP TABLE cheki_manual_entries');
      await db.runAsync('ALTER TABLE cheki_manual_entries_next RENAME TO cheki_manual_entries');
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_cheki_manual_artist_sort ON cheki_manual_entries (artist_id, COALESCE(date, created_at) DESC, created_at DESC)'
      );
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_cheki_manual_event_sort ON cheki_manual_entries (event_id, COALESCE(date, created_at) DESC, created_at DESC)'
      );
      await db.runAsync('PRAGMA foreign_keys = ON');
    }
    if (version < 14) {
      await db.runAsync('ALTER TABLE artists ADD COLUMN background_uri TEXT');
    }
    if (version < 15) {
      await db.runAsync('ALTER TABLE artists ADD COLUMN background_color TEXT');
    }
    if (version < 16) {
      await createImportantDateTables(db);
    }
    // Future versions: add more `if (version < N)` blocks here
  }

  if (version === 0) {
    await insertBundledArtists(db);
  }

  await db.runAsync(`PRAGMA user_version = ${CURRENT_VERSION}`);
}

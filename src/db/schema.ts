import { CHEKI_V2_SCHEMA_STATEMENTS } from './chekiV2Schema';
import {
  ACTIVITY_V2_SCHEMA_STATEMENTS,
  createEventArtistsV2TableSql,
  createEventsV2TableSql,
} from './activityV2Schema';
import {
  ARTIST_ACTIVITY_ATTRIBUTION_VIEW_STATEMENTS,
  ARTIST_RELATIONSHIP_SCHEMA_STATEMENTS,
  createArtistsTableSql,
} from './artistRelationshipSchema';

export const SCHEMA_STATEMENTS = [
  createArtistsTableSql(),

  ...ARTIST_RELATIONSHIP_SCHEMA_STATEMENTS,

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

  createEventsV2TableSql(),

  createEventArtistsV2TableSql(),

  ...ACTIVITY_V2_SCHEMA_STATEMENTS,

  ...ARTIST_ACTIVITY_ATTRIBUTION_VIEW_STATEMENTS,

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

  ...CHEKI_V2_SCHEMA_STATEMENTS,

  `CREATE TABLE IF NOT EXISTS user_config (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL DEFAULT 'Otaku',
    avatar_uri    TEXT,
    avatar_emoji  TEXT NOT NULL DEFAULT '🎤',
    oshi_artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
    artist_confirmation_mode TEXT NOT NULL DEFAULT 'always'
      CHECK (artist_confirmation_mode IN ('always', 'matches_only', 'never')),
    updated_at    TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS important_dates (
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
  )`,

  `CREATE TABLE IF NOT EXISTS important_date_artists (
    important_date_id TEXT NOT NULL REFERENCES important_dates(id) ON DELETE CASCADE,
    artist_id         TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (important_date_id, artist_id)
  )`,

  `CREATE TABLE IF NOT EXISTS important_date_anniversary_rules (
    id                 TEXT PRIMARY KEY,
    important_date_id  TEXT NOT NULL REFERENCES important_dates(id) ON DELETE CASCADE,
    anniversary_kind   TEXT NOT NULL CHECK (anniversary_kind IN ('day', 'month', 'year')),
    anniversary_value  INTEGER NOT NULL CHECK (anniversary_value > 0),
    label              TEXT NOT NULL,
    enabled            INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    UNIQUE (important_date_id, anniversary_kind, anniversary_value)
  )`,

  `CREATE TABLE IF NOT EXISTS scheduled_reminder_state (
    id              TEXT PRIMARY KEY,
    target_kind     TEXT NOT NULL CHECK (target_kind IN ('important_date', 'important_date_anniversary')),
    target_id       TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    scheduled_for   TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_important_dates_date
    ON important_dates (date ASC, updated_at DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_important_dates_linked_event
    ON important_dates (linked_event_id)`,

  `CREATE INDEX IF NOT EXISTS idx_important_dates_source
    ON important_dates (source_kind)`,

  `CREATE INDEX IF NOT EXISTS idx_important_date_artists_artist
    ON important_date_artists (artist_id, important_date_id)`,

  `CREATE INDEX IF NOT EXISTS idx_important_date_anniversaries_item
    ON important_date_anniversary_rules (important_date_id, anniversary_kind, anniversary_value)`,
];

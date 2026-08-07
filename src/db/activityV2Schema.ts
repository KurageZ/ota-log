export function createEventsV2TableSql(tableName = 'events'): string {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    event_type     TEXT NOT NULL DEFAULT 'livehouse',
    status         TEXT NOT NULL,
    review_score   INTEGER CHECK (review_score IS NULL OR review_score BETWEEN 1 AND 5),
    notes          TEXT,
    details        TEXT,
    url            TEXT,
    setlist_text   TEXT,
    actual_expense REAL CHECK (actual_expense IS NULL OR actual_expense >= 0),
    trip_id        TEXT REFERENCES trips(id) ON DELETE SET NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  )`;
}

export function createEventArtistsV2TableSql(tableName = 'event_artists'): string {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (
    event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    PRIMARY KEY (event_id, artist_id)
  )`;
}

export const ACTIVITY_V2_TIME_INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_event_sessions_event_sort
    ON event_sessions (event_id, session_date, open_time, start_time, sort_order)`,

  `CREATE INDEX IF NOT EXISTS idx_event_sessions_date
    ON event_sessions (session_date, open_time, start_time)`,
];

export const ACTIVITY_V2_SUMMARY_VIEW_STATEMENTS = [
  `CREATE VIEW IF NOT EXISTS event_first_summaries AS
    SELECT
      e.*,
      s.session_date AS event_date,
      COALESCE(s.open_time, s.start_time) AS event_time,
      s.open_time AS open_time,
      s.start_time AS start_time,
      s.end_time AS end_time,
      s.city AS city,
      s.venue AS venue,
      e.actual_expense AS ticket_price
    FROM events e
    JOIN event_sessions s ON s.id = (
      SELECT candidate.id
      FROM event_sessions candidate
      WHERE candidate.event_id = e.id
      ORDER BY candidate.session_date ASC,
               COALESCE(candidate.open_time, candidate.start_time) ASC,
               candidate.sort_order ASC,
               candidate.id ASC
      LIMIT 1
    )`,

  `CREATE VIEW IF NOT EXISTS event_summaries AS
    SELECT
      e.*,
      s.session_date AS event_date,
      COALESCE(s.open_time, s.start_time) AS event_time,
      s.open_time AS open_time,
      s.start_time AS start_time,
      s.end_time AS end_time,
      s.city AS city,
      s.venue AS venue,
      e.actual_expense AS ticket_price
    FROM events e
    JOIN event_sessions s ON s.id = (
      SELECT candidate.id
      FROM event_sessions candidate
      WHERE candidate.event_id = e.id
      ORDER BY
        CASE WHEN candidate.session_date >= date('now', 'localtime') THEN 0 ELSE 1 END ASC,
        CASE WHEN candidate.session_date >= date('now', 'localtime') THEN candidate.session_date END ASC,
        CASE WHEN candidate.session_date < date('now', 'localtime') THEN candidate.session_date END DESC,
        CASE WHEN candidate.session_date >= date('now', 'localtime') THEN COALESCE(candidate.open_time, candidate.start_time) END ASC,
        CASE WHEN candidate.session_date < date('now', 'localtime') THEN COALESCE(candidate.open_time, candidate.start_time) END DESC,
        candidate.sort_order ASC,
        candidate.id ASC
      LIMIT 1
    )`,
];

export const ACTIVITY_V2_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS event_sessions (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title        TEXT,
    session_date TEXT NOT NULL CHECK (length(session_date) = 10),
    end_date     TEXT CHECK (end_date IS NULL OR end_date >= session_date),
    open_time    TEXT,
    start_time   TEXT,
    end_time     TEXT,
    city         TEXT,
    venue        TEXT,
    sort_order   INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    UNIQUE (event_id, sort_order)
  )`,

  `CREATE TABLE IF NOT EXISTS event_timetable_entries (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    artist_id  TEXT REFERENCES artists(id) ON DELETE SET NULL,
    start_time TEXT,
    end_time   TEXT,
    notes      TEXT,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (session_id, sort_order)
  )`,

  ...ACTIVITY_V2_TIME_INDEX_STATEMENTS,

  `CREATE INDEX IF NOT EXISTS idx_event_sessions_city_date
    ON event_sessions (city, session_date)`,

  `CREATE INDEX IF NOT EXISTS idx_event_sessions_venue_date
    ON event_sessions (venue, session_date)`,

  `CREATE INDEX IF NOT EXISTS idx_event_timetable_entries_session
    ON event_timetable_entries (session_id, sort_order)`,

  `CREATE INDEX IF NOT EXISTS idx_event_timetable_entries_artist
    ON event_timetable_entries (artist_id)`,

  ...ACTIVITY_V2_SUMMARY_VIEW_STATEMENTS,
];

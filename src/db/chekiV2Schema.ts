export const DEFAULT_CHEKI_ASPECT_RATIO = 54 / 86;

export const CHEKI_V2_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS cheki_records (
    id          TEXT PRIMARY KEY,
    event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
    artist_id   TEXT REFERENCES artists(id) ON DELETE SET NULL,
    date        TEXT,
    quantity    INTEGER NOT NULL
                CHECK (quantity >= 1 AND quantity = CAST(quantity AS INTEGER)),
    notes       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cheki_items (
    id                   TEXT PRIMARY KEY,
    record_id            TEXT NOT NULL
                         REFERENCES cheki_records(id) ON DELETE CASCADE,
    sort_order           INTEGER NOT NULL,
    unit_price           INTEGER NOT NULL DEFAULT 0
                         CHECK (
                           unit_price >= 0
                           AND unit_price = CAST(unit_price AS INTEGER)
                         ),
    display_aspect_ratio REAL NOT NULL DEFAULT (54.0 / 86.0)
                         CHECK (display_aspect_ratio > 0),
    is_favorite          INTEGER NOT NULL DEFAULT 0
                         CHECK (is_favorite IN (0, 1)),
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    UNIQUE (record_id, sort_order)
  )`,
  `CREATE TABLE IF NOT EXISTS cheki_item_images (
    id         TEXT PRIMARY KEY,
    item_id    TEXT NOT NULL
               REFERENCES cheki_items(id) ON DELETE CASCADE,
    side       TEXT NOT NULL CHECK (side IN ('front', 'back')),
    photo_uri  TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (item_id, side)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cheki_records_sort_date
    ON cheki_records (COALESCE(date, created_at) DESC, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_cheki_records_artist_sort
    ON cheki_records (artist_id, COALESCE(date, created_at) DESC, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_cheki_records_event_sort
    ON cheki_records (event_id, COALESCE(date, created_at) DESC, created_at DESC)`,
  `CREATE TRIGGER IF NOT EXISTS trg_cheki_items_quantity_before_insert
    BEFORE INSERT ON cheki_items
    WHEN (
      SELECT COUNT(*) FROM cheki_items WHERE record_id = NEW.record_id
    ) >= (
      SELECT quantity FROM cheki_records WHERE id = NEW.record_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'cheki item count exceeds record quantity');
    END`,
  `CREATE TRIGGER IF NOT EXISTS trg_cheki_items_quantity_before_move
    BEFORE UPDATE OF record_id ON cheki_items
    WHEN NEW.record_id <> OLD.record_id
     AND (
       SELECT COUNT(*) FROM cheki_items WHERE record_id = NEW.record_id
     ) >= (
       SELECT quantity FROM cheki_records WHERE id = NEW.record_id
     )
    BEGIN
      SELECT RAISE(ABORT, 'target cheki record is full');
    END`,
  `CREATE TRIGGER IF NOT EXISTS trg_cheki_records_quantity_before_update
    BEFORE UPDATE OF quantity ON cheki_records
    WHEN NEW.quantity < (
      SELECT COUNT(*) FROM cheki_items WHERE record_id = OLD.id
    )
    BEGIN
      SELECT RAISE(ABORT, 'cheki quantity is below archived item count');
    END`,
] as const;

import { CHEKI_SPEC_CHECK_SQL } from './chekiV2Schema';

export const CHEKI_WIDGET_GROUP_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS cheki_widget_groups (
    slot INTEGER PRIMARY KEY CHECK (slot BETWEEN 1 AND 6),
    name TEXT NOT NULL COLLATE NOCASE,
    source_type TEXT CHECK (source_type IS NULL OR source_type IN ('manual', 'filter')),
    favorite_only INTEGER NOT NULL DEFAULT 0 CHECK (favorite_only IN (0, 1)),
    date_preset TEXT CHECK (date_preset IS NULL OR date_preset IN ('current_month', 'current_year', 'custom')),
    custom_start_date TEXT,
    custom_end_date TEXT,
    rotation_anchor_at TEXT,
    collection_fingerprint TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((date_preset = 'custom' AND custom_start_date IS NOT NULL AND custom_end_date IS NOT NULL)
      OR (date_preset IS NULL AND custom_start_date IS NULL AND custom_end_date IS NULL)
      OR (date_preset IN ('current_month', 'current_year') AND custom_start_date IS NULL AND custom_end_date IS NULL))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_cheki_widget_groups_name
    ON cheki_widget_groups (name COLLATE NOCASE)`,
  `CREATE TABLE IF NOT EXISTS cheki_widget_group_manual_items (
    slot INTEGER NOT NULL REFERENCES cheki_widget_groups(slot) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES cheki_items(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    PRIMARY KEY (slot, item_id), UNIQUE (slot, sort_order)
  )`,
  `CREATE TABLE IF NOT EXISTS cheki_widget_group_artists (
    slot INTEGER NOT NULL REFERENCES cheki_widget_groups(slot) ON DELETE CASCADE,
    artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (slot, artist_id)
  )`,
  `CREATE TABLE IF NOT EXISTS cheki_widget_group_events (
    slot INTEGER NOT NULL REFERENCES cheki_widget_groups(slot) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    PRIMARY KEY (slot, event_id)
  )`,
  `CREATE TABLE IF NOT EXISTS cheki_widget_group_specs (
    slot INTEGER NOT NULL REFERENCES cheki_widget_groups(slot) ON DELETE CASCADE,
    spec TEXT NOT NULL CHECK (${CHEKI_SPEC_CHECK_SQL}),
    PRIMARY KEY (slot, spec)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_cheki_widget_group_manual_item ON cheki_widget_group_manual_items (item_id, slot)',
  'CREATE INDEX IF NOT EXISTS idx_cheki_widget_group_artist ON cheki_widget_group_artists (artist_id, slot)',
  'CREATE INDEX IF NOT EXISTS idx_cheki_widget_group_event ON cheki_widget_group_events (event_id, slot)',
  'CREATE INDEX IF NOT EXISTS idx_cheki_widget_group_spec ON cheki_widget_group_specs (spec, slot)',
] as const;

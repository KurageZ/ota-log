export function createArtistsTableSql(tableName = 'artists'): string {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    short_name       TEXT,
    artist_type      TEXT CHECK (artist_type IS NULL OR artist_type IN ('person', 'group')),
    avatar_uri       TEXT,
    background_uri   TEXT,
    background_color TEXT,
    url              TEXT,
    is_favorite      INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL
  )`;
}

export const ARTIST_RELATIONSHIP_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS artist_basic_affiliations (
    member_artist_id TEXT PRIMARY KEY REFERENCES artists(id) ON DELETE CASCADE,
    parent_artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    CHECK (member_artist_id != parent_artist_id)
  )`,

  `CREATE TABLE IF NOT EXISTS artist_group_memberships (
    id               TEXT PRIMARY KEY,
    person_artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    group_artist_id  TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    start_date       TEXT CHECK (
      start_date IS NULL OR (
        length(start_date) = 10
        AND start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND strftime('%Y-%m-%d', start_date) IS NOT NULL
        AND strftime('%Y-%m-%d', start_date) = start_date
      )
    ),
    end_date         TEXT CHECK (
      end_date IS NULL OR (
        length(end_date) = 10
        AND end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND strftime('%Y-%m-%d', end_date) IS NOT NULL
        AND strftime('%Y-%m-%d', end_date) = end_date
      )
    ),
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    CHECK (person_artist_id != group_artist_id),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_artist_basic_affiliations_parent
    ON artist_basic_affiliations (parent_artist_id, member_artist_id)`,

  `CREATE INDEX IF NOT EXISTS idx_artist_memberships_person_dates
    ON artist_group_memberships (person_artist_id, start_date, end_date, group_artist_id)`,

  `CREATE INDEX IF NOT EXISTS idx_artist_memberships_group_dates
    ON artist_group_memberships (group_artist_id, start_date, end_date, person_artist_id)`,
];

export const ARTIST_RELATIONSHIP_TRIGGER_STATEMENTS = [
  `CREATE TRIGGER IF NOT EXISTS trg_basic_affiliation_types_before_insert
    BEFORE INSERT ON artist_basic_affiliations
    WHEN (SELECT artist_type FROM artists WHERE id = NEW.member_artist_id) IS NOT NULL
      OR (SELECT artist_type FROM artists WHERE id = NEW.parent_artist_id) IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'basic affiliations require unset artist types');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_basic_affiliation_types_before_update
    BEFORE UPDATE ON artist_basic_affiliations
    WHEN (SELECT artist_type FROM artists WHERE id = NEW.member_artist_id) IS NOT NULL
      OR (SELECT artist_type FROM artists WHERE id = NEW.parent_artist_id) IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'basic affiliations require unset artist types');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_basic_affiliation_cycle_before_insert
    BEFORE INSERT ON artist_basic_affiliations
    WHEN EXISTS (
      WITH RECURSIVE ancestors(id) AS (
        SELECT NEW.parent_artist_id
        UNION
        SELECT relation.parent_artist_id
        FROM artist_basic_affiliations relation
        JOIN ancestors ON relation.member_artist_id = ancestors.id
      )
      SELECT 1 FROM ancestors WHERE id = NEW.member_artist_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'basic affiliation cycle');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_basic_affiliation_cycle_before_update
    BEFORE UPDATE OF parent_artist_id, member_artist_id ON artist_basic_affiliations
    WHEN EXISTS (
      WITH RECURSIVE ancestors(id) AS (
        SELECT NEW.parent_artist_id
        UNION
        SELECT relation.parent_artist_id
        FROM artist_basic_affiliations relation
        JOIN ancestors ON relation.member_artist_id = ancestors.id
        WHERE relation.member_artist_id != OLD.member_artist_id
      )
      SELECT 1 FROM ancestors WHERE id = NEW.member_artist_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'basic affiliation cycle');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_membership_types_before_insert
    BEFORE INSERT ON artist_group_memberships
    WHEN (SELECT artist_type FROM artists WHERE id = NEW.person_artist_id) IS NOT 'person'
      OR (SELECT artist_type FROM artists WHERE id = NEW.group_artist_id) IS NOT 'group'
    BEGIN
      SELECT RAISE(ABORT, 'group memberships require person and group types');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_membership_types_before_update
    BEFORE UPDATE ON artist_group_memberships
    WHEN (SELECT artist_type FROM artists WHERE id = NEW.person_artist_id) IS NOT 'person'
      OR (SELECT artist_type FROM artists WHERE id = NEW.group_artist_id) IS NOT 'group'
    BEGIN
      SELECT RAISE(ABORT, 'group memberships require person and group types');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_membership_overlap_before_insert
    BEFORE INSERT ON artist_group_memberships
    WHEN EXISTS (
      SELECT 1 FROM artist_group_memberships existing
      WHERE existing.person_artist_id = NEW.person_artist_id
        AND existing.group_artist_id = NEW.group_artist_id
        AND COALESCE(existing.end_date, '9999-12-31') >= COALESCE(NEW.start_date, '0001-01-01')
        AND COALESCE(NEW.end_date, '9999-12-31') >= COALESCE(existing.start_date, '0001-01-01')
    )
    BEGIN
      SELECT RAISE(ABORT, 'group membership periods overlap');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_membership_overlap_before_update
    BEFORE UPDATE OF person_artist_id, group_artist_id, start_date, end_date ON artist_group_memberships
    WHEN EXISTS (
      SELECT 1 FROM artist_group_memberships existing
      WHERE existing.id != OLD.id
        AND existing.person_artist_id = NEW.person_artist_id
        AND existing.group_artist_id = NEW.group_artist_id
        AND COALESCE(existing.end_date, '9999-12-31') >= COALESCE(NEW.start_date, '0001-01-01')
        AND COALESCE(NEW.end_date, '9999-12-31') >= COALESCE(existing.start_date, '0001-01-01')
    )
    BEGIN
      SELECT RAISE(ABORT, 'group membership periods overlap');
    END`,

  `CREATE TRIGGER IF NOT EXISTS trg_artist_type_relations_before_update
    BEFORE UPDATE OF artist_type ON artists
    WHEN (
      (EXISTS (
        SELECT 1 FROM artist_basic_affiliations relation
        WHERE relation.member_artist_id = OLD.id OR relation.parent_artist_id = OLD.id
      ) AND NEW.artist_type IS NOT NULL)
      OR (EXISTS (
        SELECT 1 FROM artist_group_memberships membership
        WHERE membership.person_artist_id = OLD.id
      ) AND NEW.artist_type IS NOT 'person')
      OR (EXISTS (
        SELECT 1 FROM artist_group_memberships membership
        WHERE membership.group_artist_id = OLD.id
      ) AND NEW.artist_type IS NOT 'group')
    )
    BEGIN
      SELECT RAISE(ABORT, 'artist type conflicts with existing relationships');
    END`,
];

export const ARTIST_ACTIVITY_ATTRIBUTION_VIEW_STATEMENTS = [
  `CREATE VIEW IF NOT EXISTS event_artist_attributions AS
    SELECT event_id, artist_id
    FROM event_artists
    UNION
    SELECT ea.event_id, membership.person_artist_id AS artist_id
    FROM event_artists ea
    JOIN artists source_group
      ON source_group.id = ea.artist_id AND source_group.artist_type = 'group'
    JOIN artist_group_memberships membership
      ON membership.group_artist_id = ea.artist_id
    JOIN artists person
      ON person.id = membership.person_artist_id AND person.artist_type = 'person'
    WHERE EXISTS (
      SELECT 1
      FROM event_sessions session
      WHERE session.event_id = ea.event_id
        AND (membership.start_date IS NULL
          OR COALESCE(session.end_date, session.session_date) >= membership.start_date)
        AND (membership.end_date IS NULL
          OR session.session_date <= membership.end_date)
    )`,
];

export const ARTIST_RELATIONSHIP_SCHEMA_STATEMENTS = [
  ...ARTIST_RELATIONSHIP_TABLE_STATEMENTS,
  ...ARTIST_RELATIONSHIP_TRIGGER_STATEMENTS,
];

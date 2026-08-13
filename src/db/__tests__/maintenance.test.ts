import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import {
  clearAllDatabaseRows,
  findOrphanArtistIds,
  removeOrphanArtists,
} from '../maintenance';
import { deleteLocalFileIfUnreferenced as mockDeleteLocalFileIfUnreferenced } from '../../utils/localMedia';

jest.mock('../../utils/localMedia', () => ({
  deleteLocalFileIfUnreferenced: jest.fn(async () => true),
}));

const mockedDeleteLocalFileIfUnreferenced =
  mockDeleteLocalFileIfUnreferenced as jest.MockedFunction<typeof mockDeleteLocalFileIfUnreferenced>;

const NOW = '2026-01-01T00:00:00.000Z';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const statement of SCHEMA_STATEMENTS) {
    db.exec(statement);
  }
  return db;
}

function insertArtist(
  db: Database.Database,
  id: string,
  name = id,
  parentId: string | null = null,
): void {
  db.prepare(
    `INSERT INTO artists
       (id, name, short_name, parent_id, avatar_uri, background_uri,
        background_color, url, is_favorite, created_at)
     VALUES (?, ?, NULL, ?, NULL, NULL, NULL, NULL, 0, ?)`,
  ).run(id, name, parentId, NOW);
}

function insertEvent(db: Database.Database, id: string): void {
  db.prepare(
    `INSERT INTO events
       (id, title, event_type, status, created_at, updated_at)
     VALUES (?, ?, 'livehouse', 'planned', ?, ?)`,
  ).run(id, `Event ${id}`, NOW, NOW);
  db.prepare(
    `INSERT INTO event_sessions
       (id, event_id, session_date, sort_order, created_at, updated_at)
     VALUES (?, ?, '2026-01-01', 0, ?, ?)`,
  ).run(`${id}-session`, id, NOW, NOW);
}

function insertChekiRecord(db: Database.Database, id: string, artistId: string | null): void {
  db.prepare(
    `INSERT INTO cheki_records
       (id, event_id, artist_id, date, quantity, notes, created_at, updated_at)
     VALUES (?, NULL, ?, NULL, 1, NULL, ?, ?)`,
  ).run(id, artistId, NOW, NOW);
}

function insertSeedData(db: Database.Database): void {
  insertArtist(db, 'artist-seed');
  db.prepare(
    `INSERT INTO trips
       (id, name, origin_city, dest_city, depart_date, return_date, notes, created_at, updated_at)
     VALUES ('trip-seed', 'Trip', NULL, NULL, NULL, NULL, NULL, ?, ?)`,
  ).run(NOW, NOW);
  insertEvent(db, 'event-seed');
  db.prepare(
    `INSERT INTO event_artists (event_id, artist_id, sort_order)
     VALUES ('event-seed', 'artist-seed', 0)`,
  ).run();
  db.prepare(
    `INSERT INTO event_timetable_entries
       (id, session_id, title, artist_id, start_time, end_time, notes, sort_order, created_at, updated_at)
     VALUES ('timetable-seed', 'event-seed-session', 'Stage', 'artist-seed', NULL, NULL, NULL, 0, ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO photos (id, event_id, local_uri, created_at)
     VALUES ('photo-seed', 'event-seed', 'file:///seed.jpg', ?)`,
  ).run(NOW);
  db.prepare(
    `INSERT INTO expenses (id, trip_id, event_id, category, amount, notes, created_at)
     VALUES ('expense-seed', NULL, 'event-seed', 'other', 100, NULL, ?)`,
  ).run(NOW);
  insertChekiRecord(db, 'cheki-seed', 'artist-seed');
  db.prepare(
    `INSERT INTO cheki_items
       (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, notes, created_at, updated_at)
     VALUES ('item-seed', 'cheki-seed', 0, 0, 54.0 / 86.0, 0, NULL, ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO cheki_item_images
       (id, item_id, side, photo_uri, created_at, updated_at)
     VALUES ('image-seed', 'item-seed', 'front', 'file:///seed-cheki.jpg', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO user_config
       (id, name, avatar_uri, avatar_emoji, oshi_artist_id, artist_confirmation_mode, updated_at)
     VALUES ('default', 'Seed User', NULL, '🎤', 'artist-seed', 'always', ?)`,
  ).run(NOW);
  db.prepare(
    `INSERT INTO important_dates
       (id, title, date, source_kind, linked_event_id, notes, show_on_calendar,
        reminder_enabled, reminder_offset_days, reminder_time, created_at, updated_at)
     VALUES ('date-seed', 'Date', '2026-01-01', 'manual', NULL, NULL, 1, 0, 0, '09:00', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO important_date_artists (important_date_id, artist_id)
     VALUES ('date-seed', 'artist-seed')`,
  ).run();
  db.prepare(
    `INSERT INTO important_date_anniversary_rules
       (id, important_date_id, anniversary_kind, anniversary_value, label, enabled, created_at, updated_at)
     VALUES ('anniversary-seed', 'date-seed', 'day', 1, 'Seed', 1, ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO scheduled_reminder_state
       (id, target_kind, target_id, notification_id, scheduled_for, updated_at)
     VALUES ('reminder-seed', 'important_date', 'date-seed', 'notification-seed', ?, ?)`,
  ).run(NOW, NOW);
}

function countRows(db: Database.Database, table: string): number {
  return db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() as number;
}

describe('clearAllDatabaseRows', () => {
  let db: Database.Database;

  beforeEach(() => {
    mockedDeleteLocalFileIfUnreferenced.mockClear();
    db = createDatabase();
  });

  afterEach(() => {
    db.close();
  });

  test('removes rows from every writable table and recreates the default user config', async () => {
    db.pragma('user_version = 20');
    insertSeedData(db);

    await clearAllDatabaseRows(createAsyncSQLiteAdapter(db));

    for (const table of [
      'artists',
      'trips',
      'events',
      'event_sessions',
      'event_timetable_entries',
      'event_artists',
      'photos',
      'expenses',
      'cheki_records',
      'cheki_items',
      'cheki_item_images',
      'important_dates',
      'important_date_artists',
      'important_date_anniversary_rules',
      'scheduled_reminder_state',
    ]) {
      expect(countRows(db, table)).toBe(0);
    }

    expect(countRows(db, 'user_config')).toBe(1);
    expect(
      db.prepare(
        `SELECT id, name, avatar_uri, avatar_emoji, oshi_artist_id,
                artist_confirmation_mode
         FROM user_config
         WHERE id = 'default'`,
      ).get(),
    ).toEqual({
      id: 'default',
      name: 'Otaku',
      avatar_uri: null,
      avatar_emoji: '🎤',
      oshi_artist_id: null,
      artist_confirmation_mode: 'always',
    });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('user_version', { simple: true })).toBe(20);
  });
});

describe('orphan artist maintenance', () => {
  let db: Database.Database;

  beforeEach(() => {
    mockedDeleteLocalFileIfUnreferenced.mockClear();
    db = createDatabase();
  });

  afterEach(() => {
    db.close();
  });

  test('finds artists that are not connected to any activity, cheki, date, or oshi reference', async () => {
    insertArtist(db, 'event-artist', 'Event Artist');
    insertArtist(db, 'timetable-artist', 'Timetable Artist');
    insertArtist(db, 'cheki-artist', 'Cheki Artist');
    insertArtist(db, 'date-artist', 'Date Artist');
    insertArtist(db, 'oshi-artist', 'Oshi Artist');
    insertArtist(db, 'orphan', 'Orphan');

    insertArtist(db, 'used-group', 'Used Group');
    insertArtist(db, 'group-member', 'Group Member', 'used-group');

    insertArtist(db, 'member-parent', 'Member Parent');
    insertArtist(db, 'used-member', 'Used Member', 'member-parent');
    insertArtist(db, 'member-sibling', 'Member Sibling', 'member-parent');

    insertArtist(db, 'isolated-parent', 'Isolated Parent');
    insertArtist(db, 'isolated-child', 'Isolated Child', 'isolated-parent');

    insertEvent(db, 'event');
    db.prepare(
      `INSERT INTO event_artists (event_id, artist_id, sort_order)
       VALUES ('event', 'event-artist', 0),
              ('event', 'used-group', 1)`,
    ).run();
    db.prepare(
      `INSERT INTO event_timetable_entries
         (id, session_id, title, artist_id, sort_order, created_at, updated_at)
       VALUES ('timetable', 'event-session', 'Stage', 'timetable-artist', 0, ?, ?)`,
    ).run(NOW, NOW);
    insertChekiRecord(db, 'cheki-record', 'cheki-artist');
    insertChekiRecord(db, 'cheki-member', 'used-member');

    db.prepare(
      `INSERT INTO important_dates
         (id, title, date, source_kind, linked_event_id, show_on_calendar,
          reminder_enabled, reminder_offset_days, reminder_time, created_at, updated_at)
       VALUES ('date', 'Date', '2026-01-01', 'manual', NULL, 1, 0, 0, '09:00', ?, ?)`,
    ).run(NOW, NOW);
    db.prepare(
      `INSERT INTO important_date_artists (important_date_id, artist_id)
       VALUES ('date', 'date-artist')`,
    ).run();
    db.prepare(
      `INSERT INTO user_config
         (id, name, avatar_uri, avatar_emoji, oshi_artist_id, artist_confirmation_mode, updated_at)
       VALUES ('default', 'Otaku', NULL, '🎤', 'oshi-artist', 'always', ?)`,
    ).run(NOW);

    const orphanIds = await findOrphanArtistIds(createAsyncSQLiteAdapter(db));

    expect(orphanIds.sort()).toEqual([
      'isolated-child',
      'isolated-parent',
      'orphan',
    ]);
  });

  test('removes orphan artists while preserving connected parent and member groups', async () => {
    insertArtist(db, 'used-artist', 'Used Artist');
    insertArtist(db, 'used-group', 'Used Group');
    insertArtist(db, 'used-member', 'Used Member', 'used-group');
    insertArtist(db, 'sibling', 'Sibling', 'used-group');
    insertArtist(db, 'orphan-parent', 'Orphan Parent');
    insertArtist(db, 'orphan-child', 'Orphan Child', 'orphan-parent');

    insertEvent(db, 'event');
    db.prepare(
      `INSERT INTO event_artists (event_id, artist_id, sort_order)
       VALUES ('event', 'used-artist', 0),
              ('event', 'used-group', 1)`,
    ).run();
    insertChekiRecord(db, 'cheki-used', 'used-member');

    const removed = await removeOrphanArtists(createAsyncSQLiteAdapter(db));

    expect(removed).toBe(2);
    expect(
      db.prepare('SELECT id FROM artists ORDER BY id').all().map((row) => (row as { id: string }).id),
    ).toEqual([
      'sibling',
      'used-artist',
      'used-group',
      'used-member',
    ]);
    expect(mockedDeleteLocalFileIfUnreferenced).toHaveBeenCalledTimes(4);
  });
});

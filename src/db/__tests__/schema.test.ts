import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';

function names(db: Database.Database, type: 'table' | 'index' | 'trigger' | 'view'): string[] {
  return (db.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all(type) as Array<{ name: string }>)
    .map((row) => row.name);
}

function columns(db: Database.Database, table: string): string[] {
  return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
}

describe('Fresh database schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
    db.exec(`INSERT INTO artists
      (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
      VALUES ('artist', 'Artist', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-01-01T00:00:00.000Z')`);
  });

  afterEach(() => db.close());

  test('contains only the three v2 cheki tables', () => {
    expect(names(db, 'table')).toEqual(expect.arrayContaining([
      'cheki_records',
      'cheki_items',
      'cheki_item_images',
    ]));
    expect(names(db, 'table')).not.toEqual(expect.arrayContaining(['cheki', 'cheki_manual_entries']));
  });

  test('creates the activity v2 root, sessions, timetable, and compatibility views', () => {
    expect(columns(db, 'artists')).toEqual([
      'id', 'name', 'short_name', 'artist_type', 'avatar_uri', 'background_uri',
      'background_color', 'url', 'is_favorite', 'created_at',
    ]);
    expect(columns(db, 'artist_basic_affiliations')).toEqual([
      'member_artist_id', 'parent_artist_id', 'created_at', 'updated_at',
    ]);
    expect(columns(db, 'artist_group_memberships')).toEqual([
      'id', 'person_artist_id', 'group_artist_id', 'start_date', 'end_date',
      'created_at', 'updated_at',
    ]);
    expect(columns(db, 'events')).toEqual([
      'id', 'title', 'event_type', 'status', 'review_score', 'notes', 'details',
      'url', 'setlist_text', 'actual_expense', 'trip_id', 'created_at', 'updated_at',
    ]);
    expect(columns(db, 'event_sessions')).toEqual([
      'id', 'event_id', 'title', 'session_date', 'end_date', 'open_time',
      'start_time', 'end_time', 'city', 'venue', 'sort_order', 'created_at', 'updated_at',
    ]);
    expect(names(db, 'table')).not.toContain('event_timetable_sections');
    expect(columns(db, 'event_timetable_entries')).toEqual([
      'id', 'session_id', 'title', 'artist_id', 'start_time', 'end_time',
      'notes', 'sort_order', 'created_at', 'updated_at',
    ]);
    expect(columns(db, 'event_artists')).toEqual([
      'event_id', 'artist_id', 'sort_order',
    ]);
    expect(names(db, 'index')).toEqual(expect.arrayContaining([
      'idx_event_sessions_event_sort',
      'idx_event_sessions_date',
      'idx_event_timetable_entries_session',
    ]));
    expect(names(db, 'view')).toEqual(expect.arrayContaining([
      'event_first_summaries',
      'event_summaries',
      'event_artist_attributions',
    ]));
  });

  test('enforces artist type and relationship invariants', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const insertArtist = db.prepare(`INSERT INTO artists
      (id, name, artist_type, created_at) VALUES (?, ?, ?, ?)`);
    insertArtist.run('unset-parent', 'Unset Parent', null, now);
    insertArtist.run('unset-child', 'Unset Child', null, now);
    insertArtist.run('person', 'Person', 'person', now);
    insertArtist.run('group', 'Group', 'group', now);

    db.prepare(`INSERT INTO artist_basic_affiliations
      (member_artist_id, parent_artist_id, created_at, updated_at)
      VALUES ('unset-child', 'unset-parent', ?, ?)`).run(now, now);
    expect(() => db.prepare(`INSERT INTO artist_basic_affiliations
      (member_artist_id, parent_artist_id, created_at, updated_at)
      VALUES ('unset-parent', 'unset-child', ?, ?)`).run(now, now)).toThrow('basic affiliation cycle');
    expect(() => db.prepare(`INSERT INTO artist_basic_affiliations
      (member_artist_id, parent_artist_id, created_at, updated_at)
      VALUES ('person', 'unset-parent', ?, ?)`).run(now, now)).toThrow(
      'basic affiliations require unset artist types',
    );

    db.prepare(`INSERT INTO artist_group_memberships
      (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
      VALUES ('membership', 'person', 'group', '2025-01-01', '2025-12-31', ?, ?)`).run(now, now);
    expect(() => db.prepare(`INSERT INTO artist_group_memberships
      (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
      VALUES ('invalid-calendar-date', 'person', 'group', '2026-02-31', NULL, ?, ?)`).run(now, now))
      .toThrow();
    expect(() => db.prepare(`INSERT INTO artist_group_memberships
      (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
      VALUES ('invalid-date-format', 'person', 'group', '2026/01/01', NULL, ?, ?)`).run(now, now))
      .toThrow();
    expect(() => db.prepare(`INSERT INTO artist_group_memberships
      (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
      VALUES ('overlap', 'person', 'group', '2025-12-31', NULL, ?, ?)`).run(now, now))
      .toThrow('group membership periods overlap');
    db.prepare(`INSERT INTO artist_group_memberships
      (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
      VALUES ('adjacent', 'person', 'group', '2026-01-01', NULL, ?, ?)`).run(now, now);
    expect(() => db.prepare("UPDATE artists SET artist_type = NULL WHERE id = 'person'").run())
      .toThrow('artist type conflicts with existing relationships');
  });

  test('enforces activity session and timetable aggregate constraints', () => {
    const now = '2026-01-01T00:00:00.000Z';
    db.prepare(`INSERT INTO events
      (id, title, event_type, status, actual_expense, created_at, updated_at)
      VALUES ('event', 'Event', 'livehouse', 'planned', 120, ?, ?)`).run(now, now);
    const insertSession = db.prepare(`INSERT INTO event_sessions
      (id, event_id, session_date, end_date, sort_order, created_at, updated_at)
      VALUES (?, 'event', ?, ?, ?, ?, ?)`);
    expect(() => insertSession.run('bad-date', '', null, 0, now, now)).toThrow();
    expect(() => insertSession.run('bad-end', '2026-03-02', '2026-03-01', 0, now, now)).toThrow();
    insertSession.run('day-1', '2026-03-02', null, 0, now, now);
    insertSession.run('day-2', '2026-03-03', null, 1, now, now);
    expect(() => insertSession.run('duplicate-order', '2026-03-04', null, 1, now, now)).toThrow();

    db.prepare(`INSERT INTO event_timetable_entries
      (id, session_id, title, artist_id, start_time, sort_order, created_at, updated_at)
      VALUES ('entry', 'day-1', 'Artist', 'artist', '12:00', 0, ?, ?)`).run(now, now);

    expect(db.prepare(`SELECT event_date, event_time, city, venue, ticket_price
      FROM event_first_summaries WHERE id = 'event'`).get()).toEqual({
      event_date: '2026-03-02',
      event_time: null,
      city: null,
      venue: null,
      ticket_price: 120,
    });

    db.prepare("DELETE FROM artists WHERE id = 'artist'").run();
    expect(db.prepare("SELECT artist_id FROM event_timetable_entries WHERE id = 'entry'").get())
      .toEqual({ artist_id: null });
    db.prepare("DELETE FROM event_sessions WHERE id = 'day-1'").run();
    expect(db.prepare("SELECT COUNT(*) AS count FROM event_timetable_entries").get())
      .toEqual({ count: 0 });
  });

  test('creates all fields, indexes, foreign keys, and triggers', () => {
    expect(columns(db, 'cheki_records')).toEqual([
      'id', 'event_id', 'artist_id', 'date', 'quantity',
      'notes', 'created_at', 'updated_at',
    ]);
    expect(columns(db, 'cheki_items')).toEqual([
      'id', 'record_id', 'sort_order', 'unit_price', 'spec', 'is_favorite',
      'notes', 'created_at', 'updated_at',
    ]);
    expect(columns(db, 'cheki_item_images')).toEqual([
      'id', 'item_id', 'side', 'photo_uri', 'created_at', 'updated_at',
    ]);
    expect(names(db, 'index')).toEqual(expect.arrayContaining([
      'idx_cheki_records_sort_date',
      'idx_cheki_records_artist_sort',
      'idx_cheki_records_event_sort',
    ]));
    expect(names(db, 'trigger')).toEqual(expect.arrayContaining([
      'trg_cheki_items_quantity_before_insert',
      'trg_cheki_items_quantity_before_move',
      'trg_cheki_records_quantity_before_update',
    ]));
    expect(db.pragma('foreign_key_list(cheki_records)')).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'artists', from: 'artist_id', on_delete: 'SET NULL' }),
      expect.objectContaining({ table: 'events', from: 'event_id', on_delete: 'SET NULL' }),
    ]));
  });

  test('enforces numeric, favorite, image-side, and uniqueness constraints', () => {
    const insertRecord = db.prepare(`INSERT INTO cheki_records
      (id, artist_id, quantity, created_at, updated_at)
      VALUES (?, 'artist', ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`);
    insertRecord.run('record', 2);
    const insertItem = db.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, unit_price, spec, is_favorite, created_at, updated_at)
      VALUES (?, 'record', ?, ?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`);
    expect(() => insertItem.run('negative-price', 0, -1, 'three_inch_portrait', 0)).toThrow();
    expect(() => insertItem.run('fractional-price', 0, 1.5, 'three_inch_portrait', 0)).toThrow();
    expect(() => insertItem.run('bad-spec', 0, 0, 'custom', 0)).toThrow();
    expect(() => insertItem.run('bad-favorite', 0, 0, 'three_inch_portrait', 2)).toThrow();
    insertItem.run('item', 0, 20, 'three_inch_portrait', 0);
    const insertImage = db.prepare(`INSERT INTO cheki_item_images
      (id, item_id, side, photo_uri, created_at, updated_at)
      VALUES (?, 'item', ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`);
    expect(() => insertImage.run('bad-side', 'left', 'file:///left.jpg')).toThrow();
    insertImage.run('front', 'front', 'file:///front.jpg');
    expect(() => insertImage.run('front-2', 'front', 'file:///front-2.jpg')).toThrow();
  });

  test('protects aggregate capacity, quantity reduction, moves, and keeps image-less items', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const insertRecord = db.prepare(`INSERT INTO cheki_records
      (id, quantity, created_at, updated_at) VALUES (?, ?, ?, ?)`);
    insertRecord.run('source', 2, now, now);
    insertRecord.run('full', 1, now, now);
    const insertItem = db.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`);
    insertItem.run('source-1', 'source', 0, now, now);
    insertItem.run('source-2', 'source', 1, now, now);
    expect(() => insertItem.run('source-3', 'source', 2, now, now)).toThrow(
      'cheki item count exceeds record quantity',
    );
    insertItem.run('full-1', 'full', 0, now, now);
    expect(() => db.prepare('UPDATE cheki_items SET record_id = ? WHERE id = ?').run('full', 'source-1'))
      .toThrow('target cheki record is full');
    expect(() => db.prepare('UPDATE cheki_records SET quantity = 1 WHERE id = ?').run('source'))
      .toThrow('cheki quantity is below archived item count');

    db.prepare(`INSERT INTO cheki_item_images
      (id, item_id, side, photo_uri, created_at, updated_at)
      VALUES (?, 'source-1', ?, ?, ?, ?)`).run('front', 'front', 'file:///front.jpg', now, now);
    db.prepare(`INSERT INTO cheki_item_images
      (id, item_id, side, photo_uri, created_at, updated_at)
      VALUES (?, 'source-1', ?, ?, ?, ?)`).run('back', 'back', 'file:///back.jpg', now, now);
    db.prepare("DELETE FROM cheki_item_images WHERE item_id = 'source-1' AND side = 'front'").run();
    expect(db.prepare("SELECT COUNT(*) AS count FROM cheki_items WHERE id = 'source-1'").get())
      .toEqual({ count: 1 });
    db.prepare("DELETE FROM cheki_item_images WHERE item_id = 'source-1' AND side = 'back'").run();
    expect(db.prepare("SELECT COUNT(*) AS count FROM cheki_items WHERE id = 'source-1'").get())
      .toEqual({ count: 1 });
  });

  test('keeps records when their artist is deleted and cascades records to items and images', () => {
    const now = '2026-01-01T00:00:00.000Z';
    db.prepare(`INSERT INTO cheki_records
      (id, artist_id, quantity, created_at, updated_at)
      VALUES ('record', 'artist', 1, ?, ?)`).run(now, now);
    db.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, created_at, updated_at)
      VALUES ('item', 'record', 0, ?, ?)`).run(now, now);
    db.prepare(`INSERT INTO cheki_item_images
      (id, item_id, side, photo_uri, created_at, updated_at)
      VALUES ('image', 'item', 'front', 'file:///front.jpg', ?, ?)`).run(now, now);
    db.prepare("DELETE FROM artists WHERE id = 'artist'").run();
    expect(db.prepare("SELECT artist_id FROM cheki_records WHERE id = 'record'").get())
      .toEqual({ artist_id: null });
    db.prepare("DELETE FROM cheki_records WHERE id = 'record'").run();
    expect(db.prepare('SELECT COUNT(*) AS count FROM cheki_items').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM cheki_item_images').get()).toEqual({ count: 0 });
  });
});

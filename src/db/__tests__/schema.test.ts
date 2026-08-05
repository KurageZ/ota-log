import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';

function names(db: Database.Database, type: 'table' | 'index' | 'trigger'): string[] {
  return (db.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all(type) as Array<{ name: string }>)
    .map((row) => row.name);
}

function columns(db: Database.Database, table: string): string[] {
  return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
}

describe('Fresh cheki v2 schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
    db.exec(`INSERT INTO artists
      (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
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

  test('creates all fields, indexes, foreign keys, and triggers', () => {
    expect(columns(db, 'cheki_records')).toEqual([
      'id', 'event_id', 'artist_id', 'date', 'quantity',
      'notes', 'created_at', 'updated_at',
    ]);
    expect(columns(db, 'cheki_items')).toEqual([
      'id', 'record_id', 'sort_order', 'unit_price', 'display_aspect_ratio', 'is_favorite',
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
      (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, created_at, updated_at)
      VALUES (?, 'record', ?, ?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`);
    expect(() => insertItem.run('negative-price', 0, -1, 54 / 86, 0)).toThrow();
    expect(() => insertItem.run('fractional-price', 0, 1.5, 54 / 86, 0)).toThrow();
    expect(() => insertItem.run('zero-ratio', 0, 0, 0, 0)).toThrow();
    expect(() => insertItem.run('bad-favorite', 0, 0, 54 / 86, 2)).toThrow();
    insertItem.run('item', 0, 20, 54 / 86, 0);
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

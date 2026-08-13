import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

describe('Cheki v21 spec migration', () => {
  test('drops the development ratio and preserves item data and images with the default spec', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = OFF');
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
    db.exec(`
      DROP TABLE cheki_item_images;
      DROP TABLE cheki_items;
      CREATE TABLE cheki_items (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL REFERENCES cheki_records(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        unit_price INTEGER NOT NULL DEFAULT 0,
        display_aspect_ratio REAL NOT NULL DEFAULT (54.0 / 86.0),
        is_favorite INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (record_id, sort_order)
      );
      CREATE TABLE cheki_item_images (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES cheki_items(id) ON DELETE CASCADE,
        side TEXT NOT NULL CHECK (side IN ('front', 'back')),
        photo_uri TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (item_id, side)
      );
    `);
    const now = '2026-08-01T00:00:00.000Z';
    db.prepare(`INSERT INTO cheki_records
      (id, quantity, notes, created_at, updated_at) VALUES ('record', 1, 'record note', ?, ?)`)
      .run(now, now);
    db.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, notes, created_at, updated_at)
      VALUES ('item', 'record', 0, 80, 1.234, 1, 'item note', ?, ?)`)
      .run(now, now);
    db.prepare(`INSERT INTO cheki_item_images
      (id, item_id, side, photo_uri, created_at, updated_at)
      VALUES ('image', 'item', 'front', 'file:///front.jpg', ?, ?)`)
      .run(now, now);
    db.pragma('user_version = 20');
    db.pragma('foreign_keys = ON');

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(db.pragma('user_version', { simple: true })).toBe(22);
    expect(db.prepare(`PRAGMA table_info('cheki_items')`).all().map((row) => (row as { name: string }).name))
      .toEqual(['id', 'record_id', 'sort_order', 'unit_price', 'spec', 'is_favorite', 'notes', 'created_at', 'updated_at']);
    expect(db.prepare(`SELECT unit_price, spec, is_favorite, notes FROM cheki_items WHERE id = 'item'`).get())
      .toEqual({ unit_price: 80, spec: 'three_inch_portrait', is_favorite: 1, notes: 'item note' });
    expect(db.prepare(`SELECT item_id, side, photo_uri FROM cheki_item_images WHERE id = 'image'`).get())
      .toEqual({ item_id: 'item', side: 'front', photo_uri: 'file:///front.jpg' });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });
});

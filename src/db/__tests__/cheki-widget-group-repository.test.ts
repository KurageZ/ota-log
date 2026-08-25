import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { ChekiWidgetGroupRepository } from '../../repositories/ChekiWidgetGroupRepository';

async function setup() {
  const raw = new Database(':memory:');
  const db = createAsyncSQLiteAdapter(raw);
  await runMigrations(db);
  await db.runAsync(`INSERT INTO artists (id, name, artist_type, is_favorite, created_at) VALUES ('artist-1', 'A', 'person', 0, '2026-01-01T00:00:00.000Z')`);
  await db.runAsync(`INSERT INTO events (id, title, event_type, status, created_at, updated_at) VALUES ('event-1', 'E', 'concert', 'completed', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`);
  await db.runAsync(`INSERT INTO cheki_records (id, event_id, artist_id, date, quantity, created_at, updated_at) VALUES ('record-1', 'event-1', 'artist-1', '2026-08-20', 2, '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z')`);
  await db.runAsync(`INSERT INTO cheki_items (id, record_id, sort_order, unit_price, spec, created_at, updated_at) VALUES ('item-1', 'record-1', 0, 0, 'square', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z')`);
  await db.runAsync(`INSERT INTO cheki_items (id, record_id, sort_order, unit_price, spec, is_favorite, created_at, updated_at) VALUES ('item-2', 'record-1', 1, 0, 'square', 1, '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z')`);
  await db.runAsync(`INSERT INTO cheki_item_images (id, item_id, side, photo_uri, created_at, updated_at) VALUES ('image-1', 'item-1', 'front', 'file:///one.jpg', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z')`);
  await db.runAsync(`INSERT INTO cheki_item_images (id, item_id, side, photo_uri, created_at, updated_at) VALUES ('image-2', 'item-2', 'front', 'file:///two.jpg', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z')`);
  return { raw, db, repository: new ChekiWidgetGroupRepository(db) };
}

describe('ChekiWidgetGroupRepository', () => {
  test('fresh migration creates six unconfigured slots', async () => {
    const { db } = await setup();
    expect(await db.getAllAsync('SELECT slot FROM cheki_widget_groups ORDER BY slot')).toHaveLength(6);
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(23);
  });

  test('upgrades a representative v22 database and preserves existing cheki data', async () => {
    const { raw, db } = await setup();
    raw.exec(`
      DROP TABLE cheki_widget_group_manual_items;
      DROP TABLE cheki_widget_group_artists;
      DROP TABLE cheki_widget_group_events;
      DROP TABLE cheki_widget_group_specs;
      DROP TABLE cheki_widget_groups;
    `);
    raw.pragma('user_version = 22');

    await runMigrations(db);

    expect(raw.pragma('user_version', { simple: true })).toBe(23);
    expect(raw.prepare('SELECT slot, name, source_type FROM cheki_widget_groups ORDER BY slot').all())
      .toEqual(Array.from({ length: 6 }, (_, index) => ({
        slot: index + 1,
        name: `分组 ${index + 1}`,
        source_type: null,
      })));
    expect(raw.prepare("SELECT photo_uri FROM cheki_item_images WHERE id = 'image-1'").pluck().get())
      .toBe('file:///one.jpg');
  });

  test('manual groups preserve order and only resolve front images', async () => {
    const { repository } = await setup();
    await repository.save(1, { name: '精选', source: { type: 'manual', itemIds: ['item-2', 'item-1'] } }, new Date('2026-08-21T00:00:00.000Z'));
    const state = await repository.getEditorState(1);
    expect(state.resolvedItems.map((item) => item.id)).toEqual(['item-2', 'item-1']);
    expect((await repository.listSummaries())[0].displayCount).toBe(2);
  });

  test('filter conditions use AND across categories and OR within a category', async () => {
    const { repository } = await setup();
    await repository.save(2, { name: '收藏', source: { type: 'filter', rules: { artistIds: ['artist-1'], eventIds: ['event-1'], favoriteOnly: true, date: null, specs: ['square'] } } }, new Date('2026-08-21T00:00:00.000Z'));
    const resolved = await repository.resolveForWidget(new Date('2026-08-21T00:00:00.000Z'));
    expect(resolved[1].items.map((item) => item.id)).toEqual(['item-2']);
  });

  test('allows renaming an existing filter after its current results become empty', async () => {
    const { db, repository } = await setup();
    const source = { type: 'filter' as const, rules: { artistIds: [], eventIds: [], favoriteOnly: true, date: null, specs: [] } };
    await repository.save(1, { name: '收藏', source }, new Date('2026-08-21T00:05:00.000Z'));
    await db.runAsync("UPDATE cheki_items SET is_favorite = 0 WHERE id = 'item-2'");

    await expect(repository.save(1, { name: '旧收藏', source }, new Date('2026-08-21T00:35:00.000Z'))).resolves.toBeUndefined();
    const resolved = (await repository.resolveForWidget(new Date('2026-08-21T00:35:00.000Z')))[0];
    expect(resolved.name).toBe('旧收藏');
    expect(resolved.state).toBe('no_match');
  });

  test('preserves the rotation anchor unless the final ordered collection changes', async () => {
    const { db, repository } = await setup();
    await repository.save(1, { name: '精选', source: { type: 'manual', itemIds: ['item-1', 'item-2'] } }, new Date('2026-08-21T00:17:00.000Z'));
    const initial = await db.getFirstAsync<{ rotation_anchor_at: string; collection_fingerprint: string }>(
      'SELECT rotation_anchor_at, collection_fingerprint FROM cheki_widget_groups WHERE slot = 1',
    );

    await repository.save(1, { name: '精选改名', source: { type: 'manual', itemIds: ['item-1', 'item-2'] } }, new Date('2026-08-21T00:47:00.000Z'));
    const renamed = await db.getFirstAsync<{ rotation_anchor_at: string; collection_fingerprint: string }>(
      'SELECT rotation_anchor_at, collection_fingerprint FROM cheki_widget_groups WHERE slot = 1',
    );
    expect(renamed).toEqual(initial);

    await repository.save(1, { name: '精选改名', source: { type: 'manual', itemIds: ['item-2', 'item-1'] } }, new Date('2026-08-21T01:05:00.000Z'));
    const reordered = await db.getFirstAsync<{ rotation_anchor_at: string; collection_fingerprint: string }>(
      'SELECT rotation_anchor_at, collection_fingerprint FROM cheki_widget_groups WHERE slot = 1',
    );
    expect(reordered?.rotation_anchor_at).toBe('2026-08-21T01:00:00.000Z');
    expect(reordered?.collection_fingerprint).not.toBe(initial?.collection_fingerprint);
  });

  test('distinguishes unavailable manual groups from filters with no matches', async () => {
    const { db, repository } = await setup();
    await repository.save(1, { name: '手动', source: { type: 'manual', itemIds: ['item-1'] } });
    await repository.save(2, { name: '收藏', source: { type: 'filter', rules: { artistIds: [], eventIds: [], favoriteOnly: true, date: null, specs: [] } } });
    await db.runAsync("DELETE FROM cheki_item_images WHERE item_id = 'item-1'");
    await db.runAsync("UPDATE cheki_items SET is_favorite = 0 WHERE id = 'item-2'");

    const resolved = await repository.resolveForWidget();
    expect(resolved[0].state).toBe('unavailable');
    expect(resolved[1].state).toBe('no_match');
  });

  test('previews unsaved filter rules without persisting them', async () => {
    const { repository } = await setup();
    const items = await repository.previewSource(1, {
      type: 'filter',
      rules: {
        artistIds: [],
        eventIds: [],
        favoriteOnly: true,
        date: null,
        specs: [],
      },
    }, new Date('2026-08-21T00:00:00.000Z'));

    expect(items.map((item) => item.id)).toEqual(['item-2']);
    expect((await repository.getEditorState(1)).source).toBeNull();
  });

  test('rejects duplicate names and empty filters', async () => {
    const { repository } = await setup();
    await expect(repository.save(1, { name: '分组 2', source: { type: 'manual', itemIds: ['item-1'] } })).rejects.toThrow('分组名称不能重复');
    await expect(repository.save(1, { name: '空筛选', source: { type: 'filter', rules: { artistIds: [], eventIds: [], favoriteOnly: false, date: null, specs: [] } } })).rejects.toThrow('至少需要一个条件');
    await expect(repository.save(1, { name: '无结果', source: { type: 'filter', rules: { artistIds: ['missing'], eventIds: [], favoriteOnly: false, date: null, specs: [] } } })).rejects.toThrow('至少需要 1 张');
  });
});

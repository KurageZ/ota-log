import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { ChekiRecordRepository } from '../../repositories/ChekiRecordRepository';

describe('ChekiRecordRepository', () => {
  let raw: Database.Database;
  let repository: ChekiRecordRepository;
  let nextId: number;

  beforeEach(() => {
    raw = new Database(':memory:');
    raw.pragma('foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) raw.exec(statement);
    nextId = 0;
    repository = new ChekiRecordRepository(
      createAsyncSQLiteAdapter(raw),
      () => `id-${nextId++}`,
    );
  });

  afterEach(() => raw.close());

  test('creates one physical item per quantity with a shared integer unit price', async () => {
    const record = await repository.createRecord({ quantity: 3, unit_price: 80 });
    const created = await repository.findRecordById(record.id);

    expect(created?.quantity).toBe(3);
    expect(created?.items).toHaveLength(3);
    expect(created?.items.map((item) => item.unit_price)).toEqual([80, 80, 80]);
    expect(created?.items.every((item) => item.images.length === 0)).toBe(true);
  });

  test('creates a batch with separate artists, shared event and date, and per-artist prices', async () => {
    raw.prepare("INSERT INTO artists (id, name, created_at) VALUES (?, ?, '2026-10-09T00:00:00.000Z')").run('artist-a', 'A');
    raw.prepare("INSERT INTO artists (id, name, created_at) VALUES (?, ?, '2026-10-09T00:00:00.000Z')").run('artist-b', 'B');
    raw.prepare("INSERT INTO events (id, title, status, created_at, updated_at) VALUES (?, ?, 'completed', '2026-10-09T00:00:00.000Z', '2026-10-09T00:00:00.000Z')").run('event-a', 'Live');
    const listener = jest.fn();
    repository.subscribeToChanges(listener);
    const records = await repository.createRecords([
      { event_id: 'event-a', date: '2026-10-09', artist_id: 'artist-a', quantity: 3, unit_price: 100 },
      { event_id: 'event-a', date: '2026-10-09', artist_id: 'artist-b', quantity: 2, unit_price: 0 },
    ]);
    expect(records).toHaveLength(2);
    const saved = await repository.findRecords({ eventId: 'event-a' });
    expect(saved).toHaveLength(2);
    expect(saved.map((record) => record.date)).toEqual(['2026-10-09', '2026-10-09']);
    expect(saved.find((record) => record.artist_id === 'artist-a')?.items.map((item) => item.unit_price)).toEqual([100, 100, 100]);
    expect(saved.find((record) => record.artist_id === 'artist-b')?.items.map((item) => item.unit_price)).toEqual([0, 0]);
    expect(saved.every((record) => record.items.every((item) => item.images.length === 0))).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('rolls back the entire batch on a later write failure and allows retry', async () => {
    const adapter = createAsyncSQLiteAdapter(raw);
    let itemInserts = 0;
    const failingAdapter = {
      ...adapter,
      runAsync: async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO cheki_items') && ++itemInserts === 2) throw new Error('write failed');
        return adapter.runAsync(sql, params as never);
      },
    };
    const failing = new ChekiRecordRepository(failingAdapter as typeof adapter, () => `batch-${nextId++}`);
    const listener = jest.fn();
    failing.subscribeToChanges(listener);
    const inputs = [{ quantity: 1, unit_price: 10 }, { quantity: 2, unit_price: 20 }];
    await expect(failing.createRecords(inputs)).rejects.toThrow('write failed');
    expect(raw.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM cheki_items').get()).toEqual({ count: 0 });
    expect(listener).not.toHaveBeenCalled();
    await failing.createRecords(inputs);
    expect(await repository.findRecords()).toHaveLength(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('treats an omitted unit price as zero and rejects invalid prices', async () => {
    const record = await repository.createRecord({ quantity: 1 });
    expect((await repository.findRecordById(record.id))?.items[0]?.unit_price).toBe(0);

    await expect(repository.createRecord({ quantity: 1, unit_price: 1.5 }))
      .rejects.toThrow('non-negative integer');
    await expect(repository.createRecord({ quantity: 1, unit_price: -1 }))
      .rejects.toThrow('non-negative integer');
  });

  test('creates initial images without changing the physical item count', async () => {
    const record = await repository.createRecordWithItems({
      quantity: 3,
      unit_price: 30,
      items: [
        { frontUri: 'file:///1.jpg' },
        { frontUri: 'file:///2.jpg', unitPrice: 40 },
      ],
    });

    expect(record.items).toHaveLength(3);
    expect(record.items.map((item) => item.unit_price)).toEqual([30, 40, 30]);
    expect(record.items.map((item) => item.images[0]?.photo_uri ?? null)).toEqual([
      'file:///1.jpg',
      'file:///2.jpg',
      null,
    ]);
  });

  test('rolls back the record when an initial image insert fails', async () => {
    const adapter = createAsyncSQLiteAdapter(raw);
    const failingAdapter = {
      ...adapter,
      runAsync: async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO cheki_item_images')) throw new Error('image insert failed');
        return adapter.runAsync(sql, params as never);
      },
    };
    repository = new ChekiRecordRepository(failingAdapter as typeof adapter, () => `failure-${nextId++}`);

    await expect(repository.createRecordWithItems({
      quantity: 1,
      items: [{ frontUri: 'file:///failure.jpg' }],
    })).rejects.toThrow('image insert failed');
    expect(raw.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM cheki_items').get()).toEqual({ count: 0 });
  });

  test('resizes a record, creates priced blank items, and fills available image slots', async () => {
    const record = await repository.createRecord({ quantity: 1, unit_price: 10 });
    await repository.updateRecordWithItemChanges(
      record.id,
      { quantity: 2 },
      { add: [{ frontUri: 'file:///added.jpg' }], defaultUnitPrice: 20 },
    );

    const updated = await repository.findRecordById(record.id);
    expect(updated?.quantity).toBe(2);
    expect(updated?.items).toHaveLength(2);
    expect(updated?.items.map((item) => item.unit_price)).toEqual([10, 20]);
    expect(updated?.items.flatMap((item) => item.images.map((image) => image.photo_uri)))
      .toEqual(['file:///added.jpg']);
  });

  test('updates the unit price of retained items without changing the default for new items', async () => {
    const record = await repository.createRecord({ quantity: 1, unit_price: 10 });

    await repository.updateRecordWithItemChanges(
      record.id,
      { quantity: 2 },
      { existingUnitPrice: 20, defaultUnitPrice: 30 },
    );

    const updated = await repository.findRecordById(record.id);
    expect(updated?.items.map((item) => item.unit_price)).toEqual([20, 30]);
  });

  test('rolls back quantity and items when adding an image fails', async () => {
    const record = await repository.createRecord({ quantity: 1, unit_price: 10 });
    const adapter = createAsyncSQLiteAdapter(raw);
    const failingAdapter = {
      ...adapter,
      runAsync: async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO cheki_item_images')) throw new Error('image insert failed');
        return adapter.runAsync(sql, params as never);
      },
    };
    repository = new ChekiRecordRepository(failingAdapter as typeof adapter, () => `failure-${nextId++}`);

    await expect(repository.updateRecordWithItemChanges(
      record.id,
      { quantity: 2 },
      { add: [{ frontUri: 'file:///failure.jpg' }], defaultUnitPrice: 20 },
    )).rejects.toThrow('image insert failed');

    expect(raw.prepare('SELECT quantity FROM cheki_records WHERE id = ?').get(record.id))
      .toEqual({ quantity: 1 });
    expect(raw.prepare('SELECT unit_price FROM cheki_items WHERE record_id = ?').all(record.id))
      .toEqual([{ unit_price: 10 }]);
  });

  test('removes a physical item and creates its replacement in one transaction', async () => {
    const record = await repository.createRecordWithItems({
      quantity: 2,
      unit_price: 10,
      items: [
        { frontUri: 'file:///first.jpg' },
        { frontUri: 'file:///second.jpg' },
      ],
    });
    const [first, second] = record.items;

    await repository.updateRecordWithItemChanges(
      record.id,
      { quantity: 2 },
      {
        removeItemIds: [first.id],
        add: [{ frontUri: 'file:///replacement.jpg', unitPrice: 30 }],
        defaultUnitPrice: 20,
      },
    );

    const updated = await repository.findRecordById(record.id);
    expect(updated?.items.map((item) => item.id)).toContain(second.id);
    expect(updated?.items.map((item) => item.id)).not.toContain(first.id);
    expect(updated?.items.map((item) => item.unit_price)).toEqual([10, 30]);
    expect(updated?.items.flatMap((item) => item.images.map((image) => image.photo_uri)))
      .toEqual(['file:///second.jpg', 'file:///replacement.jpg']);
  });

  test('derives the latest artist unit price directly from items, including zero', async () => {
    raw.prepare(
      `INSERT INTO artists
         (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 0, ?)`,
    ).run('artist-price', 'Price Artist', '2026-01-01T00:00:00.000Z');
    await repository.createRecord({
      artist_id: 'artist-price', date: '2026-01-01', quantity: 2, unit_price: 80,
    });
    await repository.createRecord({
      artist_id: 'artist-price', date: '2026-02-01', quantity: 1, unit_price: 0,
    });

    expect(await repository.findLatestUnitPriceByArtistId('artist-price')).toBe(0);
    expect(await repository.findLatestUnitPriceByArtistId('missing')).toBeNull();
  });

  test('updates item price and metadata while preserving image-side rules', async () => {
    const record = await repository.createRecordWithItems({
      quantity: 1,
      unit_price: 20,
      items: [{ frontUri: 'file:///front.jpg', backUri: 'file:///back.jpg' }],
    });
    const item = record.items[0];

    await repository.updateItemWithImages(item.id, {
      unitPrice: 30,
      spec: 'square',
      isFavorite: true,
      notes: 'signed on the back',
      images: { front: 'file:///new-front.jpg', back: null },
    });

    const updated = await repository.findItemById(item.id);
    expect(updated).toMatchObject({
      unit_price: 30,
      spec: 'square',
      is_favorite: 1,
      notes: 'signed on the back',
    });
    expect(updated?.images.map((image) => [image.side, image.photo_uri]))
      .toEqual([['front', 'file:///new-front.jpg']]);
    await expect(repository.removeItemImage(item.id, 'front'))
      .rejects.toThrow('front image cannot be removed');
  });

  test('filters records by full-record image status, notes, and back images', async () => {
    const empty = await repository.createRecord({ quantity: 2 });
    const partial = await repository.createRecordWithItems({
      quantity: 2,
      items: [{ frontUri: 'file:///partial.jpg', notes: 'item note' }],
    });
    const complete = await repository.createRecordWithItems({
      quantity: 1,
      notes: 'record note',
      items: [{ frontUri: 'file:///complete.jpg', backUri: 'file:///complete-back.jpg' }],
    });

    await expect(repository.findRecords({ imageStatus: 'none' })).resolves.toEqual([
      expect.objectContaining({ id: empty.id }),
    ]);
    await expect(repository.findRecords({ imageStatus: 'partial' })).resolves.toEqual([
      expect.objectContaining({ id: partial.id }),
    ]);
    await expect(repository.findRecords({ imageStatus: 'complete' })).resolves.toEqual([
      expect.objectContaining({ id: complete.id }),
    ]);
    expect((await repository.findRecords({ hasNotes: true })).map((record) => record.id).sort())
      .toEqual([complete.id, partial.id].sort());
    expect((await repository.findRecords({ hasBackImage: true })).map((record) => record.id))
      .toEqual([complete.id]);
  });

  test('filters only visible items and applies all item conditions to the same item', async () => {
    const record = await repository.createRecordWithItems({
      artist_id: null,
      event_id: null,
      date: '2026-08-01',
      quantity: 3,
      items: [
        {
          frontUri: 'file:///square.jpg',
          backUri: 'file:///square-back.jpg',
          spec: 'square',
          notes: 'signed',
        },
        { frontUri: 'file:///wide.jpg', spec: 'five_inch_landscape' },
        { spec: 'square', notes: 'no image' },
      ],
    });
    await repository.setItemFavorite(record.items[0].id, true);

    const matches = await repository.findBrowseItems({
      specs: ['square'],
      hasNotes: true,
      isFavorite: true,
      hasBackImage: true,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: record.items[0].id, spec: 'square' });
    expect(matches[0].record.id).toBe(record.id);
    await expect(repository.findBrowseItems({ specs: ['square'], hasLinkedEvent: true }))
      .resolves.toEqual([]);
  });

  test('allows a back-only item to become image-less without deleting the physical item', async () => {
    const record = await repository.createRecord({ quantity: 1, unit_price: 25 });
    const item = (await repository.findRecordById(record.id))!.items[0];
    await repository.addOrReplaceItemImage(item.id, 'back', 'file:///back.jpg');

    await expect(repository.removeItemImage(item.id, 'back')).resolves.toEqual({
      removed: true,
      itemDeleted: false,
    });
    expect(await repository.findItemById(item.id)).toMatchObject({ unit_price: 25, images: [] });
  });

  test('computes totals from item prices and image metrics from image-bearing items', async () => {
    const record = await repository.createRecord({ quantity: 3, unit_price: 30 });
    const item = (await repository.findRecordById(record.id))!.items[0];
    await repository.addOrReplaceItemImage(item.id, 'front', 'file:///front.jpg');
    await repository.addOrReplaceItemImage(item.id, 'back', 'file:///back.jpg');
    await repository.setItemFavorite(item.id, true);

    expect(await repository.getStatistics()).toEqual({
      quantity: 3,
      totalPrice: 90,
      archivedItems: 1,
      images: 2,
      favorites: 1,
    });
  });

  test('deleting an item decrements quantity and deleting the last item removes the record', async () => {
    const record = await repository.createRecord({ quantity: 2, unit_price: 30 });
    const initial = (await repository.findRecordById(record.id))!.items;

    await repository.deleteItem(initial[0].id);
    expect(await repository.findRecordById(record.id)).toMatchObject({ quantity: 1 });
    expect((await repository.findRecordById(record.id))?.items).toHaveLength(1);

    await repository.deleteItem(initial[1].id);
    expect(await repository.findRecordById(record.id)).toBeNull();
  });

  test('cascades record deletion and leaves media handling outside the repository', async () => {
    const record = await repository.createRecordWithItems({
      quantity: 1,
      items: [{ frontUri: 'file:///kept-in-documents.jpg' }],
    });
    await repository.deleteRecord(record.id);
    expect(raw.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM cheki_items').get()).toEqual({ count: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS count FROM cheki_item_images').get()).toEqual({ count: 0 });
  });
});

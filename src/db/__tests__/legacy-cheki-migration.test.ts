import { migrateLegacyChekiData } from '../legacyChekiMigration';

function ids() {
  let index = 0;
  return () => `generated-${index++}`;
}

describe('legacy cheki v2 data migration', () => {
  const base = {
    eventDatesById: new Map([['event-1', '2026-06-01'], ['event-2', '2026-06-01']]),
  };

  test('deterministically merges photo and manual rows while preserving fields', () => {
    const input = {
      ...base,
      cheki: [
        {
          id: 'photo-b', event_id: 'event-1', artist_id: 'artist-1',
          photo_uri: 'file:///b.jpg', date: null, price: 12.4, notes: 'B',
          created_at: '2026-06-01T11:00:00.000Z',
        },
        {
          id: 'photo-a', event_id: 'event-1', artist_id: 'artist-1',
          photo_uri: 'file:///a.jpg', date: null, price: null, notes: 'A',
          created_at: '2026-06-01T10:00:00.000Z',
        },
      ],
      manualEntries: [{
        id: 'manual', artist_id: 'artist-1', event_id: 'event-1', date: null,
        count: 3, total_price: 10.4, created_at: '2026-06-01T09:00:00.000Z',
        updated_at: '2026-06-02T09:00:00.000Z',
      }],
    };
    const migrated = migrateLegacyChekiData(input, { generateId: ids() });
    expect(migrated.records).toEqual([
      expect.objectContaining({
        event_id: 'event-1',
        artist_id: 'artist-1',
        date: '2026-06-01',
        quantity: 5,
        notes: null,
        created_at: '2026-06-01T09:00:00.000Z',
        updated_at: '2026-06-02T09:00:00.000Z',
      }),
    ]);
    expect(migrated.items.map((item) => ({
      id: item.id,
      order: item.sort_order,
      unitPrice: item.unit_price,
      spec: item.spec,
      favorite: item.is_favorite,
      notes: item.notes,
    }))).toEqual([
      { id: 'generated-1', order: 0, unitPrice: 4, spec: 'three_inch_portrait', favorite: 0, notes: null },
      { id: 'generated-2', order: 1, unitPrice: 3, spec: 'three_inch_portrait', favorite: 0, notes: null },
      { id: 'generated-3', order: 2, unitPrice: 3, spec: 'three_inch_portrait', favorite: 0, notes: null },
      { id: 'photo-a', order: 3, unitPrice: 0, spec: 'three_inch_portrait', favorite: 0, notes: 'A' },
      { id: 'photo-b', order: 4, unitPrice: 12, spec: 'three_inch_portrait', favorite: 0, notes: 'B' },
    ]);
    expect(migrated.images.map((image) => ({
      item: image.item_id, side: image.side, uri: image.photo_uri,
    }))).toEqual([
      { item: 'photo-a', side: 'front', uri: 'file:///a.jpg' },
      { item: 'photo-b', side: 'front', uri: 'file:///b.jpg' },
    ]);

    const reordered = migrateLegacyChekiData({
      ...input,
      cheki: [...input.cheki].reverse(),
    }, { generateId: ids() });
    expect(reordered).toEqual(migrated);
  });

  test('turns missing prices into zero and conservatively separates events, dates, artists, and null artists', () => {
    const migrated = migrateLegacyChekiData({
      ...base,
      cheki: [
        { id: 'a', event_id: 'event-1', artist_id: 'artist', photo_uri: 'a', date: null, price: null, notes: null, created_at: '2026-06-01T10:00:00Z' },
        { id: 'b', event_id: 'event-2', artist_id: 'artist', photo_uri: 'b', date: null, price: null, notes: null, created_at: '2026-06-01T10:00:00Z' },
        { id: 'c', event_id: 'event-1', artist_id: 'artist', photo_uri: 'c', date: '2026-06-02', price: null, notes: null, created_at: '2026-06-01T10:00:00Z' },
        { id: 'd', event_id: null, artist_id: null, photo_uri: 'd', date: '2026-06-01', price: null, notes: null, created_at: '2026-06-01T10:00:00Z' },
      ],
      manualEntries: [{
        id: 'null-manual', artist_id: null, event_id: null, date: '2026-06-01',
        count: 2, total_price: null, created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      }],
    }, { generateId: ids() });
    expect(migrated.records).toHaveLength(5);
    expect(migrated.records.reduce((sum, record) => sum + record.quantity, 0)).toBe(6);
    expect(migrated.items).toHaveLength(6);
    expect(migrated.items.every((item) => item.unit_price === 0)).toBe(true);
  });
});

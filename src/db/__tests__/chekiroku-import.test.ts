import Database from 'better-sqlite3';
import type { Artist } from '../../types/models';
import {
  applyChekirokuImportPlan,
  buildChekirokuImportPlan,
  type ChekirokuSourceSnapshot,
} from '../../importers/chekiroku';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

function createSnapshot(overrides: Partial<ChekirokuSourceSnapshot> = {}): ChekirokuSourceSnapshot {
  return {
    containerVersion: 2,
    databaseVersion: 12,
    groups: [{ id: 'group-a', name: '团体 A' }],
    members: [{
      id: 'member-a',
      name: '成员 A',
      groupId: 'group-a',
      imagePath: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }],
    records: [{
      id: 'record-a',
      date: Date.UTC(2026, 0, 11),
      memberId: 'member-a',
      count: 2,
      eventId: null,
      categoryId: null,
      hallId: null,
      memo: null,
    }],
    eventNames: {},
    hallNames: {},
    categoryNames: {},
    favoriteMemberIds: ['member-a'],
    samePersonGroups: [],
    hiddenMemberCount: 0,
    samePersonGroupCount: 0,
    samePersonRelationCount: 0,
    anniversarySettingCount: 0,
    sortingRowCount: 0,
    userDefinedOrderCount: 0,
    unknownTables: [],
    unknownColumns: {},
    warnings: [],
    ...overrides,
  };
}

function createTestIdFactory() {
  let index = 0;
  return () => `20000000-0000-4000-8000-${String(++index).padStart(12, '0')}`;
}

describe('Chekiroku import application', () => {
  let rawDb: Database.Database;

  beforeEach(() => {
    rawDb = new Database(':memory:');
    rawDb.exec('PRAGMA foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) rawDb.exec(statement);
  });

  afterEach(() => rawDb.close());

  test('imports 70 records and preserves quantity/item equality in one transaction', async () => {
    const records = Array.from({ length: 70 }, (_, index) => ({
      id: `record-${index}`,
      date: Date.UTC(2026, 0, 11 + (index % 27)),
      memberId: 'member-a',
      count: index < 13 ? 4 : 3,
      eventId: null,
      categoryId: null,
      hallId: null,
      memo: null,
    }));
    const plan = buildChekirokuImportPlan(createSnapshot({ records, favoriteMemberIds: [] }), [], {
      createId: createTestIdFactory(),
      importedAt: '2026-08-13T00:00:00.000Z',
    });
    const result = await applyChekirokuImportPlan(createAsyncSQLiteAdapter(rawDb), plan);
    expect(result.createdRecords).toBe(70);
    expect(result.createdItems).toBe(223);
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 70 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_items').get()).toEqual({ count: 223 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_records r LEFT JOIN cheki_items i ON i.record_id = r.id GROUP BY r.id HAVING r.quantity != COUNT(i.id)').all()).toEqual([]);
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_records WHERE event_id IS NOT NULL').get()).toEqual({ count: 0 });
    expect(rawDb.prepare("SELECT COUNT(*) AS count FROM cheki_items WHERE unit_price != 0 OR spec != 'three_inch_portrait'").get()).toEqual({ count: 0 });
  });

  test('applies a newer-version plan while preserving a partial-support warning', async () => {
    const plan = buildChekirokuImportPlan(
      createSnapshot({
        databaseVersion: 23,
        unknownTables: ['cheki_images'],
        unknownTableRowCounts: { cheki_images: 2 },
      }),
      [],
      {
        createId: createTestIdFactory(),
        importedAt: '2026-08-13T00:00:00.000Z',
      },
    );

    expect(plan.preview.unsupportedData).toEqual(['发现 2 条外部扩展数据不会导入']);

    const result = await applyChekirokuImportPlan(createAsyncSQLiteAdapter(rawDb), plan);

    expect(result.createdRecords).toBe(1);
    expect(result.createdItems).toBe(2);
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 1 });
  });

  test('rolls back artists, records, and items when a later write fails', async () => {
    const plan = buildChekirokuImportPlan(createSnapshot({
      records: [
        createSnapshot().records[0],
        { ...createSnapshot().records[0], id: 'record-b', count: 1 },
      ],
    }), [], { createId: createTestIdFactory(), importedAt: '2026-08-13T00:00:00.000Z' });
    const adapter = createAsyncSQLiteAdapter(rawDb);
    const originalRunAsync = adapter.runAsync.bind(adapter);
    let itemWrites = 0;
    adapter.runAsync = async (sql, params) => {
      if (sql.includes('INSERT INTO cheki_items')) {
        itemWrites += 1;
        if (itemWrites === 2) throw new Error('simulated item failure');
      }
      return originalRunAsync(sql, params as never);
    };
    await expect(applyChekirokuImportPlan(adapter, plan)).rejects.toThrow('simulated item failure');
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM artists').get()).toEqual({ count: 0 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 0 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_items').get()).toEqual({ count: 0 });
  });

  test('reuses exact artists and synchronizes favorite state on a second import', async () => {
    const adapter = createAsyncSQLiteAdapter(rawDb);
    const firstPlan = buildChekirokuImportPlan(createSnapshot({ favoriteMemberIds: [] }), [], {
      createId: createTestIdFactory(),
      importedAt: '2026-08-13T00:00:00.000Z',
    });
    await applyChekirokuImportPlan(adapter, firstPlan);
    const currentArtists = rawDb.prepare(
      `SELECT artists.*, affiliation.parent_artist_id AS parent_id
       FROM artists
       LEFT JOIN artist_basic_affiliations affiliation
         ON affiliation.member_artist_id = artists.id`,
    ).all() as Artist[];
    const secondPlan = buildChekirokuImportPlan(createSnapshot(), currentArtists, {
      createId: createTestIdFactory(),
      importedAt: '2026-08-13T00:01:00.000Z',
    });
    expect(secondPlan.preview.favoriteExistingArtistCount).toBe(1);
    await applyChekirokuImportPlan(adapter, secondPlan);
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM artists').get()).toEqual({ count: 2 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 2 });
    expect(rawDb.prepare("SELECT is_favorite FROM artists WHERE name = '成员 A'").get()).toEqual({ is_favorite: 1 });
  });
});

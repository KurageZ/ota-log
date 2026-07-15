import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../../db/schema';
import { createAsyncSQLiteAdapter } from '../../db/__tests__/fixtures/sqliteTestAdapter';
import { materializePresetArtistAvatars } from '../presetArtistMedia';

const mockBundledAssets = new Map<string, number>();
const mockAssetUris = new Map<number, string>();
const mockCopyToDocuments = jest.fn<Promise<string>, [string, { filenamePrefix?: string }?]>();

jest.mock('../../db/bundledArtistCatalog', () => ({
  resolveBundledArtistAvatar: (id: string) => mockBundledAssets.get(id),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: (moduleId: number) => ({
      downloadAsync: async () => ({ localUri: mockAssetUris.get(moduleId) ?? null }),
    }),
  },
}));

jest.mock('../copyToDocuments', () => ({
  copyToDocuments: (...args: [string, { filenamePrefix?: string }?]) => mockCopyToDocuments(...args),
}));

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
  return db;
}

describe('materializePresetArtistAvatars', () => {
  let db: Database.Database;

  beforeEach(() => {
    mockBundledAssets.clear();
    mockAssetUris.clear();
    mockCopyToDocuments.mockReset();
    db = createDatabase();
  });

  afterEach(() => {
    db.close();
  });

  test('copies resolvable preset avatars into Documents and updates artist rows', async () => {
    db.prepare(
      `INSERT INTO artists (id, name, avatar_uri, is_favorite, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    ).run('artist-1', 'Artist 1', 'preset://1001', '2026-01-01T00:00:00.000Z');
    db.prepare(
      `INSERT INTO artists (id, name, avatar_uri, is_favorite, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    ).run('artist-2', 'Artist 2', 'https://example.com/avatar.jpg', '2026-01-01T00:00:00.000Z');
    mockBundledAssets.set('1001', 41);
    mockAssetUris.set(41, 'file:///cache/avatar_1001.jpg');
    mockCopyToDocuments.mockResolvedValue('file:///documents/artist_avatar_1001.jpg');

    const result = await materializePresetArtistAvatars(createAsyncSQLiteAdapter(db));

    expect(result).toEqual({ scanned: 1, materialized: 1, unresolved: 0 });
    expect(mockCopyToDocuments).toHaveBeenCalledWith(
      'file:///cache/avatar_1001.jpg',
      { filenamePrefix: 'artist_avatar' },
    );
    expect(db.prepare('SELECT avatar_uri FROM artists WHERE id = ?').get('artist-1')).toEqual({
      avatar_uri: 'file:///documents/artist_avatar_1001.jpg',
    });
    expect(db.prepare('SELECT avatar_uri FROM artists WHERE id = ?').get('artist-2')).toEqual({
      avatar_uri: 'https://example.com/avatar.jpg',
    });
  });

  test('leaves unavailable preset avatars unchanged so a later transitional build can retry', async () => {
    db.prepare(
      `INSERT INTO artists (id, name, avatar_uri, is_favorite, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    ).run('artist-missing', 'Missing', 'preset://9999', '2026-01-01T00:00:00.000Z');

    const result = await materializePresetArtistAvatars(createAsyncSQLiteAdapter(db));

    expect(result).toEqual({ scanned: 1, materialized: 0, unresolved: 1 });
    expect(mockCopyToDocuments).not.toHaveBeenCalled();
    expect(db.prepare('SELECT avatar_uri FROM artists WHERE id = ?').get('artist-missing')).toEqual({
      avatar_uri: 'preset://9999',
    });
  });
});

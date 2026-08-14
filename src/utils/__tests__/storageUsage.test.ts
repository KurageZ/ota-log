import {
  categorizeFileName,
  collectStorageUriCategories,
  computeStorageUsage,
  formatBytes,
  formatStoragePercent,
  STORAGE_CATEGORY_IDS,
} from '../storageUsage';
import type { StorageEntryInfo, StorageUriSource } from '../storageUsage';

function entry(
  name: string,
  bytes: number,
  overrides: Partial<StorageEntryInfo> = {},
): StorageEntryInfo {
  return {
    uri: `file:///documents/${name}`,
    name,
    bytes,
    fileCount: 1,
    isDirectory: false,
    ...overrides,
  };
}

describe('categorizeFileName', () => {
  it.each([
    ['photo_1723456789.jpg', 'eventPhotos'],
    ['event_1723456789.jpg', 'eventPhotos'],
    ['event_info_1723456789.jpg', 'eventPhotos'],
    ['cheki_1723456789.jpg', 'cheki'],
    ['cheki-front_1723456789.jpg', 'cheki'],
    ['cheki-back_1723456789.jpg', 'cheki'],
    ['sticker_source_1723456789.jpg', 'cheki'],
    ['sticker_camera_1723456789.jpg', 'cheki'],
    ['artist_avatar_1723456789.jpg', 'artistImages'],
    ['weibo_avatar_1723456789.jpg', 'artistImages'],
    ['artist_bg_1723456789.jpg', 'artistImages'],
    ['showcase_bg_1723456789.jpg', 'artistImages'],
    ['profile_avatar_1723456789.jpg', 'other'],
    ['ota_log_backup_20260814.zip', 'other'],
    ['unknown.txt', 'other'],
  ])('classifies %s as %s', (name, expected) => {
    expect(categorizeFileName(name)).toBe(expected);
  });
});

describe('computeStorageUsage', () => {
  it('groups files by prefix and sums bytes and file counts', () => {
    const usage = computeStorageUsage([
      entry('photo_a.jpg', 100),
      entry('photo_b.jpg', 200),
      entry('cheki_1.jpg', 300),
      entry('artist_avatar_x.jpg', 50),
      entry('unknown.txt', 25),
    ]);

    expect(usage.totalBytes).toBe(675);
    const byId = new Map(usage.categories.map((category) => [category.id, category]));
    expect(byId.get('eventPhotos')).toMatchObject({ bytes: 300, fileCount: 2 });
    expect(byId.get('cheki')).toMatchObject({ bytes: 300, fileCount: 1 });
    expect(byId.get('artistImages')).toMatchObject({ bytes: 50, fileCount: 1 });
    expect(byId.get('other')).toMatchObject({ bytes: 25, fileCount: 1 });
  });

  it('counts the SQLite directory as database with its recursive size', () => {
    const usage = computeStorageUsage([
      entry('SQLite', 1024, { fileCount: 3, isDirectory: true }),
      entry('photo_a.jpg', 100),
    ]);

    const byId = new Map(usage.categories.map((category) => [category.id, category]));
    expect(byId.get('database')).toMatchObject({ bytes: 1024, fileCount: 3 });
    expect(usage.totalBytes).toBe(1124);
  });

  it('puts unknown directories into other', () => {
    const usage = computeStorageUsage([
      entry('cache_backup', 512, { fileCount: 2, isDirectory: true }),
    ]);

    const byId = new Map(usage.categories.map((category) => [category.id, category]));
    expect(byId.get('other')).toMatchObject({ bytes: 512, fileCount: 2 });
  });

  it('returns all five categories including zero buckets', () => {
    const usage = computeStorageUsage([]);

    expect(usage.categories).toHaveLength(STORAGE_CATEGORY_IDS.length);
    expect(usage.totalBytes).toBe(0);
    expect(usage.categories.every((category) => category.bytes === 0 && category.fileCount === 0))
      .toBe(true);
  });

  it('classifies by database reference even when the filename prefix says otherwise', () => {
    const usage = computeStorageUsage(
      [
        entry('photo_restored_cheki.jpg', 100),
        entry('photo_real_event.jpg', 200),
      ],
      {
        'file:///documents/photo_restored_cheki.jpg': 'cheki',
      },
    );

    const byId = new Map(usage.categories.map((category) => [category.id, category]));
    expect(byId.get('cheki')).toMatchObject({ bytes: 100, fileCount: 1 });
    expect(byId.get('eventPhotos')).toMatchObject({ bytes: 200, fileCount: 1 });
  });

  it('falls back to prefix classification for unreferenced files', () => {
    const usage = computeStorageUsage(
      [entry('cheki_orphan.jpg', 100)],
      {},
    );

    const byId = new Map(usage.categories.map((category) => [category.id, category]));
    expect(byId.get('cheki')).toMatchObject({ bytes: 100, fileCount: 1 });
  });
});

describe('collectStorageUriCategories', () => {
  function createFakeDb(): StorageUriSource {
    return {
      getAllAsync: async <T>(sql: string): Promise<T[]> => {
        if (sql.includes('cheki_item_images')) {
          return [{ uri: 'file:///documents/shared.jpg' }] as T[];
        }
        if (sql.includes('FROM artists')) {
          return [{ uri: 'file:///documents/artist.jpg' }] as T[];
        }
        if (sql.includes('FROM photos')) {
          return [{ uri: 'file:///documents/shared.jpg' }] as T[];
        }
        if (sql.includes('user_config')) {
          return [{ uri: 'file:///documents/me.jpg' }] as T[];
        }
        return [] as T[];
      },
    };
  }

  it('maps referenced URIs to categories with cheki taking priority', async () => {
    const categories = await collectStorageUriCategories(createFakeDb());

    expect(categories['file:///documents/shared.jpg']).toBe('cheki');
    expect(categories['file:///documents/artist.jpg']).toBe('artistImages');
    expect(categories['file:///documents/me.jpg']).toBe('other');
  });
});

describe('formatStoragePercent', () => {
  it('returns 0% when total is empty', () => {
    expect(formatStoragePercent(0, 0)).toBe('0%');
    expect(formatStoragePercent(100, 0)).toBe('0%');
  });

  it('returns <1% for tiny shares', () => {
    expect(formatStoragePercent(9, 1000)).toBe('<1%');
  });

  it('formats one decimal place', () => {
    expect(formatStoragePercent(250, 1000)).toBe('25.0%');
    expect(formatStoragePercent(333, 1000)).toBe('33.3%');
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [1536 * 1024 * 1024, '1.50 GB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

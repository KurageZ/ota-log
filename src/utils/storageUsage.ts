import { Directory, File, Paths } from 'expo-file-system';

export type StorageCategoryId =
  | 'eventPhotos'
  | 'cheki'
  | 'artistImages'
  | 'database'
  | 'other';

export interface StorageCategoryInfo {
  id: StorageCategoryId;
  label: string;
  bytes: number;
  fileCount: number;
}

export interface StorageUsageResult {
  totalBytes: number;
  categories: StorageCategoryInfo[];
}

export type StorageUriCategory = Record<string, StorageCategoryId>;

export interface StorageEntryInfo {
  uri: string;
  name: string;
  bytes: number;
  fileCount: number;
  isDirectory: boolean;
}

export interface StorageUriSource {
  getAllAsync<T>(source: string): Promise<T[]>;
}

const STORAGE_CATEGORY_LABELS: Record<StorageCategoryId, string> = {
  eventPhotos: '活动照片',
  cheki: '切册照片',
  artistImages: '艺人图片',
  database: '数据库',
  other: '其他',
};

export const STORAGE_CATEGORY_IDS: StorageCategoryId[] = [
  'eventPhotos',
  'cheki',
  'artistImages',
  'database',
  'other',
];

const DATABASE_DIRECTORY_NAME = 'SQLite';

function getFileSize(file: File): number {
  const size = (file as unknown as { size?: number | null }).size;
  return typeof size === 'number' ? size : 0;
}

function getDirectorySize(directory: Directory): number {
  const size = (directory as unknown as { size?: number }).size;
  return typeof size === 'number' ? size : 0;
}

function countFilesInDirectory(directory: Directory): number {
  let count = 0;
  for (const entry of directory.list()) {
    if (entry instanceof File) {
      count += 1;
    } else {
      count += countFilesInDirectory(entry);
    }
  }
  return count;
}

export function categorizeFileName(name: string): StorageCategoryId {
  if (name.startsWith('photo_') || name.startsWith('event_')) return 'eventPhotos';
  if (
    name.startsWith('cheki')
    || name.startsWith('sticker_source_')
    || name.startsWith('sticker_camera_')
  ) {
    return 'cheki';
  }
  if (
    name.startsWith('artist_avatar_')
    || name.startsWith('weibo_avatar_')
    || name.startsWith('artist_bg_')
    || name.startsWith('showcase_bg_')
  ) {
    return 'artistImages';
  }
  // Unmanaged prefixes (including profile avatars) land in 其他.
  return 'other';
}

/**
 * Queries the database for every media URI the app references, mapped to its
 * business category. The database is the source of truth: restored or legacy
 * files often carry a generic `photo_` name, so filename prefixes alone cannot
 * tell event photos apart from cheki photos.
 *
 * Priority when one file is referenced by multiple tables:
 * cheki > artistImages > eventPhotos > other.
 */
export async function collectStorageUriCategories(
  db: StorageUriSource,
): Promise<StorageUriCategory> {
  const categories: StorageUriCategory = {};
  const mark = (uri: string | null | undefined, category: StorageCategoryId) => {
    if (uri && !(uri in categories)) {
      categories[uri] = category;
    }
  };

  const chekiRows = await db.getAllAsync<{ uri: string | null }>(
    'SELECT photo_uri AS uri FROM cheki_item_images WHERE photo_uri IS NOT NULL',
  );
  for (const row of chekiRows) mark(row.uri, 'cheki');

  const artistRows = await db.getAllAsync<{ uri: string | null }>(
    `SELECT avatar_uri AS uri FROM artists WHERE avatar_uri IS NOT NULL
     UNION ALL
     SELECT background_uri AS uri FROM artists WHERE background_uri IS NOT NULL`,
  );
  for (const row of artistRows) mark(row.uri, 'artistImages');

  const eventRows = await db.getAllAsync<{ uri: string | null }>(
    'SELECT local_uri AS uri FROM photos WHERE local_uri IS NOT NULL',
  );
  for (const row of eventRows) mark(row.uri, 'eventPhotos');

  const profileRows = await db.getAllAsync<{ uri: string | null }>(
    'SELECT avatar_uri AS uri FROM user_config WHERE avatar_uri IS NOT NULL',
  );
  for (const row of profileRows) mark(row.uri, 'other');

  return categories;
}

export function computeStorageUsage(
  entries: StorageEntryInfo[],
  uriCategories: StorageUriCategory = {},
): StorageUsageResult {
  const totals = new Map<StorageCategoryId, { bytes: number; fileCount: number }>(
    STORAGE_CATEGORY_IDS.map((id) => [id, { bytes: 0, fileCount: 0 }]),
  );
  let totalBytes = 0;

  for (const entry of entries) {
    const category = entry.isDirectory && entry.name === DATABASE_DIRECTORY_NAME
      ? 'database'
      : uriCategories[entry.uri] ?? categorizeFileName(entry.name);
    const bucket = totals.get(category);
    if (bucket) {
      bucket.bytes += entry.bytes;
      bucket.fileCount += entry.fileCount;
    }
    totalBytes += entry.bytes;
  }

  return {
    totalBytes,
    categories: STORAGE_CATEGORY_IDS.map((id) => ({
      id,
      label: STORAGE_CATEGORY_LABELS[id],
      bytes: totals.get(id)?.bytes ?? 0,
      fileCount: totals.get(id)?.fileCount ?? 0,
    })),
  };
}

/**
 * Scans the app Documents directory and groups files into business categories.
 * Synchronous: Directory.list() and the native size property are both sync.
 */
export async function scanStorageUsage(db: StorageUriSource): Promise<StorageUsageResult> {
  const uriCategories = await collectStorageUriCategories(db);
  const directory = new Directory(Paths.document);
  const entries = directory.list().map((entry): StorageEntryInfo => {
    if (entry instanceof Directory) {
      return {
        uri: entry.uri,
        name: entry.name,
        bytes: getDirectorySize(entry),
        fileCount: countFilesInDirectory(entry),
        isDirectory: true,
      };
    }
    return {
      uri: entry.uri,
      name: entry.name,
      bytes: getFileSize(entry),
      fileCount: 1,
      isDirectory: false,
    };
  });
  return computeStorageUsage(entries, uriCategories);
}

export function getStorageTotalBytes(): number {
  return getDirectorySize(new Directory(Paths.document));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatStoragePercent(bytes: number, totalBytes: number): string {
  if (totalBytes <= 0 || bytes <= 0) return '0%';
  const percent = (bytes / totalBytes) * 100;
  if (percent < 1) return '<1%';
  return `${percent.toFixed(1)}%`;
}

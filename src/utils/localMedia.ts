import { Directory, File, Paths } from 'expo-file-system';
import { SQLiteDatabase } from 'expo-sqlite';

const LOCAL_MEDIA_PREFIXES = ['photo_', 'weibo_avatar_', 'artist_bg_', 'showcase_bg_'];

export interface LocalMediaCleanupResult {
  scanned: number;
  deleted: number;
  failed: number;
  bytesFreed: number;
}

export interface LocalMediaScanResult {
  scanned: number;
  unused: number;
  bytes: number;
}

function getDocumentUri(): string {
  const document = Paths.document as unknown as { uri?: string };
  const uri = document.uri ?? String(Paths.document);
  return uri.endsWith('/') ? uri : `${uri}/`;
}

export function isAppDocumentUri(uri: string | null | undefined): uri is string {
  return !!uri && uri.startsWith('file://') && uri.startsWith(getDocumentUri());
}

function isManagedMediaName(name: string): boolean {
  return LOCAL_MEDIA_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function getFileSize(file: File): number {
  const size = (file as unknown as { size?: number | null }).size;
  return typeof size === 'number' ? size : 0;
}

async function safeDeleteFile(uri: string): Promise<{ deleted: boolean; bytesFreed: number }> {
  try {
    const file = new File(uri);
    const exists = (file as unknown as { exists?: boolean }).exists;
    if (exists === false) return { deleted: false, bytesFreed: 0 };

    const bytesFreed = getFileSize(file);
    file.delete();
    return { deleted: true, bytesFreed };
  } catch {
    return { deleted: false, bytesFreed: 0 };
  }
}

export async function countLocalMediaReferences(db: SQLiteDatabase, uri: string): Promise<number> {
  const rows = await db.getAllAsync<{ uri: string | null }>(
    `SELECT local_uri AS uri FROM photos WHERE local_uri = ?
     UNION ALL
     SELECT photo_uri AS uri FROM cheki WHERE photo_uri = ?
     UNION ALL
     SELECT avatar_uri AS uri FROM artists WHERE avatar_uri = ?
     UNION ALL
     SELECT background_uri AS uri FROM artists WHERE background_uri = ?
     UNION ALL
     SELECT avatar_uri AS uri FROM user_config WHERE avatar_uri = ?`,
    [uri, uri, uri, uri, uri]
  );
  return rows.length;
}

export async function deleteLocalFileIfUnreferenced(
  db: SQLiteDatabase,
  uri: string | null | undefined,
): Promise<boolean> {
  if (!isAppDocumentUri(uri)) return false;

  const references = await countLocalMediaReferences(db, uri);
  if (references > 0) return false;

  const result = await safeDeleteFile(uri);
  return result.deleted;
}

export async function collectReferencedLocalMediaUris(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ uri: string | null }>(
    `SELECT local_uri AS uri FROM photos WHERE local_uri IS NOT NULL
     UNION
     SELECT photo_uri AS uri FROM cheki WHERE photo_uri IS NOT NULL
     UNION
     SELECT avatar_uri AS uri FROM artists WHERE avatar_uri IS NOT NULL
     UNION
      SELECT background_uri AS uri FROM artists WHERE background_uri IS NOT NULL
     UNION
     SELECT avatar_uri AS uri FROM user_config WHERE avatar_uri IS NOT NULL`
  );
  return new Set(rows.map((row) => row.uri).filter(isAppDocumentUri));
}

export async function cleanupUnreferencedLocalMedia(
  db: SQLiteDatabase,
): Promise<LocalMediaCleanupResult> {
  const referencedUris = await collectReferencedLocalMediaUris(db);
  const directory = new Directory(Paths.document);
  const entries = directory.list();
  const result: LocalMediaCleanupResult = {
    scanned: 0,
    deleted: 0,
    failed: 0,
    bytesFreed: 0,
  };

  for (const entry of entries) {
    if (!(entry instanceof File) || !isManagedMediaName(entry.name)) continue;

    result.scanned += 1;
    if (referencedUris.has(entry.uri)) continue;

    const bytesFreed = getFileSize(entry);
    const deletion = await safeDeleteFile(entry.uri);
    if (deletion.deleted) {
      result.deleted += 1;
      result.bytesFreed += deletion.bytesFreed || bytesFreed;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

export async function scanUnreferencedLocalMedia(
  db: SQLiteDatabase,
): Promise<LocalMediaScanResult> {
  const referencedUris = await collectReferencedLocalMediaUris(db);
  const directory = new Directory(Paths.document);
  const entries = directory.list();
  const result: LocalMediaScanResult = {
    scanned: 0,
    unused: 0,
    bytes: 0,
  };

  for (const entry of entries) {
    if (!(entry instanceof File) || !isManagedMediaName(entry.name)) continue;

    result.scanned += 1;
    if (!referencedUris.has(entry.uri)) {
      result.unused += 1;
      result.bytes += getFileSize(entry);
    }
  }

  return result;
}

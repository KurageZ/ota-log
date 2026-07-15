import { Asset } from 'expo-asset';
import type { SQLiteDatabase } from 'expo-sqlite';
import { resolveBundledArtistAvatar } from '../db/bundledArtistCatalog';
import { copyToDocuments } from './copyToDocuments';

interface PresetArtistAvatarRow {
  id: string;
  avatar_uri: string;
}

export interface PresetArtistMediaMigrationResult {
  scanned: number;
  materialized: number;
  unresolved: number;
}

async function getBundledAvatarFileUri(moduleId: number): Promise<string> {
  const asset = await Asset.fromModule(moduleId).downloadAsync();
  if (!asset.localUri?.startsWith('file://')) {
    throw new Error('旧版内置艺人头像无法读取');
  }
  return asset.localUri;
}

/**
 * Turns legacy preset:// artist avatars into durable Documents files.
 *
 * Transitional builds still carry the old avatar assets so upgraded users can
 * migrate them. Fresh databases no longer seed the bundled artist catalog.
 */
export async function materializePresetArtistAvatars(
  db: SQLiteDatabase,
): Promise<PresetArtistMediaMigrationResult> {
  const rows = await db.getAllAsync<PresetArtistAvatarRow>(
    "SELECT id, avatar_uri FROM artists WHERE avatar_uri LIKE 'preset://%'",
  );
  let materialized = 0;
  let unresolved = 0;

  for (const row of rows) {
    const presetId = row.avatar_uri.slice('preset://'.length);
    const moduleId = resolveBundledArtistAvatar(presetId);
    if (moduleId == null) {
      unresolved += 1;
      continue;
    }

    try {
      const sourceUri = await getBundledAvatarFileUri(moduleId);
      const permanentUri = await copyToDocuments(sourceUri, {
        filenamePrefix: 'artist_avatar',
      });
      await db.runAsync(
        'UPDATE artists SET avatar_uri = ? WHERE id = ? AND avatar_uri = ?',
        [permanentUri, row.id, row.avatar_uri],
      );
      materialized += 1;
    } catch {
      unresolved += 1;
    }
  }

  return {
    scanned: rows.length,
    materialized,
    unresolved,
  };
}

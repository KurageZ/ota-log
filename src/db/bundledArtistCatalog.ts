import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Public builds intentionally ship without a bundled third-party artist catalog.
 * Private builds replace this adapter only inside a disposable staging directory.
 */
export async function insertBundledArtists(_db: SQLiteDatabase): Promise<void> {}

export function resolveBundledArtistAvatar(_id: string): number | undefined {
  return undefined;
}

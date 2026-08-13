import { SQLiteDatabase } from 'expo-sqlite';
import { ArtistRepository } from '../repositories/ArtistRepository';
import { DEFAULT_ARTIST_CONFIRMATION_MODE } from '../utils/artistConfirmation';
import { toISODateTime } from '../utils/date';
import { DEFAULT_PROFILE_EMOJI } from '../utils/profile';

const ORPHAN_ARTIST_IDS_QUERY = `
WITH RECURSIVE referenced(id) AS (
  SELECT artist_id FROM event_artists
  UNION
  SELECT artist_id FROM event_timetable_entries WHERE artist_id IS NOT NULL
  UNION
  SELECT artist_id FROM cheki_records WHERE artist_id IS NOT NULL
  UNION
  SELECT artist_id FROM important_date_artists
  UNION
  SELECT oshi_artist_id FROM user_config WHERE id = 'default' AND oshi_artist_id IS NOT NULL
),
keep(id) AS (
  SELECT id FROM referenced
  UNION
  SELECT a.parent_id
  FROM artists a
  JOIN keep k ON k.id = a.id
  WHERE a.parent_id IS NOT NULL
  UNION
  SELECT a.id
  FROM artists a
  JOIN keep k ON k.id = a.parent_id
)
SELECT a.id
FROM artists a
WHERE a.id NOT IN (SELECT id FROM keep)
ORDER BY a.name ASC, a.id ASC
`;

async function findWritableTableNames(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name <> 'android_metadata'
     ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

async function insertDefaultUserConfig(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `INSERT INTO user_config
       (id, name, avatar_uri, avatar_emoji, oshi_artist_id,
        artist_confirmation_mode, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'default',
      'Otaku',
      null,
      DEFAULT_PROFILE_EMOJI,
      null,
      DEFAULT_ARTIST_CONFIRMATION_MODE,
      toISODateTime(),
    ],
  );
}

export async function clearAllDatabaseRows(db: SQLiteDatabase): Promise<void> {
  const tableNames = await findWritableTableNames(db);

  await db.runAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.withTransactionAsync(async () => {
      for (const tableName of tableNames) {
        await db.runAsync(`DELETE FROM "${tableName}"`);
      }
      await insertDefaultUserConfig(db);
    });
  } finally {
    await db.runAsync('PRAGMA foreign_keys = ON');
  }
}

export async function findOrphanArtistIds(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(ORPHAN_ARTIST_IDS_QUERY);
  return rows.map((row) => row.id);
}

export async function removeOrphanArtists(db: SQLiteDatabase): Promise<number> {
  const orphanArtistIds = await findOrphanArtistIds(db);
  if (orphanArtistIds.length === 0) return 0;

  const artistRepository = new ArtistRepository(db);
  await db.withTransactionAsync(async () => {
    for (const artistId of orphanArtistIds) {
      await artistRepository.delete(artistId);
    }
  });

  return orphanArtistIds.length;
}

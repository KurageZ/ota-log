import { SQLiteDatabase } from 'expo-sqlite';
import { Artist, CreateArtistInput } from '../types/models';
import { generateId } from '../utils/uuid';
import { toISODateTime } from '../utils/date';
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';

export class ArtistRepository {
  constructor(private db: SQLiteDatabase) {}

  private async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const transactionalDb = this.db as SQLiteDatabase & {
      withTransactionAsync?: <U>(fn: () => Promise<U>) => Promise<U>;
    };
    if (typeof transactionalDb.withTransactionAsync === 'function') {
      return transactionalDb.withTransactionAsync(callback);
    }

    await this.db.execAsync('BEGIN');
    try {
      const result = await callback();
      await this.db.execAsync('COMMIT');
      return result;
    } catch (error) {
      await this.db.execAsync('ROLLBACK');
      throw error;
    }
  }

  async findAll(): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      'SELECT * FROM artists ORDER BY name ASC'
    );
  }

  async findFavorites(): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      'SELECT * FROM artists WHERE is_favorite = 1 ORDER BY name ASC'
    );
  }

  async findFavoriteWithRecentInteraction(): Promise<Artist | null> {
    return this.db.getFirstAsync<Artist>(
      `SELECT a.*
       FROM artists a
       JOIN (
         SELECT artist_id, MAX(sort_value) AS last_interaction_at
         FROM (
           SELECT ea.artist_id, MAX(e.event_date) AS sort_value
           FROM event_artists ea
           JOIN events e ON e.id = ea.event_id
           GROUP BY ea.artist_id
           UNION ALL
           SELECT artist_id, MAX(COALESCE(date, created_at)) AS sort_value
           FROM cheki
           WHERE artist_id IS NOT NULL
           GROUP BY artist_id
           UNION ALL
           SELECT artist_id, MAX(COALESCE(date, created_at)) AS sort_value
           FROM cheki_manual_entries
           GROUP BY artist_id
         ) interactions
         GROUP BY artist_id
       ) recent ON recent.artist_id = a.id
       WHERE a.is_favorite = 1
       ORDER BY recent.last_interaction_at DESC, a.name ASC
       LIMIT 1`
    );
  }

  async findById(id: string): Promise<Artist | null> {
    return this.db.getFirstAsync<Artist>(
      'SELECT * FROM artists WHERE id = ?',
      [id]
    );
  }

  async findMembers(parentId: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      'SELECT * FROM artists WHERE parent_id = ? ORDER BY name ASC',
      [parentId]
    );
  }

  async setMembers(parentId: string, memberIds: string[]): Promise<void> {
    const uniqueMemberIds = [...new Set(memberIds.filter((memberId) => memberId && memberId !== parentId))];

    await this.withTransaction(async () => {
      if (uniqueMemberIds.length === 0) {
        await this.db.runAsync('UPDATE artists SET parent_id = NULL WHERE parent_id = ?', [parentId]);
        return;
      }

      const memberPlaceholders = uniqueMemberIds.map(() => '?').join(', ');
      await this.db.runAsync(
        `UPDATE artists
         SET parent_id = NULL
         WHERE parent_id = ?
           AND id NOT IN (${memberPlaceholders})`,
        [parentId, ...uniqueMemberIds],
      );
      await this.db.runAsync(
        `UPDATE artists
         SET parent_id = ?
         WHERE id IN (${memberPlaceholders})`,
        [parentId, ...uniqueMemberIds],
      );
    });
  }

  async create(input: CreateArtistInput | string): Promise<Artist> {
    const name = typeof input === 'string' ? input : input.name;
    const short_name = typeof input === 'string' ? null : (input.short_name ?? null);
    const parent_id = typeof input === 'string' ? null : (input.parent_id ?? null);
    const avatar_uri = typeof input === 'string' ? null : (input.avatar_uri ?? null);
    const background_uri = typeof input === 'string' ? null : (input.background_uri ?? null);
    const background_color = typeof input === 'string' ? null : (input.background_color ?? null);
    const url = typeof input === 'string' ? null : (input.url ?? null);

    const artist: Artist = {
      id: generateId(),
      name,
      short_name,
      parent_id,
      avatar_uri,
      background_uri,
      background_color,
      url,
      is_favorite: 0,
      created_at: toISODateTime(),
    };
    await this.db.runAsync(
      'INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
      [artist.id, artist.name, artist.short_name, artist.parent_id, artist.avatar_uri, artist.background_uri, artist.background_color, artist.url, artist.created_at]
    );
    return artist;
  }

  async update(id: string, input: Partial<CreateArtistInput> & { is_favorite?: number } | string): Promise<void> {
    if (typeof input === 'string') {
      await this.db.runAsync('UPDATE artists SET name = ? WHERE id = ?', [input, id]);
      return;
    }
    const existing = ('avatar_uri' in input || 'background_uri' in input)
      ? await this.db.getFirstAsync<{ avatar_uri: string | null; background_uri: string | null }>(
        'SELECT avatar_uri, background_uri FROM artists WHERE id = ?',
        [id]
      )
      : null;
    const fields: string[] = [];
    const values: unknown[] = [];
    if ('name' in input) { fields.push('name = ?'); values.push(input.name); }
    if ('short_name' in input) { fields.push('short_name = ?'); values.push(input.short_name ?? null); }
    if ('parent_id' in input) { fields.push('parent_id = ?'); values.push(input.parent_id ?? null); }
    if ('avatar_uri' in input) { fields.push('avatar_uri = ?'); values.push(input.avatar_uri ?? null); }
    if ('background_uri' in input) { fields.push('background_uri = ?'); values.push(input.background_uri ?? null); }
    if ('background_color' in input) { fields.push('background_color = ?'); values.push(input.background_color ?? null); }
    if ('url' in input) { fields.push('url = ?'); values.push(input.url ?? null); }
    if ('is_favorite' in input) { fields.push('is_favorite = ?'); values.push(input.is_favorite); }
    if (fields.length === 0) return;
    values.push(id);
    await this.db.runAsync(`UPDATE artists SET ${fields.join(', ')} WHERE id = ?`, values as string[]);
    if ('avatar_uri' in input && existing?.avatar_uri && existing.avatar_uri !== (input.avatar_uri ?? null)) {
      await deleteLocalFileIfUnreferenced(this.db, existing.avatar_uri);
    }
    if ('background_uri' in input && existing?.background_uri && existing.background_uri !== (input.background_uri ?? null)) {
      await deleteLocalFileIfUnreferenced(this.db, existing.background_uri);
    }
  }

  async toggleFavorite(id: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE artists SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?',
      [id]
    );
  }

  async delete(id: string): Promise<void> {
    const artist = await this.db.getFirstAsync<{ avatar_uri: string | null; background_uri: string | null }>(
      'SELECT avatar_uri, background_uri FROM artists WHERE id = ?',
      [id]
    );
    await this.db.runAsync('DELETE FROM artists WHERE id = ?', [id]);
    await deleteLocalFileIfUnreferenced(this.db, artist?.avatar_uri);
    await deleteLocalFileIfUnreferenced(this.db, artist?.background_uri);
  }
}

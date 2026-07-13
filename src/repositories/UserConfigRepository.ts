import { SQLiteDatabase } from 'expo-sqlite';
import { UserConfig, CreateUserConfigInput } from '../types/models';
import { toISODateTime } from '../utils/date';
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';
import { DEFAULT_PROFILE_EMOJI } from '../utils/profile';

export class UserConfigRepository {
  constructor(private db: SQLiteDatabase) {}

  async getConfig(): Promise<UserConfig> {
    try {
      let config = await this.db.getFirstAsync<UserConfig>(
        'SELECT * FROM user_config WHERE id = ?',
        ['default']
      );

      if (!config) {
        const now = toISODateTime();
        const defaultConfig: UserConfig = {
          id: 'default',
          name: 'Otaku',
          avatar_uri: null,
          avatar_emoji: DEFAULT_PROFILE_EMOJI,
          oshi_artist_id: null,
          updated_at: now,
        };
        await this.db.runAsync(
          `INSERT INTO user_config (id, name, avatar_uri, avatar_emoji, oshi_artist_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            defaultConfig.id,
            defaultConfig.name,
            defaultConfig.avatar_uri,
            defaultConfig.avatar_emoji,
            defaultConfig.oshi_artist_id,
            defaultConfig.updated_at,
          ]
        );
        return defaultConfig;
      }

      return { ...config, oshi_artist_id: config.oshi_artist_id ?? null };
    } catch (error) {
      // Fallback if table doesn't exist
      const now = toISODateTime();
      return {
        id: 'default',
        name: 'Otaku',
        avatar_uri: null,
        avatar_emoji: DEFAULT_PROFILE_EMOJI,
        oshi_artist_id: null,
        updated_at: now,
      };
    }
  }

  async updateConfig(input: CreateUserConfigInput): Promise<void> {
    const existing = input.avatar_uri !== undefined
      ? await this.db.getFirstAsync<{ avatar_uri: string | null }>(
        'SELECT avatar_uri FROM user_config WHERE id = ?',
        ['default']
      )
      : null;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.avatar_uri !== undefined) { fields.push('avatar_uri = ?'); values.push(input.avatar_uri); }
    if (input.avatar_emoji !== undefined) { fields.push('avatar_emoji = ?'); values.push(input.avatar_emoji); }
    if (input.oshi_artist_id !== undefined) { fields.push('oshi_artist_id = ?'); values.push(input.oshi_artist_id); }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(toISODateTime());
    values.push('default');

    await this.db.runAsync(
      `UPDATE user_config SET ${fields.join(', ')} WHERE id = ?`,
      values as string[]
    );
    if (existing?.avatar_uri && existing.avatar_uri !== (input.avatar_uri ?? null)) {
      await deleteLocalFileIfUnreferenced(this.db, existing.avatar_uri);
    }
    if (input.oshi_artist_id) {
      await this.db.runAsync(
        'UPDATE artists SET is_favorite = 1 WHERE id = ?',
        [input.oshi_artist_id]
      );
    }
  }
}

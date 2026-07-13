import { SQLiteDatabase } from 'expo-sqlite';
import { Photo } from '../types/models';
import { generateId } from '../utils/uuid';
import { toISODateTime } from '../utils/date';
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';

export class PhotoRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<Photo[]> {
    return this.db.getAllAsync<Photo>(
      'SELECT * FROM photos ORDER BY created_at DESC'
    );
  }

  async findByEventId(eventId: string): Promise<Photo[]> {
    return this.db.getAllAsync<Photo>(
      'SELECT * FROM photos WHERE event_id = ? ORDER BY created_at ASC',
      [eventId]
    );
  }

  async create(localUri: string, eventId?: string | null): Promise<Photo> {
    const photo: Photo = {
      id: generateId(),
      event_id: eventId ?? null,
      local_uri: localUri,
      created_at: toISODateTime(),
    };
    await this.db.runAsync(
      'INSERT INTO photos (id, event_id, local_uri, created_at) VALUES (?, ?, ?, ?)',
      [photo.id, photo.event_id, photo.local_uri, photo.created_at]
    );
    return photo;
  }

  async delete(id: string): Promise<void> {
    const photo = await this.db.getFirstAsync<{ local_uri: string }>(
      'SELECT local_uri FROM photos WHERE id = ?',
      [id]
    );
    await this.db.runAsync('DELETE FROM photos WHERE id = ?', [id]);
    await deleteLocalFileIfUnreferenced(this.db, photo?.local_uri);
  }
}

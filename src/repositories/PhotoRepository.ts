import { SQLiteDatabase } from 'expo-sqlite';
import { Photo } from '../types/models';
import { generateId } from '../utils/uuid';
import { toISODateTime } from '../utils/date';
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';

export class PhotoRepository {
  private readonly changeListeners = new Set<() => void>();

  constructor(private db: SQLiteDatabase) {}

  subscribeToChanges(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChanges(): void {
    for (const listener of this.changeListeners) listener();
  }

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
    this.notifyChanges();
    return photo;
  }

  async delete(id: string): Promise<void> {
    const photo = await this.db.getFirstAsync<{ local_uri: string }>(
      'SELECT local_uri FROM photos WHERE id = ?',
      [id]
    );
    await this.db.runAsync('DELETE FROM photos WHERE id = ?', [id]);
    await deleteLocalFileIfUnreferenced(this.db, photo?.local_uri);
    this.notifyChanges();
  }
}

import { SQLiteDatabase } from 'expo-sqlite';
import { Cheki, ChekiCalendarDaySummary, CreateChekiInput, UpdateChekiInput } from '../types/models';
import { generateId } from '../utils/uuid';
import { periodLikeParam, toISODateTime } from '../utils/date';
import { DEFAULT_CHEKI_ASPECT_RATIO } from '../db/chekiV2Schema';

const PHOTO_PROJECTION = `SELECT
  i.id,
  r.event_id,
  r.artist_id,
  COALESCE(front.photo_uri, back.photo_uri) AS photo_uri,
  front.photo_uri AS front_photo_uri,
  back.photo_uri AS back_photo_uri,
  r.date,
  i.unit_price AS price,
  i.notes,
  i.is_favorite,
  i.created_at
FROM cheki_items i
JOIN cheki_records r ON r.id = i.record_id
LEFT JOIN cheki_item_images front ON front.item_id = i.id AND front.side = 'front'
LEFT JOIN cheki_item_images back ON back.item_id = i.id AND back.side = 'back'`;

const ARTIST_LINEAGE_CTE = `WITH RECURSIVE artist_lineage(aid) AS (
  SELECT id FROM artists WHERE id = ?
  UNION
  SELECT a.parent_id FROM artists a
  JOIN artist_lineage ON artist_lineage.aid = a.id
  WHERE a.parent_id IS NOT NULL
)`;

function periodClause(year?: number, month?: number, expression = 'COALESCE(r.date, r.created_at)') {
  if (year == null) return { sql: '1 = 1', params: [] as string[] };
  return { sql: `strftime('%Y-%m', ${expression}) LIKE ?`, params: [periodLikeParam(year, month)] };
}

function assertWholePrice(price: number | null | undefined): void {
  if (price != null && (!Number.isInteger(price) || !Number.isFinite(price) || price < 0)) {
    throw new Error('Cheki price must be null or a non-negative integer');
  }
}

export interface ChekiArtistRankingItem {
  artistId: string | null;
  name: string;
  avatarUri: string | null;
  count: number;
}

export class ChekiRepository {
  private readonly changeListeners = new Set<() => void>();

  constructor(private readonly db: SQLiteDatabase) {}

  subscribeToChanges(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChanges(): void {
    for (const listener of this.changeListeners) listener();
  }

  private findWhere(
    clause = '1 = 1',
    params: Array<string | number | null> = [],
    limit?: number,
  ): Promise<Cheki[]> {
    return this.db.getAllAsync<Cheki>(
      `${PHOTO_PROJECTION}
       WHERE (front.id IS NOT NULL OR back.id IS NOT NULL) AND (${clause})
       ORDER BY COALESCE(r.date, r.created_at) DESC, r.created_at DESC, i.sort_order, i.id
       ${limit == null ? '' : 'LIMIT ?'}`,
      limit == null ? params : [...params, limit],
    );
  }

  async findAll(): Promise<Cheki[]> { return this.findWhere(); }
  async findRecent(limit = 3): Promise<Cheki[]> { return this.findWhere('1 = 1', [], limit); }
  async findByDate(date: string): Promise<Cheki[]> {
    return this.findWhere("strftime('%Y-%m-%d', COALESCE(r.date, r.created_at)) = ?", [date]);
  }
  async findByEventId(eventId: string): Promise<Cheki[]> { return this.findWhere('r.event_id = ?', [eventId]); }
  async findByArtistId(artistId: string): Promise<Cheki[]> { return this.findWhere('r.artist_id = ?', [artistId]); }
  async findById(id: string): Promise<Cheki | null> { return (await this.findWhere('i.id = ?', [id]))[0] ?? null; }

  async findCalendarSummariesByMonth(year: number, month: number): Promise<ChekiCalendarDaySummary[]> {
    const rows = await this.db.getAllAsync<{
      record_date: string;
      total_count: number;
      photo_count: number;
      no_photo_count: number;
      artist_count: number;
      latest_photo_uri: string | null;
      fallback_artist_avatar_uri: string | null;
    }>(
      `SELECT
         strftime('%Y-%m-%d', COALESCE(r.date, r.created_at)) AS record_date,
         SUM(r.quantity) AS total_count,
         SUM((SELECT COUNT(*) FROM cheki_items i
              WHERE i.record_id = r.id
                AND EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id))) AS photo_count,
         SUM((SELECT COUNT(*) FROM cheki_items i
              WHERE i.record_id = r.id
                AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id))) AS no_photo_count,
         COUNT(DISTINCT r.artist_id) AS artist_count,
         (
           SELECT COALESCE(f.photo_uri, b.photo_uri)
           FROM cheki_records rr
           JOIN cheki_items ii ON ii.record_id = rr.id
           LEFT JOIN cheki_item_images f ON f.item_id = ii.id AND f.side = 'front'
           LEFT JOIN cheki_item_images b ON b.item_id = ii.id AND b.side = 'back'
           WHERE strftime('%Y-%m-%d', COALESCE(rr.date, rr.created_at))
             = strftime('%Y-%m-%d', COALESCE(r.date, r.created_at))
           ORDER BY COALESCE(rr.date, rr.created_at) DESC, rr.created_at DESC, ii.sort_order
           LIMIT 1
         ) AS latest_photo_uri,
         (
           SELECT a.avatar_uri
           FROM cheki_records rr
           LEFT JOIN artists a ON a.id = rr.artist_id
           WHERE strftime('%Y-%m-%d', COALESCE(rr.date, rr.created_at))
             = strftime('%Y-%m-%d', COALESCE(r.date, r.created_at))
             AND EXISTS (
               SELECT 1 FROM cheki_items ii
               WHERE ii.record_id = rr.id
                 AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = ii.id)
             )
             AND a.avatar_uri IS NOT NULL
           ORDER BY COALESCE(rr.date, rr.created_at) DESC, rr.created_at DESC
           LIMIT 1
         ) AS fallback_artist_avatar_uri
       FROM cheki_records r
       WHERE strftime('%Y-%m', COALESCE(r.date, r.created_at)) = ?
       GROUP BY record_date
       ORDER BY record_date`,
      [`${year}-${String(month).padStart(2, '0')}`],
    );
    return rows.map((row) => ({
      date: row.record_date,
      totalCount: row.total_count,
      photoCount: row.photo_count,
      noPhotoCount: row.no_photo_count,
      artistCount: row.artist_count,
      latestPhotoUri: row.latest_photo_uri,
      fallbackArtistAvatarUri: row.fallback_artist_avatar_uri,
    }));
  }

  async findDistinctArtistIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ artist_id: string }>(
      'SELECT DISTINCT artist_id FROM cheki_records WHERE artist_id IS NOT NULL ORDER BY artist_id',
    );
    return rows.map((row) => row.artist_id);
  }

  async findDistinctPhotoArtistIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ artist_id: string }>(
      `SELECT DISTINCT r.artist_id
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       JOIN cheki_item_images image ON image.item_id = i.id
       WHERE r.artist_id IS NOT NULL
       ORDER BY r.artist_id`,
    );
    return rows.map((row) => row.artist_id);
  }

  private async scalar(sql: string, params: Array<string | number | null> = []): Promise<number> {
    const row = await this.db.getFirstAsync<{ value: number }>(sql, params);
    return row?.value ?? 0;
  }

  async countAll(): Promise<number> {
    return this.scalar('SELECT COALESCE(SUM(quantity), 0) AS value FROM cheki_records');
  }
  async sumPriceAll(): Promise<number> {
    return this.scalar('SELECT COALESCE(SUM(unit_price), 0) AS value FROM cheki_items');
  }
  async countByYear(year?: number, month?: number): Promise<number> {
    const period = periodClause(year, month);
    return this.scalar(
      `SELECT COALESCE(SUM(r.quantity), 0) AS value FROM cheki_records r WHERE ${period.sql}`,
      period.params,
    );
  }
  async sumPriceByYear(year?: number, month?: number): Promise<number> {
    const period = periodClause(year, month);
    return this.scalar(
      `SELECT COALESCE(SUM(i.unit_price), 0) AS value
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE ${period.sql}`,
      period.params,
    );
  }
  async getMonthlyCountsByYear(year: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ month: string; count: number }>(
      `SELECT strftime('%m', COALESCE(date, created_at)) AS month, SUM(quantity) AS count
       FROM cheki_records
       WHERE strftime('%Y', COALESCE(date, created_at)) = ?
       GROUP BY month`,
      [String(year)],
    );
    const counts = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => counts.get(String(index + 1).padStart(2, '0')) ?? 0);
  }
  async groupByArtistYear(year?: number, month?: number, limit?: number): Promise<ChekiArtistRankingItem[]> {
    const period = periodClause(year, month);
    const rows = await this.db.getAllAsync<{
      artist_id: string | null;
      artist_name: string | null;
      avatar_uri: string | null;
      count: number;
    }>(
      `SELECT r.artist_id, a.name AS artist_name, a.avatar_uri, SUM(r.quantity) AS count
       FROM cheki_records r
       LEFT JOIN artists a ON a.id = r.artist_id
       WHERE ${period.sql}
       GROUP BY r.artist_id, a.name, a.avatar_uri
       ORDER BY count DESC, MAX(COALESCE(r.date, r.created_at)) DESC, a.name ASC
       ${limit == null ? '' : 'LIMIT ?'}`,
      limit == null ? period.params : [...period.params, limit],
    );
    return rows.map((row) => ({
      artistId: row.artist_id,
      name: row.artist_name ?? '未关联艺人',
      avatarUri: row.avatar_uri,
      count: row.count,
    }));
  }
  async countByArtistYear(year: number | undefined, artistId: string, month?: number): Promise<number> {
    const period = periodClause(year, month);
    return this.scalar(
      `${ARTIST_LINEAGE_CTE}
       SELECT COALESCE(SUM(r.quantity), 0) AS value
       FROM cheki_records r
       WHERE r.artist_id IN (SELECT aid FROM artist_lineage) AND ${period.sql}`,
      [artistId, ...period.params],
    );
  }
  async getMonthlyCountsByArtistYear(year: number, artistId: string): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ month: string; count: number }>(
      `${ARTIST_LINEAGE_CTE}
       SELECT strftime('%m', COALESCE(r.date, r.created_at)) AS month, SUM(r.quantity) AS count
       FROM cheki_records r
       WHERE r.artist_id IN (SELECT aid FROM artist_lineage)
         AND strftime('%Y', COALESCE(r.date, r.created_at)) = ?
       GROUP BY month`,
      [artistId, String(year)],
    );
    const counts = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => counts.get(String(index + 1).padStart(2, '0')) ?? 0);
  }
  async countDistinctArtistsByYear(year?: number, month?: number): Promise<number> {
    const period = periodClause(year, month);
    return this.scalar(
      `SELECT COUNT(DISTINCT r.artist_id) AS value
       FROM cheki_records r
       WHERE r.artist_id IS NOT NULL AND ${period.sql}`,
      period.params,
    );
  }
  async sumPriceByEventIdYear(year: number): Promise<Record<string, number>> {
    const rows = await this.db.getAllAsync<{ event_id: string; total: number }>(
      `SELECT r.event_id, COALESCE(SUM(i.unit_price), 0) AS total
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE r.event_id IS NOT NULL AND strftime('%Y', COALESCE(r.date, r.created_at)) = ?
       GROUP BY r.event_id`,
      [String(year)],
    );
    return Object.fromEntries(rows.map((row) => [row.event_id, row.total]));
  }
  async countByArtistId(artistId: string): Promise<number> {
    return this.scalar(
      'SELECT COALESCE(SUM(quantity), 0) AS value FROM cheki_records WHERE artist_id = ?',
      [artistId],
    );
  }
  async countByEventId(eventId: string): Promise<number> {
    return this.scalar(
      'SELECT COALESCE(SUM(quantity), 0) AS value FROM cheki_records WHERE event_id = ?',
      [eventId],
    );
  }
  async sumPriceByArtistId(artistId: string): Promise<number> {
    return this.scalar(
      `SELECT COALESCE(SUM(i.unit_price), 0) AS value
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE r.artist_id = ?`,
      [artistId],
    );
  }
  async sumPriceByEventId(eventId: string): Promise<number> {
    return this.scalar(
      `SELECT COALESCE(SUM(i.unit_price), 0) AS value
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE r.event_id = ?`,
      [eventId],
    );
  }

  async create(input: CreateChekiInput): Promise<Cheki> {
    assertWholePrice(input.price);
    const now = toISODateTime();
    const recordId = generateId();
    const itemId = generateId();
    const imageId = generateId();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO cheki_records
           (id, event_id, artist_id, date, quantity, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, NULL, ?, ?)`,
        [recordId, input.event_id ?? null, input.artist_id ?? null, input.date ?? null, now, now],
      );
      await this.db.runAsync(
        `INSERT INTO cheki_items
           (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, notes, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?, 0, ?, ?, ?)`,
        [itemId, recordId, input.price ?? 0, DEFAULT_CHEKI_ASPECT_RATIO, input.notes ?? null, now, now],
      );
      await this.db.runAsync(
        `INSERT INTO cheki_item_images
           (id, item_id, side, photo_uri, created_at, updated_at)
         VALUES (?, ?, 'front', ?, ?, ?)`,
        [imageId, itemId, input.photo_uri, now, now],
      );
    });
    this.notifyChanges();
    return {
      id: itemId,
      event_id: input.event_id ?? null,
      artist_id: input.artist_id ?? null,
      photo_uri: input.photo_uri,
      front_photo_uri: input.photo_uri,
      back_photo_uri: null,
      date: input.date ?? null,
      price: input.price ?? null,
      notes: input.notes ?? null,
      is_favorite: 0,
      created_at: now,
    };
  }

  private async assertLegacyItemCanMutate(id: string): Promise<{ record_id: string }> {
    const row = await this.db.getFirstAsync<{ record_id: string; quantity: number; item_count: number }>(
      `SELECT i.record_id, r.quantity,
         (SELECT COUNT(*) FROM cheki_items siblings WHERE siblings.record_id = r.id) AS item_count
       FROM cheki_items i
       JOIN cheki_records r ON r.id = i.record_id
       WHERE i.id = ?`,
      [id],
    );
    if (!row) throw new Error('Cheki item not found');
    if (row.quantity !== 1 || row.item_count !== 1) {
      throw new Error('Aggregated cheki records cannot be edited through the legacy item interface');
    }
    return row;
  }

  async update(id: string, input: UpdateChekiInput): Promise<void> {
    const item = await this.assertLegacyItemCanMutate(id);
    if ('price' in input) assertWholePrice(input.price);
    const recordFields: string[] = [];
    const recordValues: Array<string | number | null> = [];
    for (const [key, column] of [
      ['date', 'date'],
      ['artist_id', 'artist_id'],
      ['event_id', 'event_id'],
    ] as const) {
      if (key in input) {
        recordFields.push(`${column} = ?`);
        recordValues.push(input[key] ?? null);
      }
    }
    const now = toISODateTime();
    await this.db.withTransactionAsync(async () => {
      if (recordFields.length > 0) {
        recordFields.push('updated_at = ?');
        recordValues.push(now, item.record_id);
        await this.db.runAsync(
          `UPDATE cheki_records SET ${recordFields.join(', ')} WHERE id = ?`,
          recordValues,
        );
      }
      if ('notes' in input) {
        await this.db.runAsync(
          'UPDATE cheki_items SET notes = ?, updated_at = ? WHERE id = ?',
          [input.notes ?? null, now, id],
        );
      }
      if ('price' in input) {
        await this.db.runAsync(
          'UPDATE cheki_items SET unit_price = ?, updated_at = ? WHERE id = ?',
          [input.price ?? 0, now, id],
        );
      }
    });
    this.notifyChanges();
  }

  async setFavorite(id: string, isFavorite: boolean): Promise<void> {
    await this.db.runAsync(
      'UPDATE cheki_items SET is_favorite = ?, updated_at = ? WHERE id = ?',
      [isFavorite ? 1 : 0, toISODateTime(), id],
    );
    this.notifyChanges();
  }

  async delete(id: string): Promise<void> {
    const item = await this.db.getFirstAsync<{ record_id: string; quantity: number }>(
      `SELECT i.record_id, r.quantity
       FROM cheki_items i
       JOIN cheki_records r ON r.id = i.record_id
       WHERE i.id = ?`,
      [id],
    );
    if (!item) throw new Error('Cheki item not found');
    await this.db.withTransactionAsync(async () => {
      if (item.quantity <= 1) {
        await this.db.runAsync('DELETE FROM cheki_records WHERE id = ?', [item.record_id]);
        return;
      }
      await this.db.runAsync('DELETE FROM cheki_items WHERE id = ?', [id]);
      await this.db.runAsync(
        'UPDATE cheki_records SET quantity = quantity - 1, updated_at = ? WHERE id = ?',
        [toISODateTime(), item.record_id],
      );
    });
    this.notifyChanges();
  }
}

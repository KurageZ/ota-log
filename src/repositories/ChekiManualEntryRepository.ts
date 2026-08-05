import { SQLiteDatabase } from 'expo-sqlite';
import {
  ChekiManualEntry,
  CreateChekiManualEntryInput,
  UpdateChekiManualEntryInput,
} from '../types/models';
import { generateId } from '../utils/uuid';
import { periodLikeParam, toISODateTime } from '../utils/date';
import { DEFAULT_CHEKI_ASPECT_RATIO } from '../db/chekiV2Schema';

const MANUAL_PROJECTION = `SELECT
  r.id,
  r.artist_id,
  r.event_id,
  r.date,
  SUM(CASE WHEN NOT EXISTS (
    SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id
  ) THEN 1 ELSE 0 END) AS count,
  SUM(CASE WHEN NOT EXISTS (
    SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id
  ) THEN i.unit_price ELSE 0 END) AS total_price,
  r.created_at,
  r.updated_at
FROM cheki_records r
JOIN cheki_items i ON i.record_id = r.id`;

const MANUAL_GROUP = `GROUP BY
  r.id, r.artist_id, r.event_id, r.date, r.quantity,
  r.created_at, r.updated_at
HAVING count > 0`;

function assertValidCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Cheki manual entry count must be an integer greater than or equal to 1');
  }
}

function assertValidTotalPrice(totalPrice: number | null | undefined): void {
  if (
    totalPrice != null
    && (!Number.isInteger(totalPrice) || !Number.isFinite(totalPrice) || totalPrice < 0)
  ) {
    throw new Error('Cheki manual entry total_price must be null or a non-negative integer');
  }
}

function distributeTotalPrice(totalPrice: number, count: number): number[] {
  const base = Math.floor(totalPrice / count);
  const remainder = totalPrice % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export class ChekiManualEntryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  private async findWhere(
    clause = '1 = 1',
    params: Array<string | number | null> = [],
  ): Promise<ChekiManualEntry[]> {
    return this.db.getAllAsync<ChekiManualEntry>(
      `${MANUAL_PROJECTION}
       WHERE ${clause}
       ${MANUAL_GROUP}
       ORDER BY COALESCE(r.date, r.created_at) DESC, r.created_at DESC`,
      params,
    );
  }

  async findAll(): Promise<ChekiManualEntry[]> {
    return this.findWhere();
  }

  async findById(id: string): Promise<ChekiManualEntry | null> {
    return (await this.findWhere('r.id = ?', [id]))[0] ?? null;
  }

  async findByArtistId(artistId: string): Promise<ChekiManualEntry[]> {
    return this.findWhere('r.artist_id = ?', [artistId]);
  }

  async findByEventId(eventId: string): Promise<ChekiManualEntry[]> {
    return this.findWhere('r.event_id = ?', [eventId]);
  }

  async findByDate(date: string): Promise<ChekiManualEntry[]> {
    return this.findWhere(
      "strftime('%Y-%m-%d', COALESCE(r.date, r.created_at)) = ?",
      [date],
    );
  }

  async sumCountAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM cheki_items i
       WHERE NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)`,
    );
    return row?.total ?? 0;
  }

  async sumPriceAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(i.unit_price), 0) AS total
       FROM cheki_items i
       WHERE NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)`,
    );
    return row?.total ?? 0;
  }

  async countByYear(year: number, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
         AND strftime('%Y-%m', COALESCE(r.date, r.created_at)) LIKE ?`,
      [periodLikeParam(year, month)],
    );
    return row?.total ?? 0;
  }

  async sumPriceByYear(year: number, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(i.unit_price), 0) AS total
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
         AND strftime('%Y-%m', COALESCE(r.date, r.created_at)) LIKE ?`,
      [periodLikeParam(year, month)],
    );
    return row?.total ?? 0;
  }

  async getMonthlyCountsByYear(year: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ month: string; count: number }>(
      `SELECT
         strftime('%m', COALESCE(r.date, r.created_at)) AS month,
         COUNT(i.id) AS count
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE strftime('%Y', COALESCE(r.date, r.created_at)) = ?
         AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
       GROUP BY month`,
      [String(year)],
    );
    const counts = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => counts.get(String(index + 1).padStart(2, '0')) ?? 0);
  }

  async groupByArtistYear(
    year: number,
    month?: number,
    limit = 6,
  ): Promise<Array<{ artistId: string; name: string; count: number }>> {
    const rows = await this.db.getAllAsync<{
      artist_id: string;
      artist_name: string | null;
      count: number;
    }>(
      `SELECT
         r.artist_id,
         a.name AS artist_name,
         COUNT(i.id) AS count
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       LEFT JOIN artists a ON a.id = r.artist_id
       WHERE r.artist_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
         AND strftime('%Y-%m', COALESCE(r.date, r.created_at)) LIKE ?
       GROUP BY r.artist_id, a.name
       HAVING count > 0
       ORDER BY count DESC, MAX(COALESCE(r.date, r.created_at)) DESC, a.name ASC
       LIMIT ?`,
      [periodLikeParam(year, month), limit],
    );
    return rows.map((row) => ({
      artistId: row.artist_id,
      name: row.artist_name ?? '未知艺人',
      count: row.count,
    }));
  }

  async countByArtistYear(year: number, artistId: string, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(i.id) AS total
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE r.artist_id = ?
         AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
         AND strftime('%Y-%m', COALESCE(r.date, r.created_at)) LIKE ?`,
      [artistId, periodLikeParam(year, month)],
    );
    return row?.total ?? 0;
  }

  async getMonthlyCountsByArtistYear(year: number, artistId: string): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ month: string; count: number }>(
      `SELECT
         strftime('%m', COALESCE(r.date, r.created_at)) AS month,
         COUNT(i.id) AS count
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE r.artist_id = ?
         AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
         AND strftime('%Y', COALESCE(r.date, r.created_at)) = ?
       GROUP BY month`,
      [artistId, String(year)],
    );
    const counts = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => counts.get(String(index + 1).padStart(2, '0')) ?? 0);
  }

  async countDistinctArtistsByYear(year: number, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT r.artist_id) AS count
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE r.artist_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
         AND strftime('%Y-%m', COALESCE(r.date, r.created_at)) LIKE ?`,
      [periodLikeParam(year, month)],
    );
    return row?.count ?? 0;
  }

  async sumPriceByEventIdYear(year: number): Promise<Record<string, number>> {
    const rows = await this.db.getAllAsync<{ event_id: string; total: number }>(
      `SELECT r.event_id, COALESCE(SUM(i.unit_price), 0) AS total
       FROM cheki_records r
       JOIN cheki_items i ON i.record_id = r.id
       WHERE r.event_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM cheki_item_images image WHERE image.item_id = i.id)
         AND strftime('%Y', COALESCE(r.date, r.created_at)) = ?
       GROUP BY r.event_id`,
      [String(year)],
    );
    return Object.fromEntries(rows.map((row) => [row.event_id, row.total]));
  }

  async create(input: CreateChekiManualEntryInput): Promise<ChekiManualEntry> {
    assertValidCount(input.count);
    assertValidTotalPrice(input.total_price);
    const now = toISODateTime();
    const entry: ChekiManualEntry = {
      id: generateId(),
      artist_id: input.artist_id,
      event_id: input.event_id ?? null,
      date: input.date ?? null,
      count: input.count,
      total_price: input.total_price ?? null,
      created_at: now,
      updated_at: now,
    };
    const unitPrices = distributeTotalPrice(entry.total_price ?? 0, entry.count);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO cheki_records
           (id, event_id, artist_id, date, quantity, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          entry.id,
          entry.event_id,
          entry.artist_id,
          entry.date,
          entry.count,
          entry.created_at,
          entry.updated_at,
        ],
      );
      for (let index = 0; index < entry.count; index += 1) {
        await this.db.runAsync(
          `INSERT INTO cheki_items
             (id, record_id, sort_order, unit_price, display_aspect_ratio,
              is_favorite, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
          [generateId(), entry.id, index, unitPrices[index], DEFAULT_CHEKI_ASPECT_RATIO, now, now],
        );
      }
    });
    return entry;
  }

  async update(id: string, input: UpdateChekiManualEntryInput): Promise<void> {
    const imageCount = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM cheki_item_images image
       JOIN cheki_items item ON item.id = image.item_id
       WHERE item.record_id = ?`,
      [id],
    );
    if ((imageCount?.count ?? 0) > 0) {
      throw new Error('Partially or fully archived cheki records cannot be edited as manual entries');
    }
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    if ('artist_id' in input && input.artist_id) {
      fields.push('artist_id = ?');
      values.push(input.artist_id);
    }
    if ('event_id' in input) {
      fields.push('event_id = ?');
      values.push(input.event_id ?? null);
    }
    if ('date' in input) {
      fields.push('date = ?');
      values.push(input.date ?? null);
    }
    const currentItems = await this.db.getAllAsync<{ id: string; unit_price: number }>(
      'SELECT id, unit_price FROM cheki_items WHERE record_id = ? ORDER BY sort_order, id',
      [id],
    );
    const nextCount = input.count ?? currentItems.length;
    assertValidCount(nextCount);
    assertValidTotalPrice(input.total_price);
    const nextTotal = 'total_price' in input
      ? input.total_price ?? 0
      : currentItems.reduce((sum, item) => sum + item.unit_price, 0);
    const nextPrices = distributeTotalPrice(nextTotal, nextCount);
    const now = toISODateTime();

    await this.db.withTransactionAsync(async () => {
      if (nextCount < currentItems.length) {
        for (const item of currentItems.slice(nextCount)) {
          await this.db.runAsync('DELETE FROM cheki_items WHERE id = ?', [item.id]);
        }
      }
      fields.push('quantity = ?', 'updated_at = ?');
      values.push(nextCount, now, id);
      await this.db.runAsync(`UPDATE cheki_records SET ${fields.join(', ')} WHERE id = ?`, values);

      for (let index = currentItems.length; index < nextCount; index += 1) {
        await this.db.runAsync(
          `INSERT INTO cheki_items
             (id, record_id, sort_order, unit_price, display_aspect_ratio,
              is_favorite, notes, created_at, updated_at)
           VALUES (?, ?, ?, 0, ?, 0, NULL, ?, ?)`,
          [generateId(), id, index, DEFAULT_CHEKI_ASPECT_RATIO, now, now],
        );
      }
      const finalItems = await this.db.getAllAsync<{ id: string }>(
        'SELECT id FROM cheki_items WHERE record_id = ? ORDER BY sort_order, id',
        [id],
      );
      for (let index = 0; index < finalItems.length; index += 1) {
        await this.db.runAsync(
          'UPDATE cheki_items SET unit_price = ?, updated_at = ? WHERE id = ?',
          [nextPrices[index], now, finalItems[index].id],
        );
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM cheki_records WHERE id = ?', [id]);
  }
}

import { SQLiteDatabase } from 'expo-sqlite';
import {
  ChekiManualEntry,
  CreateChekiManualEntryInput,
  UpdateChekiManualEntryInput,
} from '../types/models';
import { generateId } from '../utils/uuid';
import { periodLikeParam, toISODateTime } from '../utils/date';

interface MonthlyCountRow {
  month: string;
  count: number;
}

interface ArtistRankingRow {
  artist_id: string;
  artist_name: string | null;
  count: number;
}

interface EventPriceRow {
  event_id: string;
  total: number;
}

function assertValidCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Cheki manual entry count must be an integer greater than or equal to 1');
  }
}

function assertValidTotalPrice(totalPrice: number | null | undefined): void {
  if (totalPrice != null && (!Number.isFinite(totalPrice) || totalPrice < 0)) {
    throw new Error('Cheki manual entry total_price must be null or a non-negative number');
  }
}

export class ChekiManualEntryRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<ChekiManualEntry[]> {
    return this.db.getAllAsync<ChekiManualEntry>(
      'SELECT * FROM cheki_manual_entries ORDER BY COALESCE(date, created_at) DESC, created_at DESC'
    );
  }

  async findById(id: string): Promise<ChekiManualEntry | null> {
    return this.db.getFirstAsync<ChekiManualEntry>(
      'SELECT * FROM cheki_manual_entries WHERE id = ?',
      [id]
    );
  }

  async findByArtistId(artistId: string): Promise<ChekiManualEntry[]> {
    return this.db.getAllAsync<ChekiManualEntry>(
      'SELECT * FROM cheki_manual_entries WHERE artist_id = ? ORDER BY COALESCE(date, created_at) DESC, created_at DESC',
      [artistId]
    );
  }

  async findByEventId(eventId: string): Promise<ChekiManualEntry[]> {
    return this.db.getAllAsync<ChekiManualEntry>(
      'SELECT * FROM cheki_manual_entries WHERE event_id = ? ORDER BY COALESCE(date, created_at) DESC, created_at DESC',
      [eventId]
    );
  }

  async findByDate(date: string): Promise<ChekiManualEntry[]> {
    return this.db.getAllAsync<ChekiManualEntry>(
      `SELECT *
       FROM cheki_manual_entries
       WHERE strftime('%Y-%m-%d', COALESCE(date, created_at)) = ?
       ORDER BY COALESCE(date, created_at) DESC, created_at DESC`,
      [date]
    );
  }

  async sumCountAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(count), 0) AS total FROM cheki_manual_entries'
    );
    return row?.total ?? 0;
  }

  async sumPriceAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(total_price), 0) AS total FROM cheki_manual_entries'
    );
    return row?.total ?? 0;
  }

  async countByYear(year: number, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM cheki_manual_entries
       WHERE strftime('%Y-%m', COALESCE(date, created_at)) LIKE ?`,
      [periodLikeParam(year, month)]
    );
    return row?.total ?? 0;
  }

  async sumPriceByYear(year: number, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total_price), 0) AS total
       FROM cheki_manual_entries
       WHERE strftime('%Y-%m', COALESCE(date, created_at)) LIKE ?`,
      [periodLikeParam(year, month)]
    );
    return row?.total ?? 0;
  }

  async getMonthlyCountsByYear(year: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<MonthlyCountRow>(
      `SELECT strftime('%m', COALESCE(date, created_at)) AS month, COALESCE(SUM(count), 0) AS count
       FROM cheki_manual_entries
       WHERE strftime('%Y', COALESCE(date, created_at)) = ?
       GROUP BY strftime('%m', COALESCE(date, created_at))`,
      [String(year)]
    );
    const monthMap = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return monthMap.get(month) ?? 0;
    });
  }

  async groupByArtistYear(
    year: number,
    month?: number,
    limit = 6,
  ): Promise<Array<{ artistId: string; name: string; count: number }>> {
    const rows = await this.db.getAllAsync<ArtistRankingRow>(
      `SELECT
         m.artist_id,
         a.name AS artist_name,
         COALESCE(SUM(m.count), 0) AS count
       FROM cheki_manual_entries m
       LEFT JOIN artists a ON a.id = m.artist_id
       WHERE strftime('%Y-%m', COALESCE(m.date, m.created_at)) LIKE ?
       GROUP BY m.artist_id, a.name
       ORDER BY count DESC, MAX(COALESCE(m.date, m.created_at)) DESC, a.name ASC
       LIMIT ?`,
      [periodLikeParam(year, month), limit]
    );

    return rows.map((row) => ({
      artistId: row.artist_id,
      name: row.artist_name ?? '未知艺人',
      count: row.count,
    }));
  }

  async countByArtistYear(year: number, artistId: string, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM cheki_manual_entries
       WHERE artist_id = ?
         AND strftime('%Y-%m', COALESCE(date, created_at)) LIKE ?`,
      [artistId, periodLikeParam(year, month)]
    );
    return row?.total ?? 0;
  }

  async getMonthlyCountsByArtistYear(year: number, artistId: string): Promise<number[]> {
    const rows = await this.db.getAllAsync<MonthlyCountRow>(
      `SELECT strftime('%m', COALESCE(date, created_at)) AS month, COALESCE(SUM(count), 0) AS count
       FROM cheki_manual_entries
       WHERE artist_id = ?
         AND strftime('%Y', COALESCE(date, created_at)) = ?
       GROUP BY strftime('%m', COALESCE(date, created_at))`,
      [artistId, String(year)]
    );
    const monthMap = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return monthMap.get(month) ?? 0;
    });
  }

  async countDistinctArtistsByYear(year: number, month?: number): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT artist_id) AS count
       FROM cheki_manual_entries
       WHERE strftime('%Y-%m', COALESCE(date, created_at)) LIKE ?`,
      [periodLikeParam(year, month)]
    );
    return row?.count ?? 0;
  }

  async sumPriceByEventIdYear(year: number): Promise<Record<string, number>> {
    const rows = await this.db.getAllAsync<EventPriceRow>(
      `SELECT event_id, COALESCE(SUM(total_price), 0) AS total
       FROM cheki_manual_entries
       WHERE event_id IS NOT NULL
         AND strftime('%Y', COALESCE(date, created_at)) = ?
       GROUP BY event_id`,
      [String(year)]
    );

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.event_id] = row.total;
      return acc;
    }, {});
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

    await this.db.runAsync(
      `INSERT INTO cheki_manual_entries
         (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.artist_id,
        entry.event_id,
        entry.date,
        entry.count,
        entry.total_price,
        entry.created_at,
        entry.updated_at,
      ]
    );

    return entry;
  }

  async update(id: string, input: UpdateChekiManualEntryInput): Promise<void> {
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
    if ('count' in input && typeof input.count === 'number') {
      assertValidCount(input.count);
      fields.push('count = ?');
      values.push(input.count);
    }
    if ('total_price' in input) {
      assertValidTotalPrice(input.total_price);
      fields.push('total_price = ?');
      values.push(input.total_price ?? null);
    }
    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(toISODateTime());
    values.push(id);

    await this.db.runAsync(
      `UPDATE cheki_manual_entries SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM cheki_manual_entries WHERE id = ?', [id]);
  }
}

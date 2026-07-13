import { SQLiteDatabase } from 'expo-sqlite';
import { Cheki, ChekiCalendarDaySummary, CreateChekiInput, UpdateChekiInput } from '../types/models';
import { generateId } from '../utils/uuid';
import { periodLikeParam, toISODateTime } from '../utils/date';
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';

/**
 * 递归 CTE：给定艺人 id（占位符 ?），展开「本人 + 沿 parent_id 递归向上的各级所属团体」。
 * 与 EventRepository 中口径一致，供按艺人统计拍立得时匹配团体记录。
 */
const ARTIST_LINEAGE_CTE = `WITH RECURSIVE artist_lineage(aid) AS (
  SELECT id FROM artists WHERE id = ?
  UNION
  SELECT a.parent_id FROM artists a
  JOIN artist_lineage ON artist_lineage.aid = a.id
  WHERE a.parent_id IS NOT NULL
)`;

interface MonthlyCountRow {
  month: string;
  count: number;
}

interface ArtistRankingRow {
  artist_id: string | null;
  artist_name: string | null;
  avatar_uri: string | null;
  count: number;
}

export interface ChekiArtistRankingItem {
  artistId: string | null;
  name: string;
  avatarUri: string | null;
  count: number;
}

interface EventPriceRow {
  event_id: string;
  total: number;
}

interface CalendarSummaryRow {
  record_date: string;
  total_count: number;
  photo_count: number;
  no_photo_count: number;
  artist_count: number;
  latest_photo_uri: string | null;
  fallback_artist_avatar_uri: string | null;
}

function chekiPeriodClause(year?: number, month?: number, expression = "COALESCE(date, created_at)") {
  if (year == null) return { sql: '1 = 1', params: [] as string[] };
  return {
    sql: `strftime('%Y-%m', ${expression}) LIKE ?`,
    params: [periodLikeParam(year, month)],
  };
}

export class ChekiRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<Cheki[]> {
    return this.db.getAllAsync<Cheki>(
      'SELECT * FROM cheki ORDER BY COALESCE(date, created_at) DESC, created_at DESC'
    );
  }

  async findRecent(limit = 3): Promise<Cheki[]> {
    return this.db.getAllAsync<Cheki>(
      `SELECT *
       FROM cheki
       ORDER BY COALESCE(date, created_at) DESC, created_at DESC
       LIMIT ?`,
      [limit]
    );
  }

  async findByDate(date: string): Promise<Cheki[]> {
    return this.db.getAllAsync<Cheki>(
      `SELECT *
       FROM cheki
       WHERE strftime('%Y-%m-%d', COALESCE(date, created_at)) = ?
       ORDER BY COALESCE(date, created_at) DESC, created_at DESC`,
      [date]
    );
  }

  async findCalendarSummariesByMonth(year: number, month: number): Promise<ChekiCalendarDaySummary[]> {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const rows = await this.db.getAllAsync<CalendarSummaryRow>(
      `WITH combined AS (
         SELECT
           strftime('%Y-%m-%d', COALESCE(c.date, c.created_at)) AS record_date,
           1 AS total_count,
           1 AS photo_count,
           0 AS no_photo_count,
           c.artist_id AS artist_id,
           c.photo_uri AS photo_uri,
           NULL AS fallback_artist_avatar_uri,
           COALESCE(c.date, c.created_at) AS sort_value,
           c.created_at AS created_at
         FROM cheki c
         WHERE strftime('%Y-%m', COALESCE(c.date, c.created_at)) = ?
         UNION ALL
         SELECT
           strftime('%Y-%m-%d', COALESCE(m.date, m.created_at)) AS record_date,
           m.count AS total_count,
           0 AS photo_count,
           m.count AS no_photo_count,
           m.artist_id AS artist_id,
           NULL AS photo_uri,
           a.avatar_uri AS fallback_artist_avatar_uri,
           COALESCE(m.date, m.created_at) AS sort_value,
           m.created_at AS created_at
         FROM cheki_manual_entries m
         LEFT JOIN artists a ON a.id = m.artist_id
         WHERE strftime('%Y-%m', COALESCE(m.date, m.created_at)) = ?
       ),
       aggregated AS (
         SELECT
           record_date,
           COALESCE(SUM(total_count), 0) AS total_count,
           COALESCE(SUM(photo_count), 0) AS photo_count,
           COALESCE(SUM(no_photo_count), 0) AS no_photo_count,
           COUNT(DISTINCT artist_id) AS artist_count
         FROM combined
         GROUP BY record_date
       )
       SELECT
         a.record_date,
         a.total_count,
         a.photo_count,
         a.no_photo_count,
         a.artist_count,
         (
           SELECT c.photo_uri
           FROM combined c
           WHERE c.record_date = a.record_date
             AND c.photo_uri IS NOT NULL
           ORDER BY c.sort_value DESC, c.created_at DESC
           LIMIT 1
         ) AS latest_photo_uri,
         (
           SELECT c.fallback_artist_avatar_uri
           FROM combined c
           WHERE c.record_date = a.record_date
             AND c.photo_uri IS NULL
             AND c.fallback_artist_avatar_uri IS NOT NULL
           ORDER BY c.sort_value DESC, c.created_at DESC
           LIMIT 1
         ) AS fallback_artist_avatar_uri
       FROM aggregated a
       ORDER BY a.record_date ASC`,
      [period, period]
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
      `SELECT artist_id
       FROM cheki
       WHERE artist_id IS NOT NULL
       UNION
       SELECT artist_id
       FROM cheki_manual_entries
       ORDER BY artist_id`
    );
    return rows.map((row) => row.artist_id);
  }

  async countAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT
         COALESCE((SELECT COUNT(*) FROM cheki), 0)
         + COALESCE((SELECT SUM(count) FROM cheki_manual_entries), 0) AS count`
    );
    return row?.count ?? 0;
  }

  async sumPriceAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT
         COALESCE((SELECT SUM(price) FROM cheki), 0)
         + COALESCE((SELECT SUM(total_price) FROM cheki_manual_entries), 0) AS total`
    );
    return row?.total ?? 0;
  }

  async countByYear(year?: number, month?: number): Promise<number> {
    const period = chekiPeriodClause(year, month);
    const row = await this.db.getFirstAsync<{ n: number }>(
      `SELECT
         COALESCE((
           SELECT COUNT(*)
           FROM cheki
           WHERE ${period.sql}
         ), 0)
         + COALESCE((
           SELECT SUM(count)
           FROM cheki_manual_entries
           WHERE ${period.sql}
         ), 0) AS n`,
      [...period.params, ...period.params]
    );
    return row?.n ?? 0;
  }

  async sumPriceByYear(year?: number, month?: number): Promise<number> {
    const period = chekiPeriodClause(year, month);
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT
         COALESCE((
           SELECT SUM(price)
           FROM cheki
           WHERE ${period.sql}
         ), 0)
         + COALESCE((
           SELECT SUM(total_price)
           FROM cheki_manual_entries
           WHERE ${period.sql}
         ), 0) AS total`,
      [...period.params, ...period.params]
    );
    return row?.total ?? 0;
  }

  async getMonthlyCountsByYear(year: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<MonthlyCountRow>(
      `SELECT month, COALESCE(SUM(count), 0) AS count
       FROM (
         SELECT strftime('%m', COALESCE(date, created_at)) AS month, COUNT(*) AS count
         FROM cheki
         WHERE strftime('%Y', COALESCE(date, created_at)) = ?
         GROUP BY strftime('%m', COALESCE(date, created_at))
         UNION ALL
         SELECT strftime('%m', COALESCE(date, created_at)) AS month, COALESCE(SUM(count), 0) AS count
         FROM cheki_manual_entries
         WHERE strftime('%Y', COALESCE(date, created_at)) = ?
         GROUP BY strftime('%m', COALESCE(date, created_at))
       ) combined
       GROUP BY month`,
      [String(year), String(year)]
    );
    const monthMap = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return monthMap.get(month) ?? 0;
    });
  }

  async groupByArtistYear(
    year?: number,
    month?: number,
    limit?: number
  ): Promise<ChekiArtistRankingItem[]> {
    const period = chekiPeriodClause(year, month);
    const rows = await this.db.getAllAsync<ArtistRankingRow>(
      `SELECT
         combined.artist_id,
         a.name AS artist_name,
         a.avatar_uri AS avatar_uri,
         COALESCE(SUM(combined.total_count), 0) AS count
       FROM (
         SELECT artist_id, 1 AS total_count, COALESCE(date, created_at) AS sort_value
         FROM cheki
         WHERE ${period.sql}
         UNION ALL
         SELECT artist_id, count AS total_count, COALESCE(date, created_at) AS sort_value
         FROM cheki_manual_entries
         WHERE ${period.sql}
       ) combined
       LEFT JOIN artists a ON a.id = combined.artist_id
       GROUP BY combined.artist_id, a.name, a.avatar_uri
       ORDER BY count DESC, MAX(combined.sort_value) DESC, a.name ASC
       ${limit == null ? '' : 'LIMIT ?'}`,
      limit == null
        ? [...period.params, ...period.params]
        : [...period.params, ...period.params, limit]
    );

    return rows.map((row) => ({
      artistId: row.artist_id,
      name: row.artist_name ?? '未关联艺人',
      avatarUri: row.avatar_uri,
      count: row.count,
    }));
  }

  async countByArtistYear(year: number | undefined, artistId: string, month?: number): Promise<number> {
    const period = chekiPeriodClause(year, month);
    const row = await this.db.getFirstAsync<{ count: number }>(
      `${ARTIST_LINEAGE_CTE}
       SELECT
         COALESCE((
           SELECT COUNT(*)
           FROM cheki
           WHERE artist_id IN (SELECT aid FROM artist_lineage)
             AND ${period.sql}
         ), 0)
         + COALESCE((
           SELECT SUM(count)
           FROM cheki_manual_entries
           WHERE artist_id IN (SELECT aid FROM artist_lineage)
             AND ${period.sql}
         ), 0) AS count`,
      [artistId, ...period.params, ...period.params]
    );
    return row?.count ?? 0;
  }

  async getMonthlyCountsByArtistYear(year: number, artistId: string): Promise<number[]> {
    const rows = await this.db.getAllAsync<MonthlyCountRow>(
      `${ARTIST_LINEAGE_CTE}
       SELECT month, COALESCE(SUM(count), 0) AS count
       FROM (
         SELECT strftime('%m', COALESCE(date, created_at)) AS month, COUNT(*) AS count
         FROM cheki
         WHERE artist_id IN (SELECT aid FROM artist_lineage)
           AND strftime('%Y', COALESCE(date, created_at)) = ?
         GROUP BY strftime('%m', COALESCE(date, created_at))
         UNION ALL
         SELECT strftime('%m', COALESCE(date, created_at)) AS month, COALESCE(SUM(count), 0) AS count
         FROM cheki_manual_entries
         WHERE artist_id IN (SELECT aid FROM artist_lineage)
           AND strftime('%Y', COALESCE(date, created_at)) = ?
         GROUP BY strftime('%m', COALESCE(date, created_at))
       ) combined
       GROUP BY month`,
      [artistId, String(year), String(year)]
    );
    const monthMap = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return monthMap.get(month) ?? 0;
    });
  }

  async countDistinctArtistsByYear(year?: number, month?: number): Promise<number> {
    const period = chekiPeriodClause(year, month);
    const row = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM (
         SELECT DISTINCT artist_id
         FROM cheki
         WHERE artist_id IS NOT NULL
           AND ${period.sql}
         UNION
         SELECT DISTINCT artist_id
         FROM cheki_manual_entries
         WHERE ${period.sql}
       ) artists`,
      [...period.params, ...period.params]
    );
    return row?.count ?? 0;
  }

  async sumPriceByEventIdYear(year: number): Promise<Record<string, number>> {
    const rows = await this.db.getAllAsync<EventPriceRow>(
      `SELECT event_id, COALESCE(SUM(total), 0) AS total
       FROM (
         SELECT event_id, COALESCE(SUM(price), 0) AS total
         FROM cheki
         WHERE event_id IS NOT NULL
           AND strftime('%Y', COALESCE(date, created_at)) = ?
         GROUP BY event_id
         UNION ALL
         SELECT event_id, COALESCE(SUM(total_price), 0) AS total
         FROM cheki_manual_entries
         WHERE event_id IS NOT NULL
           AND strftime('%Y', COALESCE(date, created_at)) = ?
         GROUP BY event_id
       ) combined
       GROUP BY event_id`,
      [String(year), String(year)]
    );

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.event_id] = row.total;
      return acc;
    }, {});
  }

  async countByArtistId(artistId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT
         COALESCE((SELECT COUNT(*) FROM cheki WHERE artist_id = ?), 0)
         + COALESCE((SELECT SUM(count) FROM cheki_manual_entries WHERE artist_id = ?), 0) AS total`,
      [artistId, artistId]
    );
    return row?.total ?? 0;
  }

  async countByEventId(eventId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT
         COALESCE((SELECT COUNT(*) FROM cheki WHERE event_id = ?), 0)
         + COALESCE((SELECT SUM(count) FROM cheki_manual_entries WHERE event_id = ?), 0) AS total`,
      [eventId, eventId]
    );
    return row?.total ?? 0;
  }

  async sumPriceByArtistId(artistId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT
         COALESCE((SELECT SUM(price) FROM cheki WHERE artist_id = ?), 0)
         + COALESCE((SELECT SUM(total_price) FROM cheki_manual_entries WHERE artist_id = ?), 0) AS total`,
      [artistId, artistId]
    );
    return row?.total ?? 0;
  }

  async sumPriceByEventId(eventId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT
         COALESCE((SELECT SUM(price) FROM cheki WHERE event_id = ?), 0)
         + COALESCE((SELECT SUM(total_price) FROM cheki_manual_entries WHERE event_id = ?), 0) AS total`,
      [eventId, eventId]
    );
    return row?.total ?? 0;
  }

  async findByEventId(eventId: string): Promise<Cheki[]> {
    return this.db.getAllAsync<Cheki>(
      'SELECT * FROM cheki WHERE event_id = ? ORDER BY COALESCE(date, created_at) DESC, created_at DESC',
      [eventId]
    );
  }

  async findByArtistId(artistId: string): Promise<Cheki[]> {
    return this.db.getAllAsync<Cheki>(
      'SELECT * FROM cheki WHERE artist_id = ? ORDER BY COALESCE(date, created_at) DESC, created_at DESC',
      [artistId]
    );
  }

  async findById(id: string): Promise<Cheki | null> {
    return this.db.getFirstAsync<Cheki>(
      'SELECT * FROM cheki WHERE id = ?',
      [id]
    );
  }

  async create(input: CreateChekiInput): Promise<Cheki> {
    const cheki: Cheki = {
      id: generateId(),
      event_id: input.event_id ?? null,
      artist_id: input.artist_id ?? null,
      photo_uri: input.photo_uri,
      date: input.date ?? null,
      price: input.price ?? null,
      notes: input.notes ?? null,
      created_at: toISODateTime(),
    };
    await this.db.runAsync(
      'INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [cheki.id, cheki.event_id, cheki.artist_id, cheki.photo_uri, cheki.date, cheki.price, cheki.notes, cheki.created_at]
    );
    return cheki;
  }

  async update(id: string, input: UpdateChekiInput): Promise<void> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if ('date' in input) { fields.push('date = ?'); values.push(input.date ?? null); }
    if ('artist_id' in input) { fields.push('artist_id = ?'); values.push(input.artist_id ?? null); }
    if ('event_id' in input) { fields.push('event_id = ?'); values.push(input.event_id ?? null); }
    if ('price' in input) { fields.push('price = ?'); values.push(input.price ?? null); }
    if ('notes' in input) { fields.push('notes = ?'); values.push(input.notes ?? null); }
    if (fields.length === 0) return;
    values.push(id);
    await this.db.runAsync(`UPDATE cheki SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id: string): Promise<void> {
    const cheki = await this.db.getFirstAsync<{ photo_uri: string }>(
      'SELECT photo_uri FROM cheki WHERE id = ?',
      [id]
    );
    await this.db.runAsync('DELETE FROM cheki WHERE id = ?', [id]);
    await deleteLocalFileIfUnreferenced(this.db, cheki?.photo_uri);
  }
}

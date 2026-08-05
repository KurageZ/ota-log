import { SQLiteDatabase } from 'expo-sqlite';
import { Artist, CreateEventInput, Event, EventStatus } from '../types/models';
import { generateId } from '../utils/uuid';
import { eventDateLikeParam, toISODateTime } from '../utils/date';
import { selectCurrentPlannedEvent } from '../utils/currentEvent';

export interface EventFilter {
  keyword?: string;
  city?: string;
  venue?: string;
  status?: EventStatus;
  artistId?: string;
  artistIds?: string[];
  year?: number;
  month?: number;
  /** 仅保留评分 >= 该值的活动（1-5，仅 completed 会有评分） */
  minScore?: number;
  /** 出演者范围：favorite=任一出演者为收藏；oshi=出演者含单推 */
  artistScope?: 'favorite' | 'oshi';
}
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';

/**
 * 递归 CTE：给定艺人 id（占位符 ?），展开「本人 + 沿 parent_id 递归向上的各级所属团体」。
 * 结果列名为 aid，可用 `... IN (SELECT aid FROM artist_lineage)` 匹配。
 * 占位符顺序：调用方需将 artistId 作为该 CTE 对应位置的参数。
 */
const ARTIST_LINEAGE_CTE = `WITH RECURSIVE artist_lineage(aid) AS (
  SELECT id FROM artists WHERE id = ?
  UNION
  SELECT a.parent_id FROM artists a
  JOIN artist_lineage ON artist_lineage.aid = a.id
  WHERE a.parent_id IS NOT NULL
)`;

interface YearStatusCountsRow {
  completed: number;
  planned: number;
  wishlist: number;
}

interface LabelCountRow {
  label: string;
  count: number;
}

interface MonthlyCountRow {
  month: string;
  count: number;
}

interface OshiArtistCountRow {
  count: number;
}

interface EventSpendRow extends Event {
  ticket_total: number;
  cheki_total: number;
  total_spend: number;
}

interface RootArtistEventCountRow {
  artist_id: string;
  artist_name: string;
  avatar_uri: string | null;
  count: number;
}

export interface EventArtistRankingItem {
  artistId: string;
  name: string;
  avatarUri: string | null;
  count: number;
}

function eventPeriodClause(year?: number, month?: number, column = 'event_date') {
  if (year == null) return { sql: '', params: [] as string[] };
  return {
    sql: ` AND ${column} LIKE ? || '-%'`,
    params: [eventDateLikeParam(year, month)],
  };
}

export class EventRepository {
  private readonly changeListeners = new Set<() => void>();

  constructor(private db: SQLiteDatabase) {}

  subscribeToChanges(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChanges(): void {
    for (const listener of this.changeListeners) listener();
  }

  async findAll(status?: EventStatus): Promise<Event[]> {
    if (status) {
      return this.db.getAllAsync<Event>(
        'SELECT * FROM events WHERE status = ? ORDER BY event_date DESC',
        [status]
      );
    }
    return this.db.getAllAsync<Event>(
      'SELECT * FROM events ORDER BY event_date DESC'
    );
  }

  async findById(id: string): Promise<Event | null> {
    return this.db.getFirstAsync<Event>(
      'SELECT * FROM events WHERE id = ?',
      [id]
    );
  }

  async findNextPlanned(): Promise<Event | null> {
    const events = await this.findAll('planned');
    return selectCurrentPlannedEvent(events, new Date());
  }

  async reconcileExpiredPlanned(today: string): Promise<number> {
    const result = await this.db.runAsync(
      `UPDATE events SET status = 'completed', updated_at = ?
       WHERE status = 'planned' AND event_date < ?`,
      [new Date().toISOString(), today],
    );
    if (result.changes > 0) this.notifyChanges();
    return result.changes;
  }

  async findUpcoming(limit?: number): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT * FROM events
       WHERE status = 'planned'
       ORDER BY event_date ASC, event_time ASC
       ${limit != null ? `LIMIT ${limit}` : ''}`
    );
  }

  async findByYear(year: number): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT * FROM events WHERE event_date LIKE ? || '-%' ORDER BY event_date ASC`,
      [String(year)]
    );
  }

  async findByTripId(tripId: string): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      'SELECT * FROM events WHERE trip_id = ? ORDER BY event_date ASC',
      [tripId]
    );
  }

  async findRecent(limit?: number | null): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT * FROM events
       WHERE status = 'completed'
       ORDER BY event_date DESC
       ${limit == null ? '' : 'LIMIT ?'}`,
      limit == null ? [] : [limit]
    );
  }

  async findVenueSuggestions(query: string, limit = 8): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const rows = await this.db.getAllAsync<{ venue: string }>(
      `SELECT venue
       FROM events
       WHERE venue IS NOT NULL
         AND TRIM(venue) != ''
         AND venue LIKE '%' || ? || '%'
       GROUP BY venue
       ORDER BY MAX(event_date) DESC, COUNT(*) DESC, venue ASC
       LIMIT ?`,
      [trimmed, limit]
    );

    return rows.map((row) => row.venue);
  }

  async groupByArtist(year?: number): Promise<{ name: string; count: number }[]> {
    if (year != null) {
      return this.db.getAllAsync<{ name: string; count: number }>(
        `SELECT a.name, COUNT(ea.event_id) AS count
         FROM artists a
         JOIN event_artists ea ON ea.artist_id = a.id
         JOIN events e ON e.id = ea.event_id
         WHERE e.status = 'completed' AND e.event_date LIKE ? || '-%'
         GROUP BY a.id, a.name
         ORDER BY count DESC`,
        [String(year)]
      );
    }
    return this.db.getAllAsync<{ name: string; count: number }>(
      `SELECT a.name, COUNT(ea.event_id) AS count
       FROM artists a
       JOIN event_artists ea ON ea.artist_id = a.id
       JOIN events e ON e.id = ea.event_id
       WHERE e.status = 'completed'
       GROUP BY a.id, a.name
       ORDER BY count DESC`
    );
  }

  async groupRootArtistsByCompletedEvents(
    year?: number,
    month?: number,
    limit?: number
  ): Promise<EventArtistRankingItem[]> {
    const period = eventPeriodClause(year, month, 'e.event_date');
    const rows = await this.db.getAllAsync<RootArtistEventCountRow>(
      `SELECT
         a.id AS artist_id,
         a.name AS artist_name,
         a.avatar_uri AS avatar_uri,
         COUNT(DISTINCT e.id) AS count
       FROM artists a
       JOIN event_artists ea ON ea.artist_id = a.id
       JOIN events e ON e.id = ea.event_id
       WHERE a.parent_id IS NULL
         AND e.status = 'completed'
         ${period.sql}
       GROUP BY a.id, a.name, a.avatar_uri
       ORDER BY count DESC, MAX(e.event_date) DESC, a.name ASC
       ${limit == null ? '' : 'LIMIT ?'}`,
      limit == null ? period.params : [...period.params, limit]
    );

    return rows.map((row) => ({
      artistId: row.artist_id,
      name: row.artist_name,
      avatarUri: row.avatar_uri,
      count: row.count,
    }));
  }

  async getYearStatusCounts(year?: number, month?: number): Promise<{ completed: number; planned: number; wishlist: number }> {
    const period = eventPeriodClause(year, month);
    const row = await this.db.getFirstAsync<YearStatusCountsRow>(
      `SELECT
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) AS planned,
         SUM(CASE WHEN status = 'wishlist' THEN 1 ELSE 0 END) AS wishlist
       FROM events
       WHERE 1 = 1${period.sql}`,
      period.params
    );

    return {
      completed: row?.completed ?? 0,
      planned: row?.planned ?? 0,
      wishlist: row?.wishlist ?? 0,
    };
  }

  async getMonthlyCountsByYear(year: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<MonthlyCountRow>(
      `SELECT substr(event_date, 6, 2) AS month, COUNT(*) AS count
       FROM events
       WHERE event_date LIKE ? || '-%'
         AND status IN ('completed', 'planned', 'wishlist')
       GROUP BY substr(event_date, 6, 2)`,
      [String(year)]
    );
    const monthMap = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return monthMap.get(month) ?? 0;
    });
  }

  async findTopCityByYear(year?: number, month?: number): Promise<{ name: string; count: number } | null> {
    const period = eventPeriodClause(year, month);
    const row = await this.db.getFirstAsync<LabelCountRow>(
      `SELECT city AS label, COUNT(*) AS count
       FROM events
       WHERE status IN ('completed', 'planned', 'wishlist')
         ${period.sql}
         AND city IS NOT NULL
         AND TRIM(city) != ''
       GROUP BY city
       ORDER BY count DESC, MAX(event_date) DESC, city ASC
       LIMIT 1`,
      period.params
    );

    return row ? { name: row.label, count: row.count } : null;
  }

  async findTopVenueByYear(year?: number, month?: number): Promise<{ name: string; count: number } | null> {
    const period = eventPeriodClause(year, month);
    const row = await this.db.getFirstAsync<LabelCountRow>(
      `SELECT venue AS label, COUNT(*) AS count
       FROM events
       WHERE status IN ('completed', 'planned', 'wishlist')
         ${period.sql}
         AND venue IS NOT NULL
         AND TRIM(venue) != ''
       GROUP BY venue
       ORDER BY count DESC, MAX(event_date) DESC, venue ASC
       LIMIT 1`,
      period.params
    );

    return row ? { name: row.label, count: row.count } : null;
  }

  async findPerfectEventsByYear(year?: number, month?: number, limit = 5): Promise<Event[]> {
    const period = eventPeriodClause(year, month);
    return this.db.getAllAsync<Event>(
      `SELECT *
       FROM events
       WHERE status = 'completed'
         ${period.sql}
         AND review_score = 5
       ORDER BY event_date DESC, created_at DESC
       LIMIT ?`,
      [...period.params, limit]
    );
  }

  async countCompletedByArtistYear(year: number | undefined, artistId: string, month?: number): Promise<number> {
    const period = eventPeriodClause(year, month, 'e.event_date');
    const row = await this.db.getFirstAsync<OshiArtistCountRow>(
      `${ARTIST_LINEAGE_CTE}
       SELECT COUNT(DISTINCT e.id) AS count
       FROM events e
       JOIN event_artists ea ON ea.event_id = e.id
       WHERE e.status = 'completed'
         ${period.sql}
         AND ea.artist_id IN (SELECT aid FROM artist_lineage)`,
      [artistId, ...period.params]
    );
    return row?.count ?? 0;
  }

  async findRecentCompletedByArtistYear(year: number | undefined, artistId: string, month?: number): Promise<Event | null> {
    const period = eventPeriodClause(year, month, 'e.event_date');
    return this.db.getFirstAsync<Event>(
      `${ARTIST_LINEAGE_CTE}
       SELECT DISTINCT e.*
       FROM events e
       JOIN event_artists ea ON ea.event_id = e.id
       WHERE e.status = 'completed'
         ${period.sql}
         AND ea.artist_id IN (SELECT aid FROM artist_lineage)
       ORDER BY e.event_date DESC, e.created_at DESC
       LIMIT 1`,
      [artistId, ...period.params]
    );
  }

  async findNextPlannedByArtistId(artistId: string): Promise<Event | null> {
    return this.db.getFirstAsync<Event>(
      `${ARTIST_LINEAGE_CTE}
       SELECT DISTINCT e.*
       FROM events e
       JOIN event_artists ea ON ea.event_id = e.id
       WHERE e.status = 'planned'
         AND ea.artist_id IN (SELECT aid FROM artist_lineage)
       ORDER BY e.event_date ASC, e.event_time ASC, e.created_at ASC
       LIMIT 1`,
      [artistId]
    );
  }

  async getMonthlyCompletedCountsByArtistYear(year: number, artistId: string): Promise<number[]> {
    const rows = await this.db.getAllAsync<MonthlyCountRow>(
      `${ARTIST_LINEAGE_CTE}
       SELECT substr(e.event_date, 6, 2) AS month, COUNT(DISTINCT e.id) AS count
       FROM events e
       JOIN event_artists ea ON ea.event_id = e.id
       WHERE e.status = 'completed'
         AND e.event_date LIKE ? || '-%'
         AND ea.artist_id IN (SELECT aid FROM artist_lineage)
       GROUP BY substr(e.event_date, 6, 2)`,
      [artistId, String(year)]
    );
    const monthMap = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return monthMap.get(month) ?? 0;
    });
  }

  async sumCompletedTicketPriceByYear(year?: number, month?: number): Promise<number> {
    const period = eventPeriodClause(year, month);
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(ticket_price), 0) AS total
       FROM events
       WHERE status = 'completed'${period.sql}`,
      period.params
    );
    return row?.total ?? 0;
  }

  async findTopSpendCompletedByYear(
    year?: number,
    month?: number,
    limit = 5
  ): Promise<Array<{ event: Event; ticketTotal: number; chekiTotal: number; totalSpend: number }>> {
    const period = eventPeriodClause(year, month, 'e.event_date');
    const rows = await this.db.getAllAsync<EventSpendRow>(
      `SELECT
         e.*,
         COALESCE(e.ticket_price, 0) AS ticket_total,
         COALESCE(c.cheki_total, 0) AS cheki_total,
         COALESCE(e.ticket_price, 0) + COALESCE(c.cheki_total, 0) AS total_spend
       FROM events e
       LEFT JOIN (
         SELECT r.event_id, COALESCE(SUM(i.unit_price), 0) AS cheki_total
         FROM cheki_records r
         JOIN cheki_items i ON i.record_id = r.id
         WHERE r.event_id IS NOT NULL
         GROUP BY r.event_id
       ) c ON c.event_id = e.id
       WHERE e.status = 'completed'
         ${period.sql}
       GROUP BY e.id
       HAVING total_spend > 0
       ORDER BY total_spend DESC, e.event_date DESC, e.created_at DESC
       LIMIT ?`,
      [...period.params, limit]
    );

    return rows.map((row) => ({
      event: {
        id: row.id,
        title: row.title,
        event_type: row.event_type,
        event_date: row.event_date,
        event_time: row.event_time,
        city: row.city,
        venue: row.venue,
        ticket_price: row.ticket_price,
        status: row.status,
        review_score: row.review_score,
        notes: row.notes,
        details: row.details,
        url: row.url,
        setlist_text: row.setlist_text,
        trip_id: row.trip_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      ticketTotal: row.ticket_total,
      chekiTotal: row.cheki_total,
      totalSpend: row.total_spend,
    }));
  }

  async getAverageCompletedSpendByYear(year?: number, month?: number): Promise<number> {
    const period = eventPeriodClause(year, month, 'e.event_date');
    const row = await this.db.getFirstAsync<{ average: number }>(
      `SELECT COALESCE(AVG(ticket_total + cheki_total), 0) AS average
       FROM (
         SELECT
           e.id,
           COALESCE(e.ticket_price, 0) AS ticket_total,
           COALESCE(c.cheki_total, 0) AS cheki_total
         FROM events e
         LEFT JOIN (
           SELECT r.event_id, COALESCE(SUM(i.unit_price), 0) AS cheki_total
           FROM cheki_records r
           JOIN cheki_items i ON i.record_id = r.id
           WHERE r.event_id IS NOT NULL
           GROUP BY r.event_id
         ) c ON c.event_id = e.id
         WHERE e.status = 'completed'
           ${period.sql}
         GROUP BY e.id
       ) totals`,
      period.params
    );
    return row?.average ?? 0;
  }

  async findFiltered(filter: EventFilter): Promise<Event[]> {
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    const withClauses: string[] = [];

    if (filter.keyword?.trim()) {
      const tokens = filter.keyword.trim().split(/\s+/);
      for (const token of tokens) {
        // 仅检索用户可见字段：标题 / 日期 / 时间 / 城市 / 场地 / 备注 / 详情 / 链接 / setlist，
        // 以及出演艺人名称；不含内部 id、状态枚举、时间戳等
        conditions.push(`((
          COALESCE(e.title, '') || ' ' ||
          COALESCE(e.event_date, '') || ' ' ||
          COALESCE(e.event_time, '') || ' ' ||
          COALESCE(e.city, '') || ' ' ||
          COALESCE(e.venue, '') || ' ' ||
          COALESCE(e.notes, '') || ' ' ||
          COALESCE(e.details, '') || ' ' ||
          COALESCE(e.url, '') || ' ' ||
          COALESCE(e.setlist_text, '')
        ) LIKE '%' || ? || '%'
        OR EXISTS (
          SELECT 1
          FROM event_artists keyword_ea
          JOIN artists keyword_artist ON keyword_artist.id = keyword_ea.artist_id
          WHERE keyword_ea.event_id = e.id
            AND (
              keyword_artist.name LIKE '%' || ? || '%'
              OR keyword_artist.short_name LIKE '%' || ? || '%'
            )
        ))`);
        params.push(token, token, token);
      }
    }
    const artistIds = filter.artistIds?.length ? [...new Set(filter.artistIds)] : filter.artistId ? [filter.artistId] : [];
    for (const artistId of artistIds) {
      // 匹配艺人本人 + 沿 parent_id 递归向上的所属团体（与单推/收藏口径一致）
      conditions.push(`e.id IN (
        ${ARTIST_LINEAGE_CTE}
        SELECT ea.event_id FROM event_artists ea
        WHERE ea.artist_id IN (SELECT aid FROM artist_lineage)
      )`);
      params.push(artistId);
    }
    if (filter.city != null) {
      // 支持用户自由输入，按包含匹配（精确值仍命中）
      conditions.push(`e.city LIKE '%' || ? || '%'`);
      params.push(filter.city);
    }
    if (filter.venue != null) {
      conditions.push(`e.venue LIKE '%' || ? || '%'`);
      params.push(filter.venue);
    }
    if (filter.status) {
      conditions.push('e.status = ?');
      params.push(filter.status);
    }
    if (filter.minScore != null) {
      conditions.push('e.review_score >= ?');
      params.push(filter.minScore);
    }
    if (filter.artistScope === 'favorite') {
      // 收藏艺人本人 + 沿 parent_id 递归向上的所属团体（匹配团体出演的活动）
      withClauses.push(`scope_lineage(aid) AS (
        SELECT id FROM artists WHERE is_favorite = 1
        UNION
        SELECT a.parent_id FROM artists a
        JOIN scope_lineage ON scope_lineage.aid = a.id
        WHERE a.parent_id IS NOT NULL
      )`);
      conditions.push(`e.id IN (
        SELECT ea.event_id FROM event_artists ea
        WHERE ea.artist_id IN (SELECT aid FROM scope_lineage)
      )`);
    } else if (filter.artistScope === 'oshi') {
      // 单推本人 + 递归向上的所属团体
      withClauses.push(`scope_lineage(aid) AS (
        SELECT oshi_artist_id FROM user_config WHERE id = 'default' AND oshi_artist_id IS NOT NULL
        UNION
        SELECT a.parent_id FROM artists a
        JOIN scope_lineage ON scope_lineage.aid = a.id
        WHERE a.parent_id IS NOT NULL
      )`);
      conditions.push(`e.id IN (
        SELECT ea.event_id FROM event_artists ea
        WHERE ea.artist_id IN (SELECT aid FROM scope_lineage)
      )`);
    }
    if (filter.year != null) {
      conditions.push(`e.event_date LIKE ? || '-%'`);
      params.push(eventDateLikeParam(filter.year, filter.month));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const withPrefix = withClauses.length > 0 ? `WITH RECURSIVE ${withClauses.join(', ')} ` : '';
    return this.db.getAllAsync<Event>(
      `${withPrefix}SELECT e.* FROM events e
       ${where}
       ORDER BY e.event_date DESC, e.event_time DESC`,
      params
    );
  }

  async findDistinctYears(): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ year: string }>(
      `SELECT DISTINCT substr(event_date, 1, 4) AS year
       FROM events
       WHERE event_date IS NOT NULL AND length(event_date) >= 4
       ORDER BY year DESC`
    );
    return rows
      .map((row) => Number(row.year))
      .filter((year) => Number.isInteger(year) && year > 0);
  }

  async findDistinctCities(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ city: string }>(
      `SELECT city
       FROM events
       WHERE city IS NOT NULL AND TRIM(city) != ''
       GROUP BY city
       ORDER BY COUNT(*) DESC, city ASC`
    );
    return rows.map((row) => row.city);
  }

  async findDistinctVenues(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ venue: string }>(
      `SELECT venue
       FROM events
       WHERE venue IS NOT NULL AND TRIM(venue) != ''
       GROUP BY venue
       ORDER BY COUNT(*) DESC, venue ASC`
    );
    return rows.map((row) => row.venue);
  }

  async findDistinctArtistIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ artist_id: string }>(
      `WITH RECURSIVE attended_artist_ids(artist_id) AS (
         SELECT artist_id
         FROM event_artists
         UNION
         SELECT a.id
         FROM artists a
         JOIN attended_artist_ids attended ON a.parent_id = attended.artist_id
       )
       SELECT artist_id
       FROM attended_artist_ids
       ORDER BY artist_id`
    );
    return rows.map((row) => row.artist_id);
  }

  async create(input: CreateEventInput): Promise<Event> {
    const now = toISODateTime();
    const event: Event = {
      id: generateId(),
      title: input.title,
      event_type: input.event_type,
      event_date: input.event_date,
      event_time: input.event_time ?? null,
      city: input.city ?? null,
      venue: input.venue ?? null,
      ticket_price: input.ticket_price ?? null,
      status: input.status,
      review_score: input.review_score ?? null,
      notes: input.notes ?? null,
      details: input.details ?? null,
      url: input.url ?? null,
      setlist_text: input.setlist_text ?? null,
      trip_id: input.trip_id ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue,
          ticket_price, status, review_score, notes, details, url, setlist_text,
          trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id, event.title, event.event_type, event.event_date,
        event.event_time, event.city, event.venue, event.ticket_price,
        event.status, event.review_score, event.notes, event.details, event.url,
        event.setlist_text, event.trip_id, event.created_at, event.updated_at,
      ]
    );
    this.notifyChanges();
    return event;
  }

  async update(id: string, input: Partial<CreateEventInput>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    const mappable: (keyof CreateEventInput)[] = [
      'title', 'event_type', 'event_date', 'event_time', 'city', 'venue',
      'ticket_price', 'status', 'review_score', 'notes', 'details', 'url', 'setlist_text',
      'trip_id',
    ];
    for (const key of mappable) {
      if (key in input) {
        fields.push(`${key} = ?`);
        values.push(input[key] ?? null);
      }
    }
    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(toISODateTime());
    values.push(id);

    await this.db.runAsync(
      `UPDATE events SET ${fields.join(', ')} WHERE id = ?`,
      values as string[]
    );
    this.notifyChanges();
  }

  async delete(id: string): Promise<void> {
    const photos = await this.db.getAllAsync<{ local_uri: string }>(
      'SELECT local_uri FROM photos WHERE event_id = ?',
      [id]
    );
    await this.db.runAsync('DELETE FROM events WHERE id = ?', [id]);
    for (const photo of photos) {
      await deleteLocalFileIfUnreferenced(this.db, photo.local_uri);
    }
    this.notifyChanges();
  }

  async findByArtistId(artistId: string): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT e.* FROM events e
       JOIN event_artists ea ON ea.event_id = e.id
       WHERE ea.artist_id = ?
       ORDER BY e.event_date DESC`,
      [artistId]
    );
  }

  async getArtists(eventId: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT a.* FROM artists a
       JOIN event_artists ea ON ea.artist_id = a.id
       WHERE ea.event_id = ?
       ORDER BY a.name ASC`,
      [eventId]
    );
  }

  async setArtists(eventId: string, artistIds: string[]): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM event_artists WHERE event_id = ?',
      [eventId]
    );
    const uniqueIds = [...new Set(artistIds)];
    for (const artistId of uniqueIds) {
      await this.db.runAsync(
        'INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)',
        [eventId, artistId]
      );
    }
  }
}

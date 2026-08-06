import { SQLiteDatabase } from 'expo-sqlite';
import {
  Artist,
  CreateEventInput,
  CreateEventWithScheduleInput,
  CreateEventWithSessionsInput,
  Event,
  EventSessionScheduleInput,
  EventStatus,
  CreateEventTimetableEntryInput,
  UpdateEventWithScheduleInput,
} from '../types/models';
import { generateId } from '../utils/uuid';
import { eventDateLikeParam, isValidISODate, toISODateTime } from '../utils/date';
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

  private validateScheduleSessions(sessions: EventSessionScheduleInput[]): void {
    if (sessions.length === 0) {
      throw new Error('An activity must include at least one dated session');
    }
    for (const session of sessions) {
      if (!isValidISODate(session.session_date)) {
        throw new Error('Session date must be a valid YYYY-MM-DD date');
      }
      if (session.end_date && !isValidISODate(session.end_date)) {
        throw new Error('Session end date must be a valid YYYY-MM-DD date');
      }
      if (session.end_date && session.end_date < session.session_date) {
        throw new Error('Session end date cannot be earlier than its start date');
      }
    }
    if (sessions.some((session) => session.timetable.some((entry) => !entry.title.trim()))) {
      throw new Error('Timetable entry title is required');
    }
  }

  private async insertTimetableRows(
    sessionId: string,
    timetable: CreateEventTimetableEntryInput[],
    now: string,
  ): Promise<void> {
    for (const [entryIndex, entry] of timetable.entries()) {
      await this.db.runAsync(
        `INSERT INTO event_timetable_entries
           (id, session_id, title, artist_id, start_time, end_time, notes,
            sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), sessionId, entry.title, entry.artist_id ?? null,
          entry.start_time ?? null, entry.end_time ?? null, entry.notes ?? null,
          entryIndex, now, now,
        ],
      );
    }
  }

  private async replaceArtistRows(eventId: string, artistIds: string[]): Promise<void> {
    await this.db.runAsync('DELETE FROM event_artists WHERE event_id = ?', [eventId]);
    for (const [sortOrder, artistId] of [...new Set(artistIds)].entries()) {
      await this.db.runAsync(
        `INSERT INTO event_artists (event_id, artist_id, sort_order)
         VALUES (?, ?, ?)`,
        [eventId, artistId, sortOrder],
      );
    }
  }

  private async findRepresentativeSessionId(eventId: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM event_sessions
       WHERE event_id = ?
       ORDER BY
         CASE WHEN session_date >= date('now', 'localtime') THEN 0 ELSE 1 END ASC,
         CASE WHEN session_date >= date('now', 'localtime') THEN session_date END ASC,
         CASE WHEN session_date < date('now', 'localtime') THEN session_date END DESC,
         CASE WHEN session_date >= date('now', 'localtime') THEN start_time END ASC,
         CASE WHEN session_date < date('now', 'localtime') THEN start_time END DESC,
         sort_order ASC,
         id ASC
       LIMIT 1`,
      [eventId],
    );
    return row?.id ?? null;
  }

  async findAll(status?: EventStatus): Promise<Event[]> {
    if (status) {
      return this.db.getAllAsync<Event>(
        'SELECT * FROM event_summaries WHERE status = ? ORDER BY event_date DESC',
        [status]
      );
    }
    return this.db.getAllAsync<Event>(
      'SELECT * FROM event_summaries ORDER BY event_date DESC'
    );
  }

  async findById(id: string): Promise<Event | null> {
    return this.db.getFirstAsync<Event>(
      'SELECT * FROM event_summaries WHERE id = ?',
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
       WHERE status = 'planned'
         AND NOT EXISTS (
           SELECT 1 FROM event_sessions s
           WHERE s.event_id = events.id
             AND COALESCE(s.end_date, s.session_date) >= ?
         )`,
      [new Date().toISOString(), today],
    );
    if (result.changes > 0) this.notifyChanges();
    return result.changes;
  }

  async findUpcoming(limit?: number): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT * FROM event_summaries
       WHERE status = 'planned'
       ORDER BY event_date ASC, event_time ASC
       ${limit != null ? `LIMIT ${limit}` : ''}`
    );
  }

  async findByYear(year: number): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT * FROM event_first_summaries WHERE event_date LIKE ? || '-%' ORDER BY event_date ASC`,
      [String(year)]
    );
  }

  async findByTripId(tripId: string): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      'SELECT * FROM event_summaries WHERE trip_id = ? ORDER BY event_date ASC',
      [tripId]
    );
  }

  async findRecent(limit?: number | null): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT * FROM event_summaries
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
       FROM event_sessions
       WHERE venue IS NOT NULL
         AND TRIM(venue) != ''
         AND venue LIKE '%' || ? || '%'
       GROUP BY venue
       ORDER BY MAX(session_date) DESC, COUNT(*) DESC, venue ASC
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
         JOIN event_first_summaries e ON e.id = ea.event_id
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
       JOIN event_first_summaries e ON e.id = ea.event_id
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
       JOIN event_first_summaries e ON e.id = ea.event_id
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
       FROM event_first_summaries
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
       FROM event_first_summaries
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
      `SELECT s.city AS label, COUNT(DISTINCT s.event_id) AS count
       FROM event_sessions s
       JOIN event_first_summaries e ON e.id = s.event_id
       WHERE e.status IN ('completed', 'planned', 'wishlist')
         ${period.sql}
         AND s.city IS NOT NULL
         AND TRIM(s.city) != ''
       GROUP BY s.city
       ORDER BY count DESC, MAX(s.session_date) DESC, s.city ASC
       LIMIT 1`,
      period.params
    );

    return row ? { name: row.label, count: row.count } : null;
  }

  async findTopVenueByYear(year?: number, month?: number): Promise<{ name: string; count: number } | null> {
    const period = eventPeriodClause(year, month);
    const row = await this.db.getFirstAsync<LabelCountRow>(
      `SELECT s.venue AS label, COUNT(DISTINCT s.event_id) AS count
       FROM event_sessions s
       JOIN event_first_summaries e ON e.id = s.event_id
       WHERE e.status IN ('completed', 'planned', 'wishlist')
         ${period.sql}
         AND s.venue IS NOT NULL
         AND TRIM(s.venue) != ''
       GROUP BY s.venue
       ORDER BY count DESC, MAX(s.session_date) DESC, s.venue ASC
       LIMIT 1`,
      period.params
    );

    return row ? { name: row.label, count: row.count } : null;
  }

  async findPerfectEventsByYear(year?: number, month?: number, limit = 5): Promise<Event[]> {
    const period = eventPeriodClause(year, month);
    return this.db.getAllAsync<Event>(
      `SELECT *
       FROM event_first_summaries
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
       FROM event_first_summaries e
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
       FROM event_first_summaries e
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
       FROM event_summaries e
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
       FROM event_first_summaries e
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
      `SELECT COALESCE(SUM(actual_expense), 0) AS total
       FROM event_first_summaries
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
         COALESCE(e.actual_expense, 0) AS ticket_total,
         COALESCE(c.cheki_total, 0) AS cheki_total,
         COALESCE(e.actual_expense, 0) + COALESCE(c.cheki_total, 0) AS total_spend
       FROM event_first_summaries e
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
        actual_expense: row.actual_expense,
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
           COALESCE(e.actual_expense, 0) AS ticket_total,
           COALESCE(c.cheki_total, 0) AS cheki_total
         FROM event_first_summaries e
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
          COALESCE(e.notes, '') || ' ' ||
          COALESCE(e.details, '') || ' ' ||
          COALESCE(e.url, '') || ' ' ||
          COALESCE(e.setlist_text, '')
        ) LIKE '%' || ? || '%'
        OR EXISTS (
          SELECT 1
          FROM event_sessions keyword_session
          WHERE keyword_session.event_id = e.id
            AND (
              COALESCE(keyword_session.session_date, '') || ' ' ||
              COALESCE(keyword_session.start_time, '') || ' ' ||
              COALESCE(keyword_session.city, '') || ' ' ||
              COALESCE(keyword_session.venue, '')
            ) LIKE '%' || ? || '%'
        )
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
        params.push(token, token, token, token);
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
      conditions.push(`EXISTS (
        SELECT 1 FROM event_sessions city_session
        WHERE city_session.event_id = e.id
          AND city_session.city LIKE '%' || ? || '%'
      )`);
      params.push(filter.city);
    }
    if (filter.venue != null) {
      conditions.push(`EXISTS (
        SELECT 1 FROM event_sessions venue_session
        WHERE venue_session.event_id = e.id
          AND venue_session.venue LIKE '%' || ? || '%'
      )`);
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
      conditions.push(`EXISTS (
        SELECT 1 FROM event_first_summaries period_event
        WHERE period_event.id = e.id
          AND period_event.event_date LIKE ? || '-%'
      )`);
      params.push(eventDateLikeParam(filter.year, filter.month));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const withPrefix = withClauses.length > 0 ? `WITH RECURSIVE ${withClauses.join(', ')} ` : '';
    return this.db.getAllAsync<Event>(
      `${withPrefix}SELECT e.* FROM event_summaries e
       ${where}
       ORDER BY e.event_date DESC, e.event_time DESC`,
      params
    );
  }

  async findDistinctYears(): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ year: string }>(
      `SELECT DISTINCT substr(event_date, 1, 4) AS year
       FROM event_first_summaries
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
       FROM event_sessions
       WHERE city IS NOT NULL AND TRIM(city) != ''
       GROUP BY city
       ORDER BY COUNT(*) DESC, city ASC`
    );
    return rows.map((row) => row.city);
  }

  async findDistinctVenues(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ venue: string }>(
      `SELECT venue
       FROM event_sessions
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
    return this.createWithSessions({
      title: input.title,
      event_type: input.event_type,
      status: input.status,
      review_score: input.review_score,
      notes: input.notes,
      details: input.details,
      url: input.url,
      setlist_text: input.setlist_text,
      actual_expense: input.actual_expense ?? input.ticket_price ?? null,
      trip_id: input.trip_id,
      sessions: [{
        session_date: input.event_date,
        start_time: input.event_time,
        city: input.city,
        venue: input.venue,
      }],
    });
  }

  async createWithSessions(input: CreateEventWithSessionsInput): Promise<Event> {
    return this.createWithSchedule({
      ...input,
      artist_ids: [],
      sessions: input.sessions.map((session) => ({ ...session, timetable: [] })),
    });
  }

  async createWithSchedule(input: CreateEventWithScheduleInput): Promise<Event> {
    this.validateScheduleSessions(input.sessions);
    const now = toISODateTime();
    const eventId = generateId();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO events
           (id, title, event_type, status, review_score, notes, details, url,
            setlist_text, actual_expense, trip_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId, input.title, input.event_type, input.status,
          input.review_score ?? null, input.notes ?? null, input.details ?? null,
          input.url ?? null, input.setlist_text ?? null, input.actual_expense ?? null,
          input.trip_id ?? null, now, now,
        ],
      );
      for (const [index, session] of input.sessions.entries()) {
        const sessionId = generateId();
        await this.db.runAsync(
          `INSERT INTO event_sessions
             (id, event_id, title, session_date, end_date, open_time, start_time,
              end_time, city, venue, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sessionId, eventId, session.title ?? null, session.session_date,
            session.end_date ?? null, session.open_time ?? null,
            session.start_time ?? null, session.end_time ?? null,
            session.city ?? null, session.venue ?? null,
            session.sort_order ?? index, now, now,
          ],
        );
        await this.insertTimetableRows(sessionId, session.timetable, now);
      }
      await this.replaceArtistRows(eventId, input.artist_ids);
    });
    this.notifyChanges();
    const event = await this.findById(eventId);
    if (!event) throw new Error('Created activity could not be loaded');
    return event;
  }

  async updateWithSchedule(id: string, input: UpdateEventWithScheduleInput): Promise<void> {
    this.validateScheduleSessions(input.sessions);
    const requestedIds = input.sessions.flatMap((session) => session.id ? [session.id] : []);
    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new Error('Session ids must be unique');
    }
    const now = toISODateTime();

    await this.db.withTransactionAsync(async () => {
      const existing = await this.db.getAllAsync<{ id: string; sort_order: number }>(
        'SELECT id, sort_order FROM event_sessions WHERE event_id = ?',
        [id],
      );
      const existingIds = new Set(existing.map((session) => session.id));
      if (requestedIds.some((sessionId) => !existingIds.has(sessionId))) {
        throw new Error('Session does not belong to this activity');
      }

      await this.db.runAsync(
        `UPDATE events SET
           title = ?, status = ?, review_score = ?, notes = ?, details = ?,
           url = ?, setlist_text = ?, actual_expense = ?, trip_id = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.title, input.status, input.review_score ?? null, input.notes ?? null,
          input.details ?? null, input.url ?? null, input.setlist_text ?? null,
          input.actual_expense ?? null, input.trip_id ?? null, now, id,
        ],
      );

      const retainedIds = new Set(requestedIds);
      const temporaryBase = existing.reduce(
        (max, session) => Math.max(max, session.sort_order),
        -1,
      ) + existing.length + input.sessions.length + 1;
      for (const [index, session] of existing.entries()) {
        await this.db.runAsync(
          'UPDATE event_sessions SET sort_order = ?, updated_at = ? WHERE id = ?',
          [temporaryBase + index, now, session.id],
        );
      }
      for (const session of existing) {
        if (!retainedIds.has(session.id)) {
          await this.db.runAsync('DELETE FROM event_sessions WHERE id = ?', [session.id]);
        }
      }

      for (const [index, session] of input.sessions.entries()) {
        const sessionId = session.id ?? generateId();
        if (session.id) {
          await this.db.runAsync(
            `UPDATE event_sessions SET
               title = ?, session_date = ?, end_date = ?, open_time = ?,
               start_time = ?, end_time = ?, city = ?, venue = ?, sort_order = ?,
               updated_at = ?
             WHERE id = ? AND event_id = ?`,
            [
              session.title ?? null, session.session_date, session.end_date ?? null,
              session.open_time ?? null, session.start_time ?? null,
              session.end_time ?? null, session.city ?? null, session.venue ?? null,
              index, now, sessionId, id,
            ],
          );
          await this.db.runAsync(
            'DELETE FROM event_timetable_entries WHERE session_id = ?',
            [sessionId],
          );
        } else {
          await this.db.runAsync(
            `INSERT INTO event_sessions
               (id, event_id, title, session_date, end_date, open_time, start_time,
                end_time, city, venue, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sessionId, id, session.title ?? null, session.session_date,
              session.end_date ?? null, session.open_time ?? null,
              session.start_time ?? null, session.end_time ?? null,
              session.city ?? null, session.venue ?? null, index, now, now,
            ],
          );
        }
        await this.insertTimetableRows(sessionId, session.timetable, now);
      }

      await this.replaceArtistRows(id, input.artist_ids);
    });
    this.notifyChanges();
  }

  async update(id: string, input: Partial<CreateEventInput>): Promise<void> {
    const eventFields: string[] = [];
    const eventValues: unknown[] = [];
    const eventKeys: (keyof CreateEventInput)[] = [
      'title', 'event_type', 'status', 'review_score', 'notes', 'details', 'url',
      'setlist_text', 'trip_id',
    ];
    for (const key of eventKeys) {
      if (key in input) {
        eventFields.push(`${key} = ?`);
        eventValues.push(input[key] ?? null);
      }
    }
    if ('actual_expense' in input || 'ticket_price' in input) {
      eventFields.push('actual_expense = ?');
      eventValues.push(
        'actual_expense' in input ? input.actual_expense ?? null : input.ticket_price ?? null,
      );
    }

    const sessionFieldMap: Array<[keyof CreateEventInput, string]> = [
      ['event_date', 'session_date'],
      ['event_time', 'start_time'],
      ['city', 'city'],
      ['venue', 'venue'],
    ];
    const sessionFields: string[] = [];
    const sessionValues: unknown[] = [];
    for (const [inputKey, column] of sessionFieldMap) {
      if (inputKey in input) {
        sessionFields.push(`${column} = ?`);
        sessionValues.push(input[inputKey] ?? null);
      }
    }
    if (eventFields.length === 0 && sessionFields.length === 0) return;

    const now = toISODateTime();
    await this.db.withTransactionAsync(async () => {
      if (eventFields.length > 0) {
        eventFields.push('updated_at = ?');
        eventValues.push(now, id);
        await this.db.runAsync(
          `UPDATE events SET ${eventFields.join(', ')} WHERE id = ?`,
          eventValues as Array<string | number | null>,
        );
      } else {
        await this.db.runAsync('UPDATE events SET updated_at = ? WHERE id = ?', [now, id]);
      }

      if (sessionFields.length > 0) {
        const sessionId = await this.findRepresentativeSessionId(id);
        if (!sessionId) throw new Error('Activity has no dated session');
        sessionFields.push('updated_at = ?');
        sessionValues.push(now, sessionId);
        await this.db.runAsync(
          `UPDATE event_sessions SET ${sessionFields.join(', ')} WHERE id = ?`,
          sessionValues as Array<string | number | null>,
        );
      }
    });
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
      `SELECT e.* FROM event_summaries e
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
       ORDER BY ea.sort_order ASC, a.name ASC`,
      [eventId]
    );
  }

  async setArtists(eventId: string, artistIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(artistIds)];
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        'DELETE FROM event_artists WHERE event_id = ?',
        [eventId],
      );
      for (const [sortOrder, artistId] of uniqueIds.entries()) {
        await this.db.runAsync(
          `INSERT INTO event_artists (event_id, artist_id, sort_order)
           VALUES (?, ?, ?)`,
          [eventId, artistId, sortOrder],
        );
      }
    });
  }
}

import { SQLiteDatabase } from 'expo-sqlite';
import {
  Artist,
  CreateEventInput,
  CreateEventWithScheduleInput,
  CreateEventWithSessionsInput,
  Event,
  EventSessionScheduleInput,
  EventStatus,
  EventType,
  CreateEventTimetableEntryInput,
  UpdateEventWithScheduleInput,
} from '../types/models';
import { generateId } from '../utils/uuid';
import { eventDateLikeParam, isValidISODate, toISODateTime } from '../utils/date';
import { selectCurrentPlannedEvent } from '../utils/currentEvent';
import { buildSearchIndex, matchesSearchIndex, tokenizeSearchQuery } from '../utils/searchText';

export interface EventFilter {
  keyword?: string;
  /** @deprecated 城市现在作为关键词搜索；仅为旧调用兼容保留。 */
  city?: string;
  /** @deprecated 场地现在作为关键词搜索；仅为旧调用兼容保留。 */
  venue?: string;
  status?: EventStatus;
  statuses?: EventStatus[];
  artistId?: string;
  artistIds?: string[];
  year?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
  /** 仅保留评分 >= 该值的活动（1-5，仅 completed 会有评分） */
  minScore?: number;
  /** 出演者范围：favorite=任一出演者为收藏；oshi=出演者含单推 */
  artistScope?: 'favorite' | 'oshi';
  hasNotes?: boolean;
  hasSetlist?: boolean;
  hasTimetable?: boolean;
  hasPhotos?: boolean;
  hasCheki?: boolean;
}
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';

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

interface DailyCountRow {
  date: string;
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

interface EventRatingSummaryRow {
  average_score: number | null;
  rated_count: number;
  score_1_count: number;
  score_2_count: number;
  score_3_count: number;
  score_4_count: number;
  score_5_count: number;
}

interface GroupRatingRow {
  artist_id: string;
  artist_name: string;
  avatar_uri: string | null;
  average_score: number;
  rated_count: number;
  last_event_date: string;
}

export interface EventArtistRankingItem {
  artistId: string;
  name: string;
  avatarUri: string | null;
  count: number;
}

export interface EventDailyCount {
  date: string;
  count: number;
}

export interface EventRatingSummary {
  averageScore: number | null;
  ratedCount: number;
  distribution: number[];
}

export interface EventGroupRatingItem {
  artistId: string;
  name: string;
  avatarUri: string | null;
  averageScore: number;
  ratedCount: number;
  rankingScore: number;
}

function eventPeriodClause(
  year?: number,
  month?: number,
  column = 'event_date',
  startDate?: string,
  endDate?: string,
) {
  if (startDate && endDate) {
    return { sql: ` AND ${column} >= ? AND ${column} <= ?`, params: [startDate, endDate] };
  }
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
         CASE WHEN session_date >= date('now', 'localtime') THEN COALESCE(open_time, start_time) END ASC,
         CASE WHEN session_date < date('now', 'localtime') THEN COALESCE(open_time, start_time) END DESC,
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

  /**
   * Projects activities onto calendar dates. Sessions from the same activity on
   * the same date collapse into one activity card; sessions on different dates
   * produce one card per date.
   */
  async findCalendarEvents(): Promise<Event[]> {
    return this.db.getAllAsync<Event>(
      `SELECT
         e.*,
         s.session_date AS event_date,
         COALESCE(s.open_time, s.start_time) AS event_time,
         s.open_time AS open_time,
         s.start_time AS start_time,
         s.end_time AS end_time,
         s.city AS city,
         s.venue AS venue,
         e.actual_expense AS ticket_price
       FROM events e
       JOIN event_sessions s ON s.event_id = e.id
       WHERE s.id = (
         SELECT candidate.id
         FROM event_sessions candidate
         WHERE candidate.event_id = e.id
           AND candidate.session_date = s.session_date
         ORDER BY COALESCE(candidate.open_time, candidate.start_time) ASC,
                  candidate.sort_order ASC,
                  candidate.id ASC
         LIMIT 1
       )
       ORDER BY s.session_date DESC, COALESCE(s.open_time, s.start_time) DESC, e.created_at DESC`,
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
    limit?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<EventArtistRankingItem[]> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
    const rows = await this.db.getAllAsync<RootArtistEventCountRow>(
      `SELECT
         a.id AS artist_id,
         a.name AS artist_name,
         a.avatar_uri AS avatar_uri,
         COUNT(DISTINCT e.id) AS count
       FROM artists a
       JOIN event_artists ea ON ea.artist_id = a.id
       JOIN event_first_summaries e ON e.id = ea.event_id
       WHERE a.artist_type = 'group'
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

  async getYearStatusCounts(year?: number, month?: number, startDate?: string, endDate?: string): Promise<{ completed: number; planned: number; wishlist: number }> {
    const period = eventPeriodClause(year, month, 'event_date', startDate, endDate);
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

  async getDailyCountsByRange(startDate: string, endDate: string): Promise<Array<{ date: string; count: number }>> {
    return this.db.getAllAsync<{ date: string; count: number }>(
      `SELECT event_date AS date, COUNT(*) AS count
       FROM event_first_summaries
       WHERE event_date >= ? AND event_date <= ?
         AND status IN ('completed', 'planned', 'wishlist')
       GROUP BY event_date
       ORDER BY event_date`,
      [startDate, endDate],
    );
  }

  async getCompletedDailyCountsByYear(year: number): Promise<EventDailyCount[]> {
    return this.db.getAllAsync<DailyCountRow>(
      `SELECT event_date AS date, COUNT(*) AS count
       FROM event_first_summaries
       WHERE event_date LIKE ? || '-%'
         AND status = 'completed'
       GROUP BY event_date
       ORDER BY event_date ASC`,
      [String(year)]
    );
  }

  async findTopCityByYear(year?: number, month?: number, startDate?: string, endDate?: string): Promise<{ name: string; count: number } | null> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
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

  async findTopVenueByYear(year?: number, month?: number, startDate?: string, endDate?: string): Promise<{ name: string; count: number } | null> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
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

  async findPerfectEventsByYear(year?: number, month?: number, limit: number | null = 5, startDate?: string, endDate?: string): Promise<Event[]> {
    const period = eventPeriodClause(year, month, 'event_date', startDate, endDate);
    const limitClause = limit == null ? '' : 'LIMIT ?';
    return this.db.getAllAsync<Event>(
      `SELECT *
       FROM event_first_summaries
       WHERE status = 'completed'
         ${period.sql}
         AND review_score = 5
       ORDER BY event_date DESC, created_at DESC
       ${limitClause}`,
      limit == null ? period.params : [...period.params, limit]
    );
  }

  async getRatingSummaryByYear(
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<EventRatingSummary> {
    const period = eventPeriodClause(year, month, 'event_date', startDate, endDate);
    const row = await this.db.getFirstAsync<EventRatingSummaryRow>(
      `SELECT
         AVG(review_score) AS average_score,
         COUNT(review_score) AS rated_count,
         SUM(CASE WHEN review_score = 1 THEN 1 ELSE 0 END) AS score_1_count,
         SUM(CASE WHEN review_score = 2 THEN 1 ELSE 0 END) AS score_2_count,
         SUM(CASE WHEN review_score = 3 THEN 1 ELSE 0 END) AS score_3_count,
         SUM(CASE WHEN review_score = 4 THEN 1 ELSE 0 END) AS score_4_count,
         SUM(CASE WHEN review_score = 5 THEN 1 ELSE 0 END) AS score_5_count
       FROM event_first_summaries
       WHERE status = 'completed'
         AND review_score IS NOT NULL
         ${period.sql}`,
      period.params,
    );

    return {
      averageScore: row?.average_score ?? null,
      ratedCount: row?.rated_count ?? 0,
      distribution: [
        row?.score_1_count ?? 0,
        row?.score_2_count ?? 0,
        row?.score_3_count ?? 0,
        row?.score_4_count ?? 0,
        row?.score_5_count ?? 0,
      ],
    };
  }

  async findTopRatedRootArtistsByYear(
    year?: number,
    month?: number,
    limit: number | null = 5,
    startDate?: string,
    endDate?: string,
  ): Promise<EventGroupRatingItem[]> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
    const rows = await this.db.getAllAsync<GroupRatingRow>(
      `WITH rated_events AS (
         SELECT e.id, e.review_score, e.event_date
         FROM event_first_summaries e
         WHERE e.status = 'completed'
           AND e.review_score IS NOT NULL
           ${period.sql}
       ),
       group_events AS (
         SELECT DISTINCT rated_events.id, rated_events.review_score, rated_events.event_date, ea.artist_id AS root_id
         FROM rated_events
         JOIN event_artists ea ON ea.event_id = rated_events.id
         JOIN artists group_artist ON group_artist.id = ea.artist_id
         WHERE group_artist.artist_type = 'group'
       )
       SELECT
         root.id AS artist_id,
         root.name AS artist_name,
         root.avatar_uri,
         AVG(group_events.review_score) AS average_score,
         COUNT(*) AS rated_count,
         MAX(group_events.event_date) AS last_event_date
       FROM group_events
       JOIN artists root ON root.id = group_events.root_id
       GROUP BY root.id, root.name, root.avatar_uri
       ORDER BY root.name ASC`,
      period.params,
    );

    const maxRatedCount = Math.max(...rows.map((row) => row.rated_count), 1);
    const ranked = rows.map((row) => ({
      artistId: row.artist_id,
      name: row.artist_name,
      avatarUri: row.avatar_uri,
      averageScore: row.average_score,
      ratedCount: row.rated_count,
      rankingScore: Math.round(
        (row.average_score / 5) * Math.sqrt(row.rated_count / maxRatedCount) * 100,
      ),
      lastEventDate: row.last_event_date,
    })).sort((left, right) => (
      right.rankingScore - left.rankingScore
      || right.averageScore - left.averageScore
      || right.ratedCount - left.ratedCount
      || right.lastEventDate.localeCompare(left.lastEventDate)
      || left.name.localeCompare(right.name)
    ));

    return (limit == null ? ranked : ranked.slice(0, limit)).map(({ lastEventDate: _lastEventDate, ...item }) => item);
  }

  async countCompletedByArtistYear(year: number | undefined, artistId: string, month?: number, startDate?: string, endDate?: string): Promise<number> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
    const row = await this.db.getFirstAsync<OshiArtistCountRow>(
      `SELECT COUNT(DISTINCT e.id) AS count
       FROM event_first_summaries e
       JOIN event_artist_attributions attribution ON attribution.event_id = e.id
       WHERE e.status = 'completed'
         ${period.sql}
         AND attribution.artist_id = ?`,
      [...period.params, artistId]
    );
    return row?.count ?? 0;
  }

  async findRecentCompletedByArtistYear(year: number | undefined, artistId: string, month?: number, startDate?: string, endDate?: string): Promise<Event | null> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
    return this.db.getFirstAsync<Event>(
      `SELECT DISTINCT e.*
       FROM event_first_summaries e
       JOIN event_artist_attributions attribution ON attribution.event_id = e.id
       WHERE e.status = 'completed'
         ${period.sql}
         AND attribution.artist_id = ?
       ORDER BY e.event_date DESC, e.created_at DESC
       LIMIT 1`,
      [...period.params, artistId]
    );
  }

  async findNextPlannedByArtistId(artistId: string): Promise<Event | null> {
    return this.db.getFirstAsync<Event>(
      `SELECT DISTINCT e.*
       FROM event_summaries e
       JOIN event_artist_attributions attribution ON attribution.event_id = e.id
       WHERE e.status = 'planned'
         AND attribution.artist_id = ?
       ORDER BY e.event_date ASC, e.event_time ASC, e.created_at ASC
       LIMIT 1`,
      [artistId]
    );
  }

  async getMonthlyCompletedCountsByArtistYear(year: number, artistId: string): Promise<number[]> {
    const rows = await this.db.getAllAsync<MonthlyCountRow>(
      `SELECT substr(e.event_date, 6, 2) AS month, COUNT(DISTINCT e.id) AS count
       FROM event_first_summaries e
       JOIN event_artist_attributions attribution ON attribution.event_id = e.id
       WHERE e.status = 'completed'
         AND e.event_date LIKE ? || '-%'
         AND attribution.artist_id = ?
       GROUP BY substr(e.event_date, 6, 2)`,
      [String(year), artistId]
    );
    const monthMap = new Map(rows.map((row) => [row.month, row.count]));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return monthMap.get(month) ?? 0;
    });
  }

  async getDailyCompletedCountsByArtistRange(
    startDate: string,
    endDate: string,
    artistId: string,
  ): Promise<Array<{ date: string; count: number }>> {
    return this.db.getAllAsync<{ date: string; count: number }>(
      `SELECT e.event_date AS date, COUNT(DISTINCT e.id) AS count
       FROM event_first_summaries e
       JOIN event_artist_attributions attribution ON attribution.event_id = e.id
       WHERE e.status = 'completed'
         AND e.event_date >= ? AND e.event_date <= ?
         AND attribution.artist_id = ?
       GROUP BY e.event_date
       ORDER BY e.event_date`,
      [startDate, endDate, artistId],
    );
  }

  async sumCompletedTicketPriceByYear(year?: number, month?: number, startDate?: string, endDate?: string): Promise<number> {
    const period = eventPeriodClause(year, month, 'event_date', startDate, endDate);
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
    limit = 5,
    startDate?: string,
    endDate?: string,
  ): Promise<Array<{ event: Event; ticketTotal: number; chekiTotal: number; totalSpend: number }>> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
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
        open_time: row.open_time,
        start_time: row.start_time,
        end_time: row.end_time,
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

  async getAverageCompletedSpendByYear(year?: number, month?: number, startDate?: string, endDate?: string): Promise<number> {
    const period = eventPeriodClause(year, month, 'e.event_date', startDate, endDate);
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
    const artistIds = filter.artistIds?.length ? [...new Set(filter.artistIds)] : filter.artistId ? [filter.artistId] : [];
    if (artistIds.length > 0) {
      conditions.push(`e.id IN (
        SELECT attribution.event_id FROM event_artist_attributions attribution
        WHERE attribution.artist_id IN (${artistIds.map(() => '?').join(', ')})
      )`);
      params.push(...artistIds);
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
    const statuses = filter.statuses?.length ? [...new Set(filter.statuses)] : filter.status ? [filter.status] : [];
    if (statuses.length > 0) {
      conditions.push(`e.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }
    if (filter.minScore != null) {
      conditions.push('e.review_score >= ?');
      params.push(filter.minScore);
    }
    if (filter.artistScope === 'favorite') {
      conditions.push(`e.id IN (
        SELECT attribution.event_id
        FROM event_artist_attributions attribution
        JOIN artists favorite_artist ON favorite_artist.id = attribution.artist_id
        WHERE favorite_artist.is_favorite = 1
      )`);
    } else if (filter.artistScope === 'oshi') {
      conditions.push(`e.id IN (
        SELECT attribution.event_id
        FROM event_artist_attributions attribution
        JOIN user_config config
          ON config.id = 'default' AND config.oshi_artist_id = attribution.artist_id
      )`);
    }
    let rangeStart = filter.startDate;
    let rangeEnd = filter.endDate;
    if (!rangeStart && !rangeEnd && filter.year != null) {
      const month = filter.month;
      rangeStart = month == null
        ? `${filter.year}-01-01`
        : `${filter.year}-${String(month).padStart(2, '0')}-01`;
      rangeEnd = month == null
        ? `${filter.year}-12-31`
        : `${filter.year}-${String(month).padStart(2, '0')}-${String(new Date(filter.year, month, 0).getDate()).padStart(2, '0')}`;
    }
    if (rangeStart && rangeEnd) {
      conditions.push(`EXISTS (
        SELECT 1 FROM event_sessions period_session
        WHERE period_session.event_id = e.id
          AND period_session.session_date <= ?
          AND COALESCE(period_session.end_date, period_session.session_date) >= ?
      )`);
      params.push(rangeEnd, rangeStart);
    }

    if (filter.hasNotes) conditions.push("TRIM(COALESCE(e.notes, '')) != ''");
    if (filter.hasSetlist) conditions.push("TRIM(COALESCE(e.setlist_text, '')) != ''");
    if (filter.hasTimetable) {
      conditions.push(`EXISTS (
        SELECT 1 FROM event_sessions timetable_session
        JOIN event_timetable_entries timetable_entry ON timetable_entry.session_id = timetable_session.id
        WHERE timetable_session.event_id = e.id
      )`);
    }
    if (filter.hasPhotos) {
      conditions.push('EXISTS (SELECT 1 FROM photos event_photo WHERE event_photo.event_id = e.id)');
    }
    if (filter.hasCheki) {
      conditions.push('EXISTS (SELECT 1 FROM cheki_records event_cheki WHERE event_cheki.event_id = e.id)');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const candidates = await this.db.getAllAsync<Event>(
      `SELECT e.* FROM event_summaries e
       ${where}
       ORDER BY e.event_date DESC, e.event_time DESC`,
      params
    );

    const keyword = [filter.keyword, filter.city, filter.venue]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(' ');
    if (!keyword || candidates.length === 0) return candidates;

    const searchParts = new Map<string, string[]>();
    for (const event of candidates) searchParts.set(event.id, []);
    const candidateIds = candidates.map((event) => event.id);
    const chunks: string[][] = [];
    // 每个聚合查询会重复绑定同一批活动 ID 六次；150 保持在常见的
    // SQLite 999 参数上限以内，同时避免为每条活动单独查询。
    for (let index = 0; index < candidateIds.length; index += 150) {
      chunks.push(candidateIds.slice(index, index + 150));
    }

    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(', ');
      const dateClause = rangeStart && rangeEnd
        ? `AND search_session.session_date <= ?
           AND COALESCE(search_session.end_date, search_session.session_date) >= ?`
        : '';
      const dateParams = rangeStart && rangeEnd ? [rangeEnd, rangeStart] : [];
      const rows = await this.db.getAllAsync<{ event_id: string; search_text: string | null }>(
        `SELECT root.id AS event_id,
                COALESCE(root.title, '') || ' ' || COALESCE(root.notes, '') || ' ' ||
                COALESCE(root.details, '') || ' ' || COALESCE(root.url, '') || ' ' ||
                COALESCE(root.setlist_text, '') AS search_text
         FROM events root
         WHERE root.id IN (${placeholders})
         UNION ALL
         SELECT search_session.event_id,
                COALESCE(search_session.title, '') || ' ' || search_session.session_date || ' ' ||
                COALESCE(search_session.end_date, '') || ' ' || COALESCE(search_session.open_time, '') || ' ' ||
                COALESCE(search_session.start_time, '') || ' ' || COALESCE(search_session.end_time, '') || ' ' ||
                COALESCE(search_session.city, '') || ' ' || COALESCE(search_session.venue, '')
         FROM event_sessions search_session
         WHERE search_session.event_id IN (${placeholders}) ${dateClause}
         UNION ALL
         SELECT search_session.event_id,
                search_entry.title || ' ' || COALESCE(search_entry.start_time, '') || ' ' ||
                COALESCE(search_entry.end_time, '') || ' ' || COALESCE(search_entry.notes, '')
         FROM event_timetable_entries search_entry
         JOIN event_sessions search_session ON search_session.id = search_entry.session_id
         WHERE search_session.event_id IN (${placeholders}) ${dateClause}
         UNION ALL
         SELECT attribution.event_id, artist.name || ' ' || COALESCE(artist.short_name, '')
         FROM event_artist_attributions attribution
         JOIN artists artist ON artist.id = attribution.artist_id
         WHERE attribution.event_id IN (${placeholders})
         UNION ALL
         SELECT search_session.event_id, artist.name || ' ' || COALESCE(artist.short_name, '')
         FROM event_timetable_entries search_entry
         JOIN event_sessions search_session ON search_session.id = search_entry.session_id
         JOIN artists artist ON artist.id = search_entry.artist_id
         WHERE search_session.event_id IN (${placeholders}) ${dateClause}
         UNION ALL
         SELECT search_session.event_id, search_group.name || ' ' || COALESCE(search_group.short_name, '')
         FROM event_timetable_entries search_entry
         JOIN event_sessions search_session ON search_session.id = search_entry.session_id
         JOIN artist_group_memberships membership ON membership.person_artist_id = search_entry.artist_id
         JOIN artists search_group ON search_group.id = membership.group_artist_id
         WHERE search_session.event_id IN (${placeholders})
           AND (membership.start_date IS NULL OR COALESCE(search_session.end_date, search_session.session_date) >= membership.start_date)
           AND (membership.end_date IS NULL OR search_session.session_date <= membership.end_date)
           ${dateClause}`,
        [
          ...chunk,
          ...chunk, ...dateParams,
          ...chunk, ...dateParams,
          ...chunk,
          ...chunk, ...dateParams,
          ...chunk, ...dateParams,
        ],
      );
      for (const row of rows) searchParts.get(row.event_id)?.push(row.search_text ?? '');
    }

    const queryTokens = tokenizeSearchQuery(keyword);
    return candidates.filter((event) => (
      matchesSearchIndex(buildSearchIndex(searchParts.get(event.id) ?? []), queryTokens)
    ));
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
      `SELECT attribution.artist_id
       FROM event_artist_attributions attribution
       JOIN event_first_summaries event ON event.id = attribution.event_id
       GROUP BY attribution.artist_id
       ORDER BY MAX(event.event_date) DESC, attribution.artist_id`
    );
    return rows.map((row) => row.artist_id);
  }

  async isArtistAttributedToEvent(eventId: string, artistId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ matched: number }>(
      `SELECT 1 AS matched
       FROM event_artist_attributions
       WHERE event_id = ? AND artist_id = ?
       LIMIT 1`,
      [eventId, artistId],
    );
    return row != null;
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
        open_time: input.event_time,
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
      ['event_time', 'open_time'],
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
      `SELECT DISTINCT e.* FROM event_summaries e
       JOIN event_artist_attributions attribution ON attribution.event_id = e.id
       WHERE attribution.artist_id = ?
       ORDER BY e.event_date DESC`,
      [artistId]
    );
  }

  async getArtists(eventId: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT a.*, affiliation.parent_artist_id AS parent_id
       FROM artists a
       JOIN event_artists ea ON ea.artist_id = a.id
       LEFT JOIN artist_basic_affiliations affiliation
         ON affiliation.member_artist_id = a.id
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

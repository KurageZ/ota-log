import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { DateItemRepository } from '../../repositories/DateItemRepository';
import { getDateItemRelativeCopy } from '../../utils/dateItems';
import { generateId } from '../../utils/uuid';

jest.mock('../../utils/uuid', () => ({
  generateId: jest.fn(),
}));

const mockGenerateId = generateId as jest.MockedFunction<typeof generateId>;

function getScalar<T>(db: Database.Database, sql: string): T {
  return db.prepare(sql).pluck().get() as T;
}

describe('DateItemRepository', () => {
  let rawDb: Database.Database;
  let repository: DateItemRepository;

  beforeEach(() => {
    rawDb = new Database(':memory:');
    rawDb.exec('PRAGMA foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) {
      rawDb.exec(statement);
    }

    rawDb.prepare(
      `INSERT INTO artists
         (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('artist-1', '小春', null, null, 'file:///koharu.jpg', null, null, null, 1, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists
         (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('artist-2', '小夏', null, null, null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-1',
      '小春生诞祭',
      'livehouse',
      '2026-04-08',
      '19:00',
      '上海',
      'MAO Livehouse',
      null,
      'planned',
      null,
      null,
      null,
      null,
      null,
      null,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    );

    repository = new DateItemRepository(createAsyncSQLiteAdapter(rawDb));
    mockGenerateId.mockReset();
    const ids = [
      'important-date-id',
      'anniversary-100',
      'anniversary-monthly',
      'anniversary-yearly',
    ];
    let fallbackId = 0;
    mockGenerateId.mockImplementation(() => ids.shift() ?? `generated-${fallbackId++}`);
  });

  afterEach(() => {
    rawDb.close();
  });

  test('creates past important dates with artist links and default anniversaries', async () => {
    const item = await repository.create({
      title: '初见小春',
      date: '2026-01-01',
      source_kind: 'manual',
      notes: '第一场特典会',
      artistIds: ['artist-1', 'artist-2', 'artist-1'],
    });

    expect(item.id).toBe('important-date-id');
    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM important_date_artists')).toBe(2);
    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM important_date_anniversary_rules')).toBe(3);

    const detail = await repository.findById(item.id, '2026-03-01');
    expect(detail?.artists.map((artist) => artist.name)).toEqual(['小夏', '小春']);
    expect(detail?.anniversaries.map((anniversary) => anniversary.label)).toEqual(['每 100 天', '每月', '每年']);
    expect(detail?.relativeText).toBe('已过去 59 天');
    expect(detail?.nextAnniversary?.title).toBe('初见小春的第 2 个月');
    expect(detail?.nextAnniversary?.date).toBe('2026-03-01');
  });

  test('returns visible important dates and anniversary occurrences for calendar month queries', async () => {
    await repository.create({
      title: '生日企划截止',
      date: '2026-04-08',
      source_kind: 'manual',
      show_on_calendar: true,
      artistIds: ['artist-1'],
    });
    await repository.create({
      title: '初见小春',
      date: '2026-01-01',
      source_kind: 'manual',
      show_on_calendar: true,
      artistIds: ['artist-1'],
    });

    const occurrences = await repository.findCalendarOccurrencesByMonth(2026, 4, '2026-04-01');

    expect(occurrences.map((occurrence) => ({
      kind: occurrence.kind,
      date: occurrence.date,
      title: occurrence.title,
      relativeText: occurrence.relativeText,
    }))).toEqual([
      {
        kind: 'important_date_anniversary',
        date: '2026-04-01',
        title: '初见小春的第 3 个月',
        relativeText: '第 3 个月',
      },
      {
        kind: 'important_date',
        date: '2026-04-08',
        title: '生日企划截止',
        relativeText: '还有 7 天',
      },
      {
        kind: 'important_date_anniversary',
        date: '2026-04-10',
        title: '初见小春的第 100 天',
        relativeText: '第 100 天',
      },
    ]);
  });

  test('uses the parent calendar switch for enabled anniversary occurrences', async () => {
    await repository.create({
      title: '初见小春',
      date: '2026-01-01',
      source_kind: 'manual',
      show_on_calendar: false,
      artistIds: ['artist-1'],
    });

    await expect(repository.findCalendarOccurrencesByMonth(2026, 4, '2026-04-01')).resolves.toEqual([]);
  });

  test('does not include disabled anniversaries in calendar or next-anniversary copy', async () => {
    const item = await repository.create({
      title: '初见小春',
      date: '2026-01-01',
      source_kind: 'manual',
      artistIds: ['artist-1'],
    });
    const anniversary = rawDb.prepare(
      "SELECT id FROM important_date_anniversary_rules WHERE important_date_id = ? AND anniversary_kind = 'month'"
    ).pluck().get(item.id) as string;

    await repository.updateAnniversaryRule(anniversary, { enabled: 0 });

    const detail = await repository.findById(item.id, '2026-02-01');
    expect(detail?.nextAnniversary?.label).not.toBe('第 1 个月');
    const occurrences = await repository.findCalendarOccurrencesByMonth(2026, 2, '2026-02-01');
    expect(occurrences.some((occurrence) => occurrence.anniversaryRuleId === anniversary)).toBe(false);
  });

  test('does not create artist links for linked activity dates', async () => {
    const item = await repository.create({
      title: '小春生诞祭',
      date: '2026-04-08',
      source_kind: 'linked_activity',
      linked_event_id: 'event-1',
      artistIds: ['artist-1', 'artist-2'],
    });

    expect(item.linked_event_id).toBe('event-1');
    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM important_date_artists')).toBe(0);

    await repository.update(item.id, { artistIds: ['artist-1'] });

    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM important_date_artists')).toBe(0);
  });

  test('cleans artist links, anniversaries, and scheduled state when deleting', async () => {
    const item = await repository.create({
      title: '初见小春',
      date: '2026-01-01',
      source_kind: 'manual',
      artistIds: ['artist-1'],
    });

    rawDb.prepare(
      `INSERT INTO scheduled_reminder_state
         (id, target_kind, target_id, notification_id, scheduled_for, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('scheduled-id', 'important_date', item.id, 'notification-id', '2026-01-01T01:00:00.000Z', '2026-01-01T00:00:00.000Z');

    await repository.delete(item.id);

    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM important_dates')).toBe(0);
    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM important_date_artists')).toBe(0);
    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM important_date_anniversary_rules')).toBe(0);
    expect(getScalar<number>(rawDb, 'SELECT COUNT(*) FROM scheduled_reminder_state')).toBe(0);
  });

  test('formats date item relative copy by local calendar date', () => {
    expect(getDateItemRelativeCopy('2026-07-10', '2026-07-03').text).toBe('还有 7 天');
    expect(getDateItemRelativeCopy('2026-07-03', '2026-07-03').text).toBe('就是今天');
    expect(getDateItemRelativeCopy('2026-07-01', '2026-07-03').text).toBe('已过去 2 天');
  });
});

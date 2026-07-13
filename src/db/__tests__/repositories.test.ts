import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { ChekiRepository } from '../../repositories/ChekiRepository';
import { ChekiManualEntryRepository } from '../../repositories/ChekiManualEntryRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { ArtistRepository } from '../../repositories/ArtistRepository';
import { UserConfigRepository } from '../../repositories/UserConfigRepository';
import { DEFAULT_PROFILE_EMOJI } from '../../utils/profile';

jest.mock('../../utils/uuid', () => ({
  generateId: jest.fn(() => 'generated-manual-entry-id'),
}));

describe('Cheki repositories', () => {
  let rawDb: Database.Database;
  let chekiRepository: ChekiRepository;
  let chekiManualEntryRepository: ChekiManualEntryRepository;
  let eventRepository: EventRepository;
  let artistRepository: ArtistRepository;

  beforeEach(() => {
    rawDb = new Database(':memory:');
    rawDb.exec('PRAGMA foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) {
      rawDb.exec(statement);
    }

    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('artist-1', 'Artist One', null, null, 'file:///artist-1-avatar.jpg', null, 1, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('artist-2', 'Artist Two', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');

    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-1',
      'Completed Event',
      'livehouse',
      '2026-03-15',
      null,
      'Tokyo',
      'Zepp',
      200,
      'completed',
      null,
      null,
      null,
      null,
      null,
      null,
      '2026-03-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z'
    );

    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-2',
      'Planned Event',
      'livehouse',
      '2026-05-20',
      null,
      'Osaka',
      'Namba Hatch',
      300,
      'planned',
      null,
      null,
      null,
      null,
      null,
      null,
      '2026-05-01T00:00:00.000Z',
      '2026-05-01T00:00:00.000Z'
    );

    rawDb.prepare(
      `INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`
    ).run('event-1', 'artist-1');

    rawDb.prepare(
      `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'cheki-1',
      'event-1',
      'artist-1',
      'file:///cheki-1.jpg',
      '2026-03-15',
      50,
      null,
      '2026-03-15T10:00:00.000Z'
    );
    rawDb.prepare(
      `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'cheki-2',
      null,
      'artist-2',
      'file:///cheki-2.jpg',
      '2026-04-02',
      70,
      null,
      '2026-04-02T10:00:00.000Z'
    );

    rawDb.prepare(
      `INSERT INTO cheki_manual_entries
         (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'manual-1',
      'artist-1',
      'event-1',
      '2026-03-16',
      3,
      120,
      '2026-03-16T10:00:00.000Z',
      '2026-03-16T10:00:00.000Z'
    );
    rawDb.prepare(
      `INSERT INTO cheki_manual_entries
         (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'manual-2',
      'artist-2',
      null,
      '2026-04-03',
      2,
      80,
      '2026-04-03T10:00:00.000Z',
      '2026-04-03T10:00:00.000Z'
    );

    const asyncDb = createAsyncSQLiteAdapter(rawDb);
    chekiRepository = new ChekiRepository(asyncDb);
    chekiManualEntryRepository = new ChekiManualEntryRepository(asyncDb);
    eventRepository = new EventRepository(asyncDb);
    artistRepository = new ArtistRepository(asyncDb);
  });

  afterEach(() => {
    rawDb.close();
  });

  test('aggregates photo and manual counts and prices together', async () => {
    await expect(chekiRepository.countAll()).resolves.toBe(7);
    await expect(chekiRepository.countByYear(2026)).resolves.toBe(7);
    await expect(chekiRepository.sumPriceAll()).resolves.toBe(320);
    await expect(chekiRepository.sumPriceByYear(2026)).resolves.toBe(320);
    await expect(chekiRepository.countByArtistId('artist-1')).resolves.toBe(4);
    await expect(chekiRepository.countByEventId('event-1')).resolves.toBe(4);
    await expect(chekiRepository.sumPriceByArtistId('artist-1')).resolves.toBe(170);
    await expect(chekiRepository.sumPriceByEventId('event-1')).resolves.toBe(170);
    await expect(chekiRepository.getMonthlyCountsByYear(2026)).resolves.toEqual([
      0, 0, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await expect(chekiRepository.getMonthlyCountsByArtistYear(2026, 'artist-1')).resolves.toEqual([
      0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await expect(chekiRepository.countDistinctArtistsByYear(2026)).resolves.toBe(2);
    await expect(chekiRepository.sumPriceByEventIdYear(2026)).resolves.toEqual({ 'event-1': 170 });
    await expect(chekiRepository.groupByArtistYear(2026, undefined, 10)).resolves.toEqual([
      { artistId: 'artist-1', name: 'Artist One', avatarUri: 'file:///artist-1-avatar.jpg', count: 4 },
      { artistId: 'artist-2', name: 'Artist Two', avatarUri: null, count: 3 },
    ]);
  });

  test('artist ranking includes avatars and is not capped by default', async () => {
    for (let index = 3; index <= 9; index += 1) {
      rawDb.prepare(
        `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `artist-${index}`,
        `Artist ${index}`,
        null,
        null,
        `file:///artist-${index}-avatar.jpg`,
        null,
        0,
        '2026-01-01T00:00:00.000Z'
      );
      rawDb.prepare(
        `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `cheki-artist-${index}`,
        null,
        `artist-${index}`,
        `file:///cheki-artist-${index}.jpg`,
        '2026-05-01',
        null,
        null,
        `2026-05-01T00:00:0${index}.000Z`
      );
    }

    const ranking = await chekiRepository.groupByArtistYear(2026);

    expect(ranking).toHaveLength(9);
    expect(ranking[0]).toEqual({
      artistId: 'artist-1',
      name: 'Artist One',
      avatarUri: 'file:///artist-1-avatar.jpg',
      count: 4,
    });
    expect(ranking).toEqual(
      expect.arrayContaining([
        { artistId: 'artist-9', name: 'Artist 9', avatarUri: 'file:///artist-9-avatar.jpg', count: 1 },
      ])
    );
  });

  test('findDistinctArtistIds combines photo and manual cheki artists', async () => {
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('artist-3', 'Artist Three', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO cheki_manual_entries
         (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'manual-3',
      'artist-3',
      null,
      '2026-05-01',
      1,
      null,
      '2026-05-01T10:00:00.000Z',
      '2026-05-01T10:00:00.000Z'
    );
    rawDb.prepare(
      `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'cheki-unlinked',
      null,
      null,
      'file:///cheki-unlinked.jpg',
      '2026-05-02',
      null,
      null,
      '2026-05-02T10:00:00.000Z'
    );

    await expect(chekiRepository.findDistinctArtistIds()).resolves.toEqual([
      'artist-1',
      'artist-2',
      'artist-3',
    ]);
  });

  test('findRecent returns latest photo cheki rows only', async () => {
    rawDb.prepare(
      `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'cheki-3',
      null,
      'artist-1',
      'file:///cheki-3.jpg',
      '2026-05-01',
      90,
      null,
      '2026-05-01T10:00:00.000Z'
    );
    rawDb.prepare(
      `INSERT INTO cheki_manual_entries
         (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'manual-newer',
      'artist-1',
      null,
      '2026-06-01',
      5,
      500,
      '2026-06-01T10:00:00.000Z',
      '2026-06-01T10:00:00.000Z'
    );

    await expect(chekiRepository.findRecent(2)).resolves.toEqual([
      expect.objectContaining({ id: 'cheki-3' }),
      expect.objectContaining({ id: 'cheki-2' }),
    ]);
  });

  test('calendar queries summarize cheki and no-photo records by date', async () => {
    await expect(chekiRepository.findByDate('2026-03-15')).resolves.toEqual([
      expect.objectContaining({ id: 'cheki-1' }),
    ]);
    await expect(chekiManualEntryRepository.findByDate('2026-03-16')).resolves.toEqual([
      expect.objectContaining({ id: 'manual-1' }),
    ]);

    await expect(chekiRepository.findCalendarSummariesByMonth(2026, 3)).resolves.toEqual([
      {
        date: '2026-03-15',
        totalCount: 1,
        photoCount: 1,
        noPhotoCount: 0,
        artistCount: 1,
        latestPhotoUri: 'file:///cheki-1.jpg',
        fallbackArtistAvatarUri: null,
      },
      {
        date: '2026-03-16',
        totalCount: 3,
        photoCount: 0,
        noPhotoCount: 3,
        artistCount: 1,
        latestPhotoUri: null,
        fallbackArtistAvatarUri: 'file:///artist-1-avatar.jpg',
      },
    ]);
  });

  test('findNextPlannedByArtistId returns the nearest planned event for the artist', async () => {
    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-earlier',
      'Earlier Planned',
      'livehouse',
      '2026-05-19',
      '20:00',
      null,
      null,
      null,
      'planned',
      null,
      null,
      null,
      null,
      null,
      null,
      '2026-05-01T00:00:00.000Z',
      '2026-05-01T00:00:00.000Z'
    );
    rawDb.prepare(
      `INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`
    ).run('event-2', 'artist-1');
    rawDb.prepare(
      `INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`
    ).run('event-earlier', 'artist-1');

    await expect(eventRepository.findNextPlannedByArtistId('artist-1')).resolves.toEqual(
      expect.objectContaining({ id: 'event-earlier' })
    );
    await expect(eventRepository.findNextPlannedByArtistId('artist-2')).resolves.toBeNull();
  });

  test('findFavoriteWithRecentInteraction picks the favorite artist with the latest records', async () => {
    rawDb.prepare('UPDATE artists SET is_favorite = 1 WHERE id = ?').run('artist-2');

    await expect(artistRepository.findFavoriteWithRecentInteraction()).resolves.toEqual(
      expect.objectContaining({ id: 'artist-2' })
    );
  });

  test('cheki aggregates respect optional month filter', async () => {
    // 三月：cheki-1(1) + manual-1(3) = 4；四月：cheki-2(1) + manual-2(2) = 3
    await expect(chekiRepository.countByYear(2026, 3)).resolves.toBe(4);
    await expect(chekiRepository.countByYear(2026, 4)).resolves.toBe(3);
    await expect(chekiRepository.countByYear(2026)).resolves.toBe(7);

    await expect(chekiRepository.sumPriceByYear(2026, 3)).resolves.toBe(170);
    await expect(chekiRepository.sumPriceByYear(2026, 4)).resolves.toBe(150);
    await expect(chekiRepository.sumPriceByYear(2026)).resolves.toBe(320);

    await expect(chekiRepository.countDistinctArtistsByYear(2026, 3)).resolves.toBe(1);
    await expect(chekiRepository.countDistinctArtistsByYear(2026, 4)).resolves.toBe(1);

    await expect(chekiRepository.countByArtistYear(2026, 'artist-1', 3)).resolves.toBe(4);
    await expect(chekiRepository.countByArtistYear(2026, 'artist-1', 4)).resolves.toBe(0);

    await expect(chekiRepository.groupByArtistYear(2026, 3, 10)).resolves.toEqual([
      { artistId: 'artist-1', name: 'Artist One', avatarUri: 'file:///artist-1-avatar.jpg', count: 4 },
    ]);

    // 记录表的同名方法同样支持 month
    await expect(chekiManualEntryRepository.countByYear(2026, 3)).resolves.toBe(3);
    await expect(chekiManualEntryRepository.countByYear(2026, 4)).resolves.toBe(2);
    await expect(chekiManualEntryRepository.sumPriceByYear(2026, 4)).resolves.toBe(80);
    await expect(chekiManualEntryRepository.countByArtistYear(2026, 'artist-2', 4)).resolves.toBe(2);
    await expect(chekiManualEntryRepository.countDistinctArtistsByYear(2026, 3)).resolves.toBe(1);
  });

  test('manual entry repository reads and mutates manual rows', async () => {
    await expect(chekiManualEntryRepository.findByArtistId('artist-1')).resolves.toHaveLength(1);
    await expect(chekiManualEntryRepository.findByEventId('event-1')).resolves.toHaveLength(1);

    const created = await chekiManualEntryRepository.create({
      artist_id: 'artist-1',
      event_id: null,
      date: '2026-05-01',
      count: 1,
      total_price: 30,
    });

    await chekiManualEntryRepository.update(created.id, {
      count: 4,
      total_price: 40,
    });

    await expect(chekiManualEntryRepository.findById(created.id)).resolves.toMatchObject({
      id: 'generated-manual-entry-id',
      artist_id: 'artist-1',
      count: 4,
      total_price: 40,
    });

    await chekiManualEntryRepository.delete(created.id);
    await expect(chekiManualEntryRepository.findById(created.id)).resolves.toBeNull();
  });

  test('manual entry repository rejects invalid count and total_price values', async () => {
    await expect(
      chekiManualEntryRepository.create({
        artist_id: 'artist-1',
        count: 0,
      })
    ).rejects.toThrow('count must be an integer greater than or equal to 1');

    await expect(
      chekiManualEntryRepository.create({
        artist_id: 'artist-1',
        count: 1.5,
      })
    ).rejects.toThrow('count must be an integer greater than or equal to 1');

    await expect(
      chekiManualEntryRepository.create({
        artist_id: 'artist-1',
        count: 1,
        total_price: -1,
      })
    ).rejects.toThrow('total_price must be null or a non-negative number');

    await expect(
      chekiManualEntryRepository.update('manual-1', {
        count: 0,
      })
    ).rejects.toThrow('count must be an integer greater than or equal to 1');

    await expect(
      chekiManualEntryRepository.update('manual-1', {
        count: 2.5,
      })
    ).rejects.toThrow('count must be an integer greater than or equal to 1');

    await expect(
      chekiManualEntryRepository.update('manual-1', {
        total_price: -1,
      })
    ).rejects.toThrow('total_price must be null or a non-negative number');
  });

  test('event spend stats include manual entry total_price', async () => {
    await expect(eventRepository.findTopSpendCompletedByYear(2026, undefined, 5)).resolves.toEqual([
      expect.objectContaining({
        event: expect.objectContaining({ id: 'event-1', title: 'Completed Event' }),
        ticketTotal: 200,
        chekiTotal: 170,
        totalSpend: 370,
      }),
    ]);
    await expect(eventRepository.getAverageCompletedSpendByYear(2026)).resolves.toBe(370);
  });

  test('event period stats respect optional month filter', async () => {
    // event-1 在三月（completed），event-2 在五月（planned）
    await expect(eventRepository.getYearStatusCounts(2026)).resolves.toEqual({
      completed: 1,
      planned: 1,
      wishlist: 0,
    });
    await expect(eventRepository.getYearStatusCounts(2026, 3)).resolves.toEqual({
      completed: 1,
      planned: 0,
      wishlist: 0,
    });
    await expect(eventRepository.getYearStatusCounts(2026, 5)).resolves.toEqual({
      completed: 0,
      planned: 1,
      wishlist: 0,
    });

    await expect(eventRepository.findTopCityByYear(2026, 3)).resolves.toEqual({ name: 'Tokyo', count: 1 });
    await expect(eventRepository.findTopCityByYear(2026, 5)).resolves.toEqual({ name: 'Osaka', count: 1 });
    await expect(eventRepository.findTopVenueByYear(2026, 3)).resolves.toEqual({ name: 'Zepp', count: 1 });

    await expect(eventRepository.sumCompletedTicketPriceByYear(2026)).resolves.toBe(200);
    await expect(eventRepository.sumCompletedTicketPriceByYear(2026, 5)).resolves.toBe(0);

    // 三月没有完成的高花费活动以外的活动；五月的 event-2 是 planned，不计入花费榜
    await expect(eventRepository.findTopSpendCompletedByYear(2026, 5, 5)).resolves.toEqual([]);
    await expect(eventRepository.countCompletedByArtistYear(2026, 'artist-1', 3)).resolves.toBe(1);
    await expect(eventRepository.countCompletedByArtistYear(2026, 'artist-1', 4)).resolves.toBe(0);
  });

  test('groupRootArtistsByCompletedEvents ranks only artists without parent', async () => {
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('group-1', 'Group One', null, null, 'file:///group-1.jpg', null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('member-1', 'Member One', null, 'group-1', null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('group-2', 'Group Two', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');

    const insertEvent = rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertEvent.run(
      'event-group-1', 'Group One Show', 'livehouse', '2026-04-10', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2026-04-10T00:00:00.000Z', '2026-04-10T00:00:00.000Z'
    );
    insertEvent.run(
      'event-group-2-apr', 'Group Two April Show', 'livehouse', '2026-04-05', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2026-04-05T00:00:00.000Z', '2026-04-05T00:00:00.000Z'
    );
    insertEvent.run(
      'event-group-2-may', 'Group Two May Show', 'livehouse', '2026-05-05', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z'
    );
    insertEvent.run(
      'event-member', 'Member Solo Show', 'livehouse', '2026-04-20', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2026-04-20T00:00:00.000Z', '2026-04-20T00:00:00.000Z'
    );
    insertEvent.run(
      'event-group-planned', 'Group Planned Show', 'livehouse', '2026-04-25', null, null, null, null,
      'planned', null, null, null, null, null, null,
      '2026-04-25T00:00:00.000Z', '2026-04-25T00:00:00.000Z'
    );

    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-group-1', 'group-1');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-group-2-apr', 'group-2');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-group-2-may', 'group-2');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-member', 'member-1');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-group-planned', 'group-1');

    await expect(eventRepository.groupRootArtistsByCompletedEvents(2026, undefined, 10)).resolves.toEqual([
      { artistId: 'group-2', name: 'Group Two', avatarUri: null, count: 2 },
      { artistId: 'group-1', name: 'Group One', avatarUri: 'file:///group-1.jpg', count: 1 },
      { artistId: 'artist-1', name: 'Artist One', avatarUri: 'file:///artist-1-avatar.jpg', count: 1 },
    ]);
    await expect(eventRepository.groupRootArtistsByCompletedEvents(2026, 4, 10)).resolves.toEqual([
      { artistId: 'group-1', name: 'Group One', avatarUri: 'file:///group-1.jpg', count: 1 },
      { artistId: 'group-2', name: 'Group Two', avatarUri: null, count: 1 },
    ]);
    await expect(eventRepository.groupRootArtistsByCompletedEvents(2026, undefined, 1)).resolves.toEqual([
      { artistId: 'group-2', name: 'Group Two', avatarUri: null, count: 2 },
    ]);
  });

  test('all-time stats include records across years', async () => {
    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-2025', 'Older Completed Event', 'livehouse', '2025-12-20', null, 'Tokyo', 'Older Venue', 100,
      'completed', 5, null, null, null, null, null,
      '2025-12-20T00:00:00.000Z', '2025-12-20T00:00:00.000Z'
    );
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-2025', 'artist-1');
    rawDb.prepare(
      `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('cheki-2025', 'event-2025', 'artist-1', 'file:///cheki-2025.jpg', '2025-12-20', 40, null, '2025-12-20T10:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO cheki_manual_entries
         (id, artist_id, event_id, date, count, total_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'manual-2025', 'artist-1', 'event-2025', '2025-12-20', 2, 50,
      '2025-12-20T10:00:00.000Z', '2025-12-20T10:00:00.000Z'
    );

    await expect(eventRepository.getYearStatusCounts()).resolves.toEqual({
      completed: 2,
      planned: 1,
      wishlist: 0,
    });
    await expect(eventRepository.findTopCityByYear()).resolves.toEqual({ name: 'Tokyo', count: 2 });
    await expect(eventRepository.findTopVenueByYear()).resolves.toEqual({ name: 'Namba Hatch', count: 1 });
    await expect(eventRepository.findPerfectEventsByYear()).resolves.toEqual([
      expect.objectContaining({ id: 'event-2025' }),
    ]);
    await expect(eventRepository.sumCompletedTicketPriceByYear()).resolves.toBe(300);
    await expect(eventRepository.countCompletedByArtistYear(undefined, 'artist-1')).resolves.toBe(2);
    await expect(eventRepository.findRecentCompletedByArtistYear(undefined, 'artist-1')).resolves.toEqual(
      expect.objectContaining({ id: 'event-1' })
    );
    await expect(eventRepository.getAverageCompletedSpendByYear()).resolves.toBe(280);
    await expect(eventRepository.findTopSpendCompletedByYear(undefined, undefined, 5)).resolves.toEqual([
      expect.objectContaining({
        event: expect.objectContaining({ id: 'event-1' }),
        totalSpend: 370,
      }),
      expect.objectContaining({
        event: expect.objectContaining({ id: 'event-2025' }),
        totalSpend: 190,
      }),
    ]);

    await expect(chekiRepository.countByYear()).resolves.toBe(10);
    await expect(chekiRepository.sumPriceByYear()).resolves.toBe(410);
    await expect(chekiRepository.countDistinctArtistsByYear()).resolves.toBe(2);
    await expect(chekiRepository.countByArtistYear(undefined, 'artist-1')).resolves.toBe(7);
    await expect(chekiRepository.groupByArtistYear(undefined, undefined, 10)).resolves.toEqual([
      { artistId: 'artist-1', name: 'Artist One', avatarUri: 'file:///artist-1-avatar.jpg', count: 7 },
      { artistId: 'artist-2', name: 'Artist Two', avatarUri: null, count: 3 },
    ]);
  });

  test('findFiltered filters events by each dimension and period', async () => {
    const ids = async (filter: Parameters<EventRepository['findFiltered']>[0]) =>
      (await eventRepository.findFiltered(filter)).map((event) => event.id);

    await expect(ids({ city: 'Tokyo' })).resolves.toEqual(['event-1']);
    // 城市 / 场地支持自由输入，按包含匹配
    await expect(ids({ city: 'oky' })).resolves.toEqual(['event-1']);
    await expect(ids({ venue: 'Namba' })).resolves.toEqual(['event-2']);
    await expect(ids({ venue: 'Namba Hatch' })).resolves.toEqual(['event-2']);
    await expect(ids({ status: 'planned' })).resolves.toEqual(['event-2']);
    await expect(ids({ artistId: 'artist-1' })).resolves.toEqual(['event-1']);
    await expect(ids({ keyword: 'Tokyo' })).resolves.toEqual(['event-1']);
    await expect(ids({ keyword: 'Completed Event' })).resolves.toEqual(['event-1']);
    await expect(ids({ keyword: 'Artist One' })).resolves.toEqual(['event-1']);
    // 关键词命中场地等用户可见字段
    await expect(ids({ keyword: 'Zepp' })).resolves.toEqual(['event-1']);
    // 内部枚举（如 event_type 'livehouse'）不参与关键词检索
    await expect(ids({ keyword: 'livehouse' })).resolves.toEqual([]);

    // 周期：按年返回两场，按日期倒序
    await expect(ids({ year: 2026 })).resolves.toEqual(['event-2', 'event-1']);
    // 周期 + 城市组合
    await expect(ids({ city: 'Tokyo', year: 2026, month: 3 })).resolves.toEqual(['event-1']);
    await expect(ids({ city: 'Tokyo', year: 2026, month: 4 })).resolves.toEqual([]);
    // 状态 + 月份组合
    await expect(ids({ status: 'planned', year: 2026, month: 5 })).resolves.toEqual(['event-2']);
    await expect(ids({ status: 'completed', year: 2026, month: 5 })).resolves.toEqual([]);
  });

  test('findFiltered combines multiple artist filters with AND semantics', async () => {
    const ids = async (filter: Parameters<EventRepository['findFiltered']>[0]) =>
      (await eventRepository.findFiltered(filter)).map((event) => event.id);

    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-both', 'Two Artist Event', 'livehouse', '2026-08-01', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'
    );
    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-artist-2', 'Artist Two Only', 'livehouse', '2026-09-01', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
    );
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-both', 'artist-1');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-both', 'artist-2');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-artist-2', 'artist-2');

    await expect(ids({ artistIds: ['artist-2'] })).resolves.toEqual(['event-artist-2', 'event-both']);
    await expect(ids({ artistIds: ['artist-1', 'artist-2'] })).resolves.toEqual(['event-both']);
    await expect(ids({ artistIds: ['artist-1', 'artist-2'], status: 'planned' })).resolves.toEqual([]);
  });

  test('findDistinctYears returns deduplicated years in descending order', async () => {
    // 基线两场活动都在 2026，应去重为单个 2026
    await expect(eventRepository.findDistinctYears()).resolves.toEqual([2026]);

    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-3', 'Old Event', 'livehouse', '2024-08-01', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2024-08-01T00:00:00.000Z', '2024-08-01T00:00:00.000Z'
    );

    await expect(eventRepository.findDistinctYears()).resolves.toEqual([2026, 2024]);
  });

  test('findDistinctCities / findDistinctVenues return non-empty distinct values ordered by frequency', async () => {
    // 基线：event-1=Tokyo/Zepp，event-2=Osaka/Namba Hatch
    // 再插入一场 Tokyo 活动，让 Tokyo 计数领先
    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-4', 'Another Tokyo Event', 'livehouse', '2026-06-01', null, 'Tokyo', '  ', null,
      'planned', null, null, null, null, null, null,
      '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'
    );

    await expect(eventRepository.findDistinctCities()).resolves.toEqual(['Tokyo', 'Osaka']);
    // 空白 venue 被过滤，仅保留有效场地
    await expect(eventRepository.findDistinctVenues()).resolves.toEqual(['Namba Hatch', 'Zepp']);
  });

  test('findFiltered supports rating and oshi/favorite scope', async () => {
    const ids = async (filter: Parameters<EventRepository['findFiltered']>[0]) =>
      (await eventRepository.findFiltered(filter)).map((event) => event.id);

    // 给 event-1（completed）打 5 分
    rawDb.prepare(`UPDATE events SET review_score = 5 WHERE id = ?`).run('event-1');

    await expect(ids({ minScore: 5 })).resolves.toEqual(['event-1']);
    await expect(ids({ minScore: 4 })).resolves.toEqual(['event-1']);
    // event-2 无评分（planned），不命中
    await expect(ids({ status: 'planned', minScore: 3 })).resolves.toEqual([]);

    // artist-1 为收藏且出演 event-1；event-2 无出演者
    await expect(ids({ artistScope: 'favorite' })).resolves.toEqual(['event-1']);

    // 设置单推为 artist-1 → 命中 event-1
    rawDb.prepare(
      `INSERT INTO user_config (id, name, avatar_emoji, oshi_artist_id, updated_at)
       VALUES ('default', 'Otaku', '🎤', ?, ?)`
    ).run('artist-1', '2026-01-01T00:00:00.000Z');
    await expect(ids({ artistScope: 'oshi' })).resolves.toEqual(['event-1']);

    // 单推换成未出演任何活动的 artist-2 → 无命中
    rawDb.prepare(`UPDATE user_config SET oshi_artist_id = ? WHERE id = 'default'`).run('artist-2');
    await expect(ids({ artistScope: 'oshi' })).resolves.toEqual([]);
  });

  test('findFiltered scope matches the group an artist belongs to (recursive)', async () => {
    const ids = async (filter: Parameters<EventRepository['findFiltered']>[0]) =>
      (await eventRepository.findFiltered(filter)).map((event) => event.id);

    // 团体 group-1，成员 member-1（收藏），成员所属团体出演 event-5
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('group-1', 'Group One', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('member-1', 'Member One', null, 'group-1', null, null, 1, '2026-01-01T00:00:00.000Z');

    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, event_date, event_time, city, venue, ticket_price, status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'event-5', 'Group Show', 'livehouse', '2026-07-01', null, null, null, null,
      'completed', null, null, null, null, null, null,
      '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'
    );
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-5', 'group-1');

    // 收藏范围：含直接收藏的 artist-1（event-1）+ 收藏成员所属团体 group-1（event-5）
    await expect(ids({ artistScope: 'favorite' })).resolves.toEqual(['event-5', 'event-1']);

    // 单推为成员 member-1：本人未单独出演，但其团体 group-1 出演的 event-5 应命中
    rawDb.prepare(
      `INSERT INTO user_config (id, name, avatar_emoji, oshi_artist_id, updated_at)
       VALUES ('default', 'Otaku', '🎤', ?, ?)`
    ).run('member-1', '2026-01-01T00:00:00.000Z');
    await expect(ids({ artistScope: 'oshi' })).resolves.toEqual(['event-5']);

    // 指定艺人筛选同样递归：选成员 member-1 → 命中其团体 group-1 出演的 event-5
    await expect(ids({ artistId: 'member-1' })).resolves.toEqual(['event-5']);
    await expect(eventRepository.countCompletedByArtistYear(2026, 'member-1')).resolves.toBe(1);

    // 指定艺人 + scope 同时生效（两个递归 CTE 共存于同一查询）
    await expect(ids({ artistId: 'group-1', artistScope: 'favorite' })).resolves.toEqual(['event-5']);

    // 拍立得按艺人统计也递归：给团体 group-1 加一张拍立得，按成员 member-1 统计应计入
    rawDb.prepare(
      `INSERT INTO cheki (id, event_id, artist_id, photo_uri, date, price, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('cheki-group', 'event-5', 'group-1', 'file:///g.jpg', '2026-07-01', 30, null, '2026-07-01T00:00:00.000Z');
    await expect(chekiRepository.countByArtistYear(2026, 'member-1')).resolves.toBe(1);
  });

  test('findDistinctArtistIds includes performers and their recursive members', async () => {
    await expect(eventRepository.findDistinctArtistIds()).resolves.toEqual(['artist-1']);

    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('group-1', 'Group One', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('subgroup-1', 'Subgroup One', null, 'group-1', null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('member-1', 'Member One', null, 'subgroup-1', null, null, 0, '2026-01-01T00:00:00.000Z');

    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-2', 'artist-1');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-2', 'artist-2');
    rawDb.prepare(`INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)`).run('event-2', 'group-1');

    await expect(eventRepository.findDistinctArtistIds()).resolves.toEqual([
      'artist-1',
      'artist-2',
      'group-1',
      'member-1',
      'subgroup-1',
    ]);
  });
});

describe('UserConfigRepository', () => {
  let rawDb: Database.Database;
  let userConfigRepository: UserConfigRepository;

  beforeEach(() => {
    rawDb = new Database(':memory:');
    rawDb.exec('PRAGMA foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) {
      rawDb.exec(statement);
    }
    userConfigRepository = new UserConfigRepository(createAsyncSQLiteAdapter(rawDb));
  });

  afterEach(() => {
    rawDb.close();
  });

  test('getConfig creates the default profile emoji when config is missing', async () => {
    await expect(userConfigRepository.getConfig()).resolves.toEqual(
      expect.objectContaining({
        id: 'default',
        name: 'Otaku',
        avatar_uri: null,
        avatar_emoji: DEFAULT_PROFILE_EMOJI,
        oshi_artist_id: null,
      }),
    );
  });

  test('updateConfig preserves stored avatar_emoji when profile edits omit it', async () => {
    rawDb.prepare(
      `INSERT INTO user_config (id, name, avatar_uri, avatar_emoji, oshi_artist_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      'default',
      'Before',
      'file:///before.jpg',
      '🎸',
      null,
      '2026-01-01T00:00:00.000Z',
    );

    await userConfigRepository.updateConfig({
      name: 'After',
      avatar_uri: null,
    });

    const row = rawDb.prepare(
      'SELECT name, avatar_uri, avatar_emoji FROM user_config WHERE id = ?'
    ).get('default') as {
      name: string;
      avatar_uri: string | null;
      avatar_emoji: string;
    };

    expect(row).toEqual({
      name: 'After',
      avatar_uri: null,
      avatar_emoji: '🎸',
    });
  });
});

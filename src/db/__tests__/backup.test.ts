import Database from 'better-sqlite3';
import { File } from 'expo-file-system';
import { Alert } from 'react-native';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import {
  buildBackupData,
  buildRestoredBackupData,
  backupVersionSupportsArtistType,
  exportFullBackup,
  importBackup,
  normalizeLegacyBackupActivitySessions,
  restoreBackupData,
} from '../../utils/backup';
import { ArtistRepository } from '../../repositories/ArtistRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { TripRepository } from '../../repositories/TripRepository';
import { ExpenseRepository } from '../../repositories/ExpenseRepository';
import { PhotoRepository } from '../../repositories/PhotoRepository';
import { ChekiRepository } from '../../repositories/ChekiRepository';
import { ChekiManualEntryRepository } from '../../repositories/ChekiManualEntryRepository';
import { ChekiRecordRepository } from '../../repositories/ChekiRecordRepository';
import { ChekiWidgetGroupRepository } from '../../repositories/ChekiWidgetGroupRepository';
import { UserConfigRepository } from '../../repositories/UserConfigRepository';
import { DateItemRepository } from '../../repositories/DateItemRepository';
import { EventScheduleRepository } from '../../repositories/EventScheduleRepository';
import { Repositories } from '../../context/DBContext';

let mockBackupUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `20000000-0000-4000-8000-${String(mockBackupUuidIndex++).padStart(12, '0')}`,
}));

describe('legacy backup activity time semantics', () => {
  test('moves only single legacy start times to opening times', () => {
    expect(normalizeLegacyBackupActivitySessions([
      { id: 'legacy', open_time: null, start_time: '18:30' },
      { id: 'explicit', open_time: '17:30', start_time: '18:30' },
    ])).toEqual([
      { id: 'legacy', open_time: '18:30', start_time: null },
      { id: 'explicit', open_time: '17:30', start_time: '18:30' },
    ]);
  });
});

jest.mock('expo-file-system', () => ({
  Directory: class {},
  File: { pickFileAsync: jest.fn() },
  Paths: {
    cache: { uri: 'file:///cache/' },
    document: { uri: 'file:///documents/' },
  },
}));

describe('backup file picker', () => {
  test('handles the SDK 56 canceled result without treating it as a File', async () => {
    const pickFileAsyncMock = File.pickFileAsync as jest.Mock;
    pickFileAsyncMock.mockResolvedValue({ canceled: true, result: null });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await expect(importBackup({} as Repositories)).resolves.toEqual({
      restored: false,
      legacyArtistType: false,
    });

    expect(pickFileAsyncMock).toHaveBeenCalledWith({ mimeTypes: 'application/zip' });
    expect(alertSpy).toHaveBeenCalledWith('没有选到文件');
  });
});

describe('backup version artist type detection', () => {
  test('treats backups before v9 as legacy backups without artist type support', () => {
    expect(backupVersionSupportsArtistType(1)).toBe(false);
    expect(backupVersionSupportsArtistType(8)).toBe(false);
  });

  test('treats v9 and later backups as supporting artist types', () => {
    expect(backupVersionSupportsArtistType(9)).toBe(true);
    expect(backupVersionSupportsArtistType(10)).toBe(true);
  });
});

jest.mock('expo-file-system/legacy', () => ({
  copyAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn(async () => undefined),
}));

function createRepositories(rawDb: Database.Database): Repositories {
  const asyncDb = createAsyncSQLiteAdapter(rawDb);
  const rawDbAdapter = {
    ...asyncDb,
    withTransactionAsync: async (callback: () => Promise<void>) => callback(),
    serializeAsync: async () => new Uint8Array(),
  };

  return {
    rawDb: rawDbAdapter as Repositories['rawDb'],
    artists: new ArtistRepository(rawDbAdapter as Repositories['rawDb']),
    events: new EventRepository(rawDbAdapter as Repositories['rawDb']),
    eventSchedules: new EventScheduleRepository(rawDbAdapter as Repositories['rawDb']),
    trips: new TripRepository(rawDbAdapter as Repositories['rawDb']),
    expenses: new ExpenseRepository(rawDbAdapter as Repositories['rawDb']),
    photos: new PhotoRepository(rawDbAdapter as Repositories['rawDb']),
    cheki: new ChekiRepository(rawDbAdapter as Repositories['rawDb']),
    chekiManualEntries: new ChekiManualEntryRepository(rawDbAdapter as Repositories['rawDb']),
    chekiRecords: new ChekiRecordRepository(rawDbAdapter as Repositories['rawDb']),
    userConfig: new UserConfigRepository(rawDbAdapter as Repositories['rawDb']),
    dateItems: new DateItemRepository(rawDbAdapter as Repositories['rawDb']),
    chekiWidgetGroups: new ChekiWidgetGroupRepository(rawDbAdapter as Repositories['rawDb']),
  };
}

async function seedChekiWidgetGroups(rawDb: Database.Database, repositories: Repositories): Promise<void> {
  const now = '2026-08-25T00:00:00.000Z';
  const insertGroup = rawDb.prepare(
    `INSERT INTO cheki_widget_groups (slot, name, source_type, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?)`,
  );
  for (let slot = 1; slot <= 6; slot += 1) insertGroup.run(slot, `分组 ${slot}`, now, now);
  rawDb.prepare(
    `INSERT INTO artists (id, name, artist_type, is_favorite, created_at)
     VALUES ('widget-artist', 'Widget Artist', 'person', 0, ?)`,
  ).run(now);
  rawDb.prepare(
    `INSERT INTO events (id, title, event_type, status, created_at, updated_at)
     VALUES ('widget-event', 'Widget Event', 'concert', 'completed', ?, ?)`,
  ).run(now, now);
  rawDb.prepare(
    `INSERT INTO event_sessions
       (id, event_id, session_date, sort_order, created_at, updated_at)
     VALUES ('widget-session', 'widget-event', '2026-08-25', 0, ?, ?)`,
  ).run(now, now);
  rawDb.prepare(
    `INSERT INTO cheki_records (id, event_id, artist_id, date, quantity, created_at, updated_at)
     VALUES ('widget-record', 'widget-event', 'widget-artist', '2026-08-25', 2, ?, ?)`,
  ).run(now, now);
  rawDb.prepare(
    `INSERT INTO cheki_items
       (id, record_id, sort_order, unit_price, spec, is_favorite, created_at, updated_at)
     VALUES ('widget-item-1', 'widget-record', 0, 0, 'square', 0, ?, ?)`,
  ).run(now, now);
  rawDb.prepare(
    `INSERT INTO cheki_items
       (id, record_id, sort_order, unit_price, spec, is_favorite, created_at, updated_at)
     VALUES ('widget-item-2', 'widget-record', 1, 0, 'square', 1, ?, ?)`,
  ).run(now, now);
  rawDb.prepare(
    `INSERT INTO cheki_item_images (id, item_id, side, photo_uri, created_at, updated_at)
     VALUES ('widget-image-1', 'widget-item-1', 'front', 'file:///widget-one.jpg', ?, ?)`,
  ).run(now, now);
  rawDb.prepare(
    `INSERT INTO cheki_item_images (id, item_id, side, photo_uri, created_at, updated_at)
     VALUES ('widget-image-2', 'widget-item-2', 'front', 'file:///widget-two.jpg', ?, ?)`,
  ).run(now, now);

  await repositories.chekiWidgetGroups.save(1, {
    name: '手动精选',
    source: { type: 'manual', itemIds: ['widget-item-2', 'widget-item-1'] },
  }, new Date(now));
  await repositories.chekiWidgetGroups.save(2, {
    name: '自动收藏',
    source: {
      type: 'filter',
      rules: {
        artistIds: ['widget-artist'],
        eventIds: ['widget-event'],
        favoriteOnly: true,
        date: null,
        specs: ['square'],
      },
    },
  }, new Date(now));
}

describe('backup artist background metadata support', () => {
  let rawDb: Database.Database;
  let repositories: Repositories;

  beforeEach(() => {
    mockBackupUuidIndex = 0;
    rawDb = new Database(':memory:');
    rawDb.exec('PRAGMA foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) {
      rawDb.exec(statement);
    }
    repositories = createRepositories(rawDb);
  });

  afterEach(() => {
    rawDb.close();
  });

  test('buildBackupData includes artist background metadata', async () => {
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-export',
      'Artist Export',
      null,
      null,
      'file:///artist-avatar.jpg',
      'file:///artist-bg.jpg',
      '#605074',
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );

    const payload = await buildBackupData(repositories);

    expect(payload.artists).toEqual([
      expect.objectContaining({
        id: 'artist-export',
        background_uri: 'file:///artist-bg.jpg',
        background_color: '#605074',
      }),
    ]);
  });

  test('buildBackupData exports cheki widget groups and all source relations', async () => {
    await seedChekiWidgetGroups(rawDb, repositories);

    const payload = await buildBackupData(repositories);

    expect(payload.cheki_widget_groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ slot: 1, name: '手动精选', source_type: 'manual' }),
      expect.objectContaining({ slot: 2, name: '自动收藏', source_type: 'filter' }),
    ]));
    expect(payload.cheki_widget_group_manual_items).toEqual([
      { slot: 1, item_id: 'widget-item-2', sort_order: 0 },
      { slot: 1, item_id: 'widget-item-1', sort_order: 1 },
    ]);
    expect(payload.cheki_widget_group_artists).toEqual([{ slot: 2, artist_id: 'widget-artist' }]);
    expect(payload.cheki_widget_group_events).toEqual([{ slot: 2, event_id: 'widget-event' }]);
    expect(payload.cheki_widget_group_specs).toEqual([{ slot: 2, spec: 'square' }]);
  });

  test('round-trips cheki widget group sources, order, and rotation state', async () => {
    const now = new Date('2026-08-25T00:00:00.000Z');
    await seedChekiWidgetGroups(rawDb, repositories);
    const before = await repositories.chekiWidgetGroups.resolveForWidget(now);
    const payload = await buildBackupData(repositories);
    await repositories.chekiWidgetGroups.reset(1, now);
    await repositories.chekiWidgetGroups.reset(2, now);

    await restoreBackupData(
      repositories,
      payload as unknown as Parameters<typeof restoreBackupData>[1],
    );

    const manual = await repositories.chekiWidgetGroups.getEditorState(1, now);
    expect(manual.source).toEqual({
      type: 'manual',
      itemIds: ['widget-item-2', 'widget-item-1'],
    });
    expect(manual.resolvedItems.map((item) => item.id)).toEqual(['widget-item-2', 'widget-item-1']);

    const filter = await repositories.chekiWidgetGroups.getEditorState(2, now);
    expect(filter.source).toEqual({
      type: 'filter',
      rules: {
        artistIds: ['widget-artist'],
        eventIds: ['widget-event'],
        favoriteOnly: true,
        date: null,
        specs: ['square'],
      },
    });
    expect(filter.resolvedItems.map((item) => item.id)).toEqual(['widget-item-2']);

    const after = await repositories.chekiWidgetGroups.resolveForWidget(now);
    expect(after[0]).toEqual(expect.objectContaining({
      collectionFingerprint: before[0].collectionFingerprint,
      rotationAnchorAt: before[0].rotationAnchorAt,
    }));
    expect(after[1]).toEqual(expect.objectContaining({
      collectionFingerprint: before[1].collectionFingerprint,
      rotationAnchorAt: before[1].rotationAnchorAt,
    }));
  });

  test('restores backups without widget data as six unconfigured groups', async () => {
    await seedChekiWidgetGroups(rawDb, repositories);

    await restoreBackupData(repositories, {
      artists: [{
        id: 'legacy-widget-artist',
        name: 'Legacy Artist',
        short_name: null,
        parent_id: null,
        avatar_uri: null,
        background_uri: null,
        background_color: null,
        url: null,
        is_favorite: 0,
        created_at: '2025-01-01T00:00:00.000Z',
      }],
    });

    await expect(repositories.chekiWidgetGroups.listSummaries()).resolves.toEqual(
      Array.from({ length: 6 }, (_, index) => ({
        slot: index + 1,
        name: `分组 ${index + 1}`,
        sourceType: null,
        displayCount: 0,
      })),
    );
  });

  test('backs up and restores artist types, basic affiliations, and timed memberships', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    const insertArtist = rawDb.prepare(
      `INSERT INTO artists (id, name, artist_type, created_at) VALUES (?, ?, ?, ?)`,
    );
    insertArtist.run('unset-parent', 'Unset Parent', null, now);
    insertArtist.run('unset-member', 'Unset Member', null, now);
    insertArtist.run('group', 'Group', 'group', now);
    insertArtist.run('person', 'Person', 'person', now);
    rawDb.prepare(
      `INSERT INTO artist_basic_affiliations
        (member_artist_id, parent_artist_id, created_at, updated_at)
       VALUES ('unset-member', 'unset-parent', ?, ?)`,
    ).run(now, now);
    rawDb.prepare(
      `INSERT INTO artist_group_memberships
        (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
       VALUES ('membership', 'person', 'group', '2025-01-01', '2025-12-31', ?, ?)`,
    ).run(now, now);

    const data = await buildBackupData(repositories);
    const restoredData = buildRestoredBackupData(
      data as unknown as Parameters<typeof buildRestoredBackupData>[0],
      new Map(),
    );
    await restoreBackupData(
      repositories,
      restoredData,
    );

    expect(rawDb.prepare('SELECT id, artist_type FROM artists ORDER BY id').all()).toEqual([
      { id: 'group', artist_type: 'group' },
      { id: 'person', artist_type: 'person' },
      { id: 'unset-member', artist_type: null },
      { id: 'unset-parent', artist_type: null },
    ]);
    expect(rawDb.prepare(
      'SELECT member_artist_id, parent_artist_id FROM artist_basic_affiliations',
    ).all()).toEqual([{ member_artist_id: 'unset-member', parent_artist_id: 'unset-parent' }]);
    expect(rawDb.prepare(
      `SELECT person_artist_id, group_artist_id, start_date, end_date
       FROM artist_group_memberships`,
    ).all()).toEqual([{
      person_artist_id: 'person',
      group_artist_id: 'group',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
    }]);
  });

  test('full backup restore preparation keeps the legacy parent_id fallback', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    const restoredData = buildRestoredBackupData({
      artists: [
        { id: 'legacy-parent', name: 'Legacy Parent', parent_id: null, created_at: now },
        { id: 'legacy-member', name: 'Legacy Member', parent_id: 'legacy-parent', created_at: now },
      ],
    }, new Map());

    expect(restoredData.artist_basic_affiliations).toBeUndefined();
    await restoreBackupData(repositories, restoredData);

    expect(rawDb.prepare(
      'SELECT member_artist_id, parent_artist_id FROM artist_basic_affiliations',
    ).all()).toEqual([{
      member_artist_id: 'legacy-member',
      parent_artist_id: 'legacy-parent',
    }]);
  });

  test('backs up and restores the artist confirmation preference', async () => {
    await repositories.userConfig.getConfig();
    await repositories.userConfig.updateConfig({ artist_confirmation_mode: 'never' });

    const data = await buildBackupData(repositories);
    expect(data.user_config.artist_confirmation_mode).toBe('never');

    await repositories.userConfig.updateConfig({ artist_confirmation_mode: 'always' });
    await restoreBackupData(
      repositories,
      data as unknown as Parameters<typeof restoreBackupData>[1],
    );

    await expect(repositories.userConfig.getConfig()).resolves.toEqual(expect.objectContaining({
      artist_confirmation_mode: 'never',
    }));
  });

  test('backs up and restores cheki v2 records, items, and both image sides', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    rawDb.prepare(`INSERT INTO cheki_records
      (id, quantity, created_at, updated_at)
      VALUES ('record', 2, ?, ?)`).run(now, now);
    rawDb.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, unit_price, spec, is_favorite, created_at, updated_at)
      VALUES ('item', 'record', 0, 40, 'three_inch_portrait', 1, ?, ?)`).run(now, now);
    rawDb.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, unit_price, spec, is_favorite, created_at, updated_at)
      VALUES ('item-blank', 'record', 1, 40, 'three_inch_portrait', 0, ?, ?)`).run(now, now);
    rawDb.prepare(`INSERT INTO cheki_item_images
      (id, item_id, side, photo_uri, created_at, updated_at)
      VALUES ('front', 'item', 'front', 'file:///front.jpg', ?, ?)`).run(now, now);
    rawDb.prepare(`INSERT INTO cheki_item_images
      (id, item_id, side, photo_uri, created_at, updated_at)
      VALUES ('back', 'item', 'back', 'file:///back.jpg', ?, ?)`).run(now, now);

    const data = await buildBackupData(repositories);
    expect(data.cheki_records).toEqual([expect.objectContaining({ id: 'record', quantity: 2 })]);
    expect(data.cheki_items).toHaveLength(2);
    expect(data.cheki_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'item', unit_price: 40, is_favorite: 1 }),
      expect.objectContaining({ id: 'item-blank', unit_price: 40, is_favorite: 0 }),
    ]));
    expect(data.cheki_item_images.map((image) => image.photo_uri).sort()).toEqual([
      'file:///back.jpg',
      'file:///front.jpg',
    ]);

    await restoreBackupData(
      repositories,
      data as unknown as Parameters<typeof restoreBackupData>[1],
    );
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_records').get()).toEqual({ count: 1 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_items').get()).toEqual({ count: 2 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count FROM cheki_item_images').get()).toEqual({ count: 2 });
  });

  test('backs up and restores activity sessions and timetable rows', async () => {
    const now = '2026-08-01T00:00:00.000Z';
    rawDb.prepare(
      `INSERT INTO artists (id, name, is_favorite, created_at)
       VALUES ('artist-schedule', 'Schedule Artist', 0, ?)`,
    ).run(now);
    rawDb.prepare(
      `INSERT INTO events
         (id, title, event_type, status, actual_expense, created_at, updated_at)
       VALUES ('event-schedule', 'Festival', 'festival', 'planned', 880, ?, ?)`,
    ).run(now, now);
    rawDb.prepare(
      `INSERT INTO event_sessions
         (id, event_id, title, session_date, start_time, city, venue, sort_order, created_at, updated_at)
       VALUES ('session-schedule', 'event-schedule', 'Day 1', '2026-08-08', '18:00', '上海', '场馆', 0, ?, ?)`,
    ).run(now, now);
    rawDb.prepare(
      `INSERT INTO event_timetable_entries
         (id, session_id, title, artist_id, start_time, sort_order, created_at, updated_at)
       VALUES ('entry-schedule', 'session-schedule', '出演', 'artist-schedule', '18:00', 0, ?, ?)`,
    ).run(now, now);

    const data = await buildBackupData(repositories);

    expect(data.events).toEqual([
      expect.objectContaining({ id: 'event-schedule', actual_expense: 880 }),
    ]);
    expect(data.events[0]).not.toHaveProperty('event_date');
    expect(data.event_sessions).toEqual([
      expect.objectContaining({ id: 'session-schedule', session_date: '2026-08-08' }),
    ]);
    expect(data.event_timetable_entries).toEqual([
      expect.objectContaining({
        id: 'entry-schedule',
        session_id: 'session-schedule',
        artist_id: 'artist-schedule',
      }),
    ]);

    await restoreBackupData(
      repositories,
      data as unknown as Parameters<typeof restoreBackupData>[1],
    );

    expect(rawDb.prepare("SELECT actual_expense FROM events WHERE id = 'event-schedule'").get())
      .toEqual({ actual_expense: 880 });
    expect(rawDb.prepare("SELECT session_date FROM event_sessions WHERE id = 'session-schedule'").get())
      .toEqual({ session_date: '2026-08-08' });
    expect(rawDb.prepare("SELECT title FROM event_timetable_entries WHERE id = 'entry-schedule'").get())
      .toEqual({ title: '出演' });
  });

  test('restores a v5-shaped activity as a root event with one default session', async () => {
    const now = '2026-01-01T00:00:00.000Z';

    await restoreBackupData(repositories, {
      events: [{
        id: 'legacy-event',
        title: 'Legacy Event',
        event_type: 'livehouse',
        event_date: '2026-03-04',
        event_time: '19:30',
        city: '东京',
        venue: 'Legacy Hall',
        ticket_price: 520,
        status: 'completed',
        review_score: null,
        notes: null,
        details: null,
        url: null,
        setlist_text: null,
        trip_id: null,
        created_at: now,
        updated_at: now,
      }],
    });

    expect(rawDb.prepare("SELECT actual_expense FROM events WHERE id = 'legacy-event'").get())
      .toEqual({ actual_expense: 520 });
    expect(rawDb.prepare(
      `SELECT session_date, open_time, start_time, city, venue, sort_order
       FROM event_sessions WHERE event_id = 'legacy-event'`,
    ).get()).toEqual({
      session_date: '2026-03-04',
      open_time: '19:30',
      start_time: null,
      city: '东京',
      venue: 'Legacy Hall',
      sort_order: 0,
    });
  });

  test('restores legacy cheki backup rows through the shared migration rules', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    rawDb.prepare(`INSERT INTO artists
      (id, name, is_favorite, created_at) VALUES ('artist', 'Artist', 0, ?)`).run(now);
    await restoreBackupData(repositories, {
      artists: [{
        id: 'artist', name: 'Artist', short_name: null, parent_id: null,
        avatar_uri: null, background_uri: null, background_color: null,
        url: null, is_favorite: 0, created_at: now,
      }],
      cheki: [{
        id: 'legacy-photo', event_id: null, artist_id: 'artist',
        photo_uri: 'file:///legacy.jpg', date: '2026-01-01', price: 12.4,
        notes: 'legacy note', created_at: now,
      }],
      cheki_manual_entries: [{
        id: 'legacy-manual', artist_id: 'artist', event_id: null,
        date: '2026-01-01', count: 2, total_price: 10.4,
        created_at: now, updated_at: now,
      }],
    });
    expect(rawDb.prepare('SELECT quantity FROM cheki_records').get())
      .toEqual({ quantity: 3 });
    expect(rawDb.prepare('SELECT COUNT(*) AS count, SUM(unit_price) AS total FROM cheki_items').get())
      .toEqual({ count: 3, total: 22 });
    expect(rawDb.prepare("SELECT id, unit_price, notes FROM cheki_items WHERE id = 'legacy-photo'").get())
      .toEqual({ id: 'legacy-photo', unit_price: 12, notes: 'legacy note' });
    expect(rawDb.prepare('SELECT side, photo_uri FROM cheki_item_images').get())
      .toEqual({ side: 'front', photo_uri: 'file:///legacy.jpg' });
  });

  test('export refuses to create an incomplete backup when a preset avatar is unavailable', async () => {
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'artist-preset-missing',
      'Preset Missing',
      null,
      null,
      'preset://missing',
      null,
      null,
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );

    await expect(exportFullBackup(repositories)).rejects.toThrow(
      '有 1 个旧版内置艺人头像无法读取，未生成备份',
    );
  });

  test('restoreBackupData persists artist background metadata', async () => {
    await restoreBackupData(repositories, {
      artists: [
        {
          id: 'artist-import',
          name: 'Artist Import',
          short_name: null,
          parent_id: null,
          avatar_uri: 'file:///artist-avatar-import.jpg',
          background_uri: 'file:///artist-bg-import.jpg',
          background_color: '#4b5f73',
          url: null,
          is_favorite: 1,
          created_at: '2026-02-02T00:00:00.000Z',
        },
      ],
      user_config: {
        id: 'default',
        name: 'Otaku',
        avatar_uri: null,
        avatar_emoji: '🎤',
        oshi_artist_id: null,
        updated_at: '2026-02-02T00:00:00.000Z',
      },
    });

    const row = rawDb.prepare('SELECT avatar_uri, background_uri, background_color FROM artists WHERE id = ?').get('artist-import') as {
      avatar_uri: string | null;
      background_uri: string | null;
      background_color: string | null;
    };

    expect(row).toEqual({
      avatar_uri: 'file:///artist-avatar-import.jpg',
      background_uri: 'file:///artist-bg-import.jpg',
      background_color: '#4b5f73',
    });
  });

  test('buildBackupData includes important date records and reminder state', async () => {
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('artist-date-item', 'Date Artist', null, null, null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO important_dates
         (id, title, date, source_kind, notes, show_on_calendar, reminder_enabled, reminder_offset_days, reminder_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('date-item-export', '初见', '2026-01-01', 'manual', null, 1, 1, 1, '10:00', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    rawDb.prepare('INSERT INTO important_date_artists (important_date_id, artist_id) VALUES (?, ?)')
      .run('date-item-export', 'artist-date-item');
    rawDb.prepare(
      `INSERT INTO important_date_anniversary_rules
         (id, important_date_id, anniversary_kind, anniversary_value, label, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('anniversary-export', 'date-item-export', 'day', 100, '第 100 天', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO scheduled_reminder_state
         (id, target_kind, target_id, notification_id, scheduled_for, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('scheduled-export', 'important_date', 'date-item-export', 'notification-export', '2026-01-01T01:00:00.000Z', '2026-01-01T00:00:00.000Z');

    const payload = await buildBackupData(repositories);

    expect(payload.important_dates).toEqual([
      expect.objectContaining({ id: 'date-item-export', title: '初见' }),
    ]);
    expect(payload.important_date_artists).toEqual([{ important_date_id: 'date-item-export', artist_id: 'artist-date-item' }]);
    expect(payload.important_date_anniversary_rules).toEqual([
      expect.objectContaining({ id: 'anniversary-export', label: '第 100 天' }),
    ]);
    expect(payload.scheduled_reminder_state).toEqual([
      expect.objectContaining({ id: 'scheduled-export', notification_id: 'notification-export' }),
    ]);
  });

  test('restoreBackupData persists important dates and related reminder state', async () => {
    await restoreBackupData(repositories, {
      artists: [
        {
          id: 'artist-date-import',
          name: 'Date Artist Import',
          short_name: null,
          parent_id: null,
          avatar_uri: null,
          background_uri: null,
          background_color: null,
          url: null,
          is_favorite: 0,
          created_at: '2026-02-02T00:00:00.000Z',
        },
      ],
      important_dates: [
        {
          id: 'date-item-import',
          title: '生日企划',
          date: '2026-03-03',
          source_kind: 'manual',
          linked_event_id: null,
          notes: '截止日',
          show_on_calendar: 1,
          reminder_enabled: 1,
          reminder_offset_days: 3,
          reminder_time: '08:30',
          created_at: '2026-02-02T00:00:00.000Z',
          updated_at: '2026-02-02T00:00:00.000Z',
        },
      ],
      important_date_artists: [
        { important_date_id: 'date-item-import', artist_id: 'artist-date-import' },
      ],
      important_date_anniversary_rules: [
        {
          id: 'anniversary-import',
          important_date_id: 'date-item-import',
          anniversary_kind: 'day',
          anniversary_value: 100,
          label: '第 100 天',
          enabled: 1,
          created_at: '2026-02-02T00:00:00.000Z',
          updated_at: '2026-02-02T00:00:00.000Z',
        },
      ],
      scheduled_reminder_state: [
        {
          id: 'scheduled-import',
          target_kind: 'important_date',
          target_id: 'date-item-import',
          notification_id: 'notification-import',
          scheduled_for: '2026-03-01T23:30:00.000Z',
          updated_at: '2026-02-02T00:00:00.000Z',
        },
      ],
      user_config: {
        id: 'default',
        name: 'Otaku',
        avatar_uri: null,
        avatar_emoji: '🎤',
        oshi_artist_id: null,
        updated_at: '2026-02-02T00:00:00.000Z',
      },
    });

    expect(rawDb.prepare("SELECT title FROM important_dates WHERE id = 'date-item-import'").pluck().get()).toBe('生日企划');
    expect(rawDb.prepare('SELECT COUNT(*) FROM important_date_artists').pluck().get()).toBe(1);
    expect(rawDb.prepare("SELECT label FROM important_date_anniversary_rules WHERE id = 'anniversary-import'").pluck().get()).toBe('第 100 天');
    expect(rawDb.prepare("SELECT reminder_time FROM important_dates WHERE id = 'date-item-import'").pluck().get()).toBe('08:30');
    expect(rawDb.prepare("SELECT notification_id FROM scheduled_reminder_state WHERE id = 'scheduled-import'").pluck().get()).toBe('notification-import');
  });
});

import Database from 'better-sqlite3';
import { File } from 'expo-file-system';
import { Alert } from 'react-native';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { buildBackupData, exportFullBackup, importBackup, restoreBackupData } from '../../utils/backup';
import { ArtistRepository } from '../../repositories/ArtistRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { TripRepository } from '../../repositories/TripRepository';
import { ExpenseRepository } from '../../repositories/ExpenseRepository';
import { PhotoRepository } from '../../repositories/PhotoRepository';
import { ChekiRepository } from '../../repositories/ChekiRepository';
import { ChekiManualEntryRepository } from '../../repositories/ChekiManualEntryRepository';
import { ChekiRecordRepository } from '../../repositories/ChekiRecordRepository';
import { UserConfigRepository } from '../../repositories/UserConfigRepository';
import { DateItemRepository } from '../../repositories/DateItemRepository';
import { Repositories } from '../../context/DBContext';

let mockBackupUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `20000000-0000-4000-8000-${String(mockBackupUuidIndex++).padStart(12, '0')}`,
}));

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

    await expect(importBackup({} as Repositories)).resolves.toBe(false);

    expect(pickFileAsyncMock).toHaveBeenCalledWith({ mimeTypes: 'application/zip' });
    expect(alertSpy).toHaveBeenCalledWith('没有选到文件');
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
    trips: new TripRepository(rawDbAdapter as Repositories['rawDb']),
    expenses: new ExpenseRepository(rawDbAdapter as Repositories['rawDb']),
    photos: new PhotoRepository(rawDbAdapter as Repositories['rawDb']),
    cheki: new ChekiRepository(rawDbAdapter as Repositories['rawDb']),
    chekiManualEntries: new ChekiManualEntryRepository(rawDbAdapter as Repositories['rawDb']),
    chekiRecords: new ChekiRecordRepository(rawDbAdapter as Repositories['rawDb']),
    userConfig: new UserConfigRepository(rawDbAdapter as Repositories['rawDb']),
    dateItems: new DateItemRepository(rawDbAdapter as Repositories['rawDb']),
  };
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
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
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

  test('backs up and restores cheki v2 records, items, and both image sides', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    rawDb.prepare(`INSERT INTO cheki_records
      (id, quantity, created_at, updated_at)
      VALUES ('record', 2, ?, ?)`).run(now, now);
    rawDb.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, created_at, updated_at)
      VALUES ('item', 'record', 0, 40, ?, 1, ?, ?)`).run(54 / 86, now, now);
    rawDb.prepare(`INSERT INTO cheki_items
      (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, created_at, updated_at)
      VALUES ('item-blank', 'record', 1, 40, ?, 0, ?, ?)`).run(54 / 86, now, now);
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
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
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
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
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

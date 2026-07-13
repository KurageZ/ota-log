import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { buildBackupData, restoreBackupData } from '../../utils/backup';
import { ArtistRepository } from '../../repositories/ArtistRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { TripRepository } from '../../repositories/TripRepository';
import { ExpenseRepository } from '../../repositories/ExpenseRepository';
import { PhotoRepository } from '../../repositories/PhotoRepository';
import { ChekiRepository } from '../../repositories/ChekiRepository';
import { ChekiManualEntryRepository } from '../../repositories/ChekiManualEntryRepository';
import { UserConfigRepository } from '../../repositories/UserConfigRepository';
import { DateItemRepository } from '../../repositories/DateItemRepository';
import { Repositories } from '../../context/DBContext';

jest.mock('expo-file-system', () => ({
  Directory: class {},
  File: class {},
  Paths: {
    cache: { uri: 'file:///cache/' },
    document: { uri: 'file:///documents/' },
  },
}));

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
    userConfig: new UserConfigRepository(rawDbAdapter as Repositories['rawDb']),
    dateItems: new DateItemRepository(rawDbAdapter as Repositories['rawDb']),
  };
}

describe('backup artist background metadata support', () => {
  let rawDb: Database.Database;
  let repositories: Repositories;

  beforeEach(() => {
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

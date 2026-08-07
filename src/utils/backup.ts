import { Directory, File, Paths } from 'expo-file-system';
import { copyAsync as copyFileAsync } from 'expo-file-system/legacy';
import JSZip from 'jszip';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { unzip } from 'react-native-zip-archive';
import { Repositories } from '../context/DBContext';
import { copyToDocuments } from './copyToDocuments';
import { materializePresetArtistAvatars } from './presetArtistMedia';
import { migrateLegacyChekiData } from '../db/legacyChekiMigration';
import { generateId } from './uuid';
import { normalizeArtistConfirmationMode } from './artistConfirmation';

const BACKUP_VERSION = 6;
const FULL_BACKUP_MANIFEST_FORMAT = 'ota-log-full-backup';
const EXPORT_YIELD_INTERVAL = 4;
const ZIP_PROGRESS_START = 82;
const ZIP_PROGRESS_END = 99;
const UNIQUE_PATH_ATTEMPTS = 100;
const BACKUP_EXPORT_FILENAME_PATTERN = /^ota_log_backup_\d{8}_\d{6}(?:_\d+)?\.zip$/;

interface EventArtistRow { event_id: string; artist_id: string; sort_order?: number }
interface ImportantDateArtistRow { important_date_id: string; artist_id: string }

type Row = Record<string, string | number | null>;

interface BackupData {
  artists: Awaited<ReturnType<Repositories['artists']['findAll']>>;
  trips: Awaited<ReturnType<Repositories['trips']['findAll']>>;
  events: Row[];
  event_sessions: Row[];
  event_timetable_entries: Row[];
  event_artists: EventArtistRow[];
  expenses: Awaited<ReturnType<Repositories['expenses']['findAll']>>;
  cheki_records: Row[];
  cheki_items: Row[];
  cheki_item_images: Row[];
  photos: Awaited<ReturnType<Repositories['photos']['findAll']>>;
  user_config: Awaited<ReturnType<Repositories['userConfig']['getConfig']>>;
  important_dates: Row[];
  important_date_artists: ImportantDateArtistRow[];
  important_date_anniversary_rules: Row[];
  scheduled_reminder_state: Row[];
}

interface BackupPayload {
  version: number;
  exported_at: string;
  note: string;
  data: BackupData;
}

interface FullBackupManifest {
  format: typeof FULL_BACKUP_MANIFEST_FORMAT;
  version: number;
  exported_at: string;
  note: string;
  files: {
    database: string;
    data: string;
    media_dir: string;
  };
  media_files: Array<{
    original_uri: string;
    archive_path: string;
    filename: string;
  }>;
}

interface ImportDataShape {
  artists?: Row[];
  trips?: Row[];
  events?: Row[];
  event_sessions?: Row[];
  event_timetable_entries?: Row[];
  event_artists?: EventArtistRow[];
  expenses?: Row[];
  cheki?: Row[];
  cheki_manual_entries?: Row[];
  cheki_records?: Row[];
  cheki_items?: Row[];
  cheki_item_images?: Row[];
  photos?: Row[];
  user_config?: Row;
  important_dates?: Row[];
  important_date_artists?: ImportantDateArtistRow[];
  important_date_anniversary_rules?: Row[];
  scheduled_reminder_state?: Row[];
}

interface ExportFullBackupOptions {
  onProgress?: (progress: number) => void;
}

interface VersionedImportPayload {
  version: number;
  data: ImportDataShape;
}

export async function buildBackupData(db: Repositories): Promise<BackupData> {
  const [
    artists,
    trips,
    events,
    eventSessions,
    timetableEntries,
    expenses,
    chekiRecords,
    chekiItems,
    chekiItemImages,
    photos,
    eventArtists,
    importantDates,
    importantDateArtists,
    importantDateAnniversaries,
    scheduledReminderState,
  ] = await Promise.all([
    db.artists.findAll(),
    db.trips.findAll(),
    db.rawDb.getAllAsync<Row>('SELECT * FROM events'),
    db.rawDb.getAllAsync<Row>('SELECT * FROM event_sessions'),
    db.rawDb.getAllAsync<Row>('SELECT * FROM event_timetable_entries'),
    db.expenses.findAll(),
    db.rawDb.getAllAsync<Row>('SELECT * FROM cheki_records'),
    db.rawDb.getAllAsync<Row>('SELECT * FROM cheki_items'),
    db.rawDb.getAllAsync<Row>('SELECT * FROM cheki_item_images'),
    db.photos.findAll(),
    db.rawDb.getAllAsync<EventArtistRow>('SELECT * FROM event_artists'),
    db.rawDb.getAllAsync<Row>('SELECT * FROM important_dates'),
    db.rawDb.getAllAsync<ImportantDateArtistRow>('SELECT * FROM important_date_artists'),
    db.rawDb.getAllAsync<Row>('SELECT * FROM important_date_anniversary_rules'),
    db.rawDb.getAllAsync<Row>('SELECT * FROM scheduled_reminder_state'),
  ]);
  const userConfig = await db.userConfig.getConfig();

  return {
    artists,
    trips,
    events,
    event_sessions: eventSessions,
    event_timetable_entries: timetableEntries,
    event_artists: eventArtists,
    expenses,
    cheki_records: chekiRecords,
    cheki_items: chekiItems,
    cheki_item_images: chekiItemImages,
    photos,
    user_config: userConfig,
    important_dates: importantDates,
    important_date_artists: importantDateArtists,
    important_date_anniversary_rules: importantDateAnniversaries,
    scheduled_reminder_state: scheduledReminderState,
  };
}

async function buildBackupPayload(db: Repositories): Promise<BackupPayload> {
  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    note: '完整备份包含数据库、业务数据和本地图片文件。',
    data: await buildBackupData(db),
  };
}

function isBackupLocalFileUri(uri: string | null | undefined): uri is string {
  return !!uri && uri.startsWith('file://');
}

function collectReferencedMediaUris(payload: BackupPayload): string[] {
  const uris = new Set<string>();
  for (const photo of payload.data.photos) {
    if (isBackupLocalFileUri(photo.local_uri)) uris.add(photo.local_uri);
  }
  for (const image of payload.data.cheki_item_images) {
    if (isBackupLocalFileUri(image.photo_uri as string | null)) {
      uris.add(image.photo_uri as string);
    }
  }
  for (const artist of payload.data.artists) {
    if (isBackupLocalFileUri(artist.avatar_uri)) uris.add(artist.avatar_uri);
    if (isBackupLocalFileUri(artist.background_uri)) uris.add(artist.background_uri);
  }
  if (isBackupLocalFileUri(payload.data.user_config.avatar_uri)) {
    uris.add(payload.data.user_config.avatar_uri);
  }
  return Array.from(uris).sort();
}

function collectBackupMediaUrisFromData(data: ImportDataShape): string[] {
  const uris = new Set<string>();
  for (const photo of data.photos ?? []) {
    const localUri = typeof photo.local_uri === 'string' ? photo.local_uri : null;
    if (isBackupLocalFileUri(localUri)) uris.add(localUri);
  }
  for (const cheki of data.cheki ?? []) {
    const photoUri = typeof cheki.photo_uri === 'string' ? cheki.photo_uri : null;
    if (isBackupLocalFileUri(photoUri)) uris.add(photoUri);
  }
  for (const image of data.cheki_item_images ?? []) {
    const photoUri = typeof image.photo_uri === 'string' ? image.photo_uri : null;
    if (isBackupLocalFileUri(photoUri)) uris.add(photoUri);
  }
  for (const artist of data.artists ?? []) {
    const avatarUri = typeof artist.avatar_uri === 'string' ? artist.avatar_uri : null;
    if (isBackupLocalFileUri(avatarUri)) uris.add(avatarUri);
    const backgroundUri = typeof artist.background_uri === 'string' ? artist.background_uri : null;
    if (isBackupLocalFileUri(backgroundUri)) uris.add(backgroundUri);
  }
  const userAvatarUri = data.user_config && typeof data.user_config.avatar_uri === 'string'
    ? data.user_config.avatar_uri
    : null;
  if (isBackupLocalFileUri(userAvatarUri)) {
    uris.add(userAvatarUri);
  }
  return Array.from(uris).sort();
}

function sanitizeFilename(name: string, fallback: string): string {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[\\/:*?"<>|]/g, '_');
  return safe || fallback;
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function pathExists(path: File | Directory): boolean {
  return path.exists;
}

function assertSafeRelativePath(path: string): void {
  if (!path || path.startsWith('/') || path.startsWith('\\')) {
    throw new Error('备份文件路径无效');
  }

  const parts = path.split(/[\\/]+/);
  if (parts.some((part) => part === '..')) {
    throw new Error('备份文件路径无效');
  }
}

function appendPath(parentUri: string, path: string): string {
  assertSafeRelativePath(path);
  const base = parentUri.endsWith('/') ? parentUri : `${parentUri}/`;
  return `${base}${path}`;
}

function createUniqueDirectory(parentUri: string, dirname: string): Directory {
  for (let attempt = 0; attempt < UNIQUE_PATH_ATTEMPTS; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`;
    const candidate = new Directory(parentUri, `${dirname}${suffix}`);
    if (!pathExists(candidate)) {
      candidate.create();
      return candidate;
    }
  }

  throw new Error('无法生成临时目录');
}

async function createUniqueFile(parentUri: string, filename: string): Promise<File> {
  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex >= 0 ? filename.slice(dotIndex) : '';

  for (let attempt = 0; attempt < UNIQUE_PATH_ATTEMPTS; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`;
    const candidate = new File(parentUri, `${base}${suffix}${ext}`);
    if (!pathExists(candidate)) return candidate;
  }

  throw new Error('无法生成唯一文件名');
}

function getRestoredMediaFilenamePrefix(filename: string): string {
  if (filename.startsWith('weibo_avatar_')) return 'weibo_avatar';
  if (filename.startsWith('artist_bg_') || filename.startsWith('showcase_bg_')) return 'artist_bg';
  return 'photo';
}

function deleteFileQuietly(file: File): void {
  try {
    file.delete();
  } catch {
    // Temporary import files live in cache; failing to clean them should not block restore.
  }
}

function deleteDirectoryQuietly(directory: Directory): void {
  try {
    directory.delete();
  } catch {
    // Temporary import directories live in cache; failing to clean them should not block restore.
  }
}

function cleanupHistoricCacheBackups(): void {
  try {
    const cacheDirectory = new Directory(Paths.cache);
    for (const entry of cacheDirectory.list()) {
      if (entry instanceof File && BACKUP_EXPORT_FILENAME_PATTERN.test(entry.name)) {
        deleteFileQuietly(entry);
      }
    }
  } catch {
    // Cache cleanup is best-effort; backup creation should still proceed if the OS rejects a stale file.
  }
}

async function copyMediaFileToDocuments(filename: string, file: File): Promise<string> {
  const safeFilename = sanitizeFilename(filename, 'media');
  return copyToDocuments(file.uri, {
    filenamePrefix: getRestoredMediaFilenamePrefix(safeFilename),
  });
}

async function copyPickedBackupToCache(file: File): Promise<File> {
  const safeName = sanitizeFilename(file.name || 'backup.zip', 'backup.zip');
  const target = await createUniqueFile(Paths.cache.uri, safeName);
  await copyFileAsync({ from: file.uri, to: target.uri });
  return target;
}

function replaceMediaUris<T extends Row>(
  rows: T[] | undefined,
  field: keyof T,
  uriMap: Map<string, string>,
): T[] {
  return (rows ?? []).map((row) => {
    const value = row[field];
    if (typeof value !== 'string') return row;
    const mapped = uriMap.get(value);
    return mapped ? { ...row, [field]: mapped } : row;
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return '请确认选择的是正确的备份文件后再试一次。';
}

function buildEventDatesById(events: Row[], sessions: Row[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const event of events) {
    if (typeof event.event_date === 'string') {
      result.set(String(event.id), event.event_date);
    }
  }
  for (const session of [...sessions].sort((a, b) =>
    String(a.session_date).localeCompare(String(b.session_date)))) {
    const eventId = String(session.event_id);
    if (!result.has(eventId) && typeof session.session_date === 'string') {
      result.set(eventId, session.session_date);
    }
  }
  return result;
}

export async function restoreBackupData(db: Repositories, data: ImportDataShape): Promise<void> {
  const {
    artists = [],
    trips = [],
    events = [],
    event_sessions = [],
    event_timetable_entries = [],
    event_artists = [],
    expenses = [],
    cheki = [],
    cheki_manual_entries = [],
    cheki_records = [],
    cheki_items = [],
    cheki_item_images = [],
    photos = [],
    user_config,
    important_dates = [],
    important_date_artists = [],
    important_date_anniversary_rules = [],
    scheduled_reminder_state = [],
  } = data;
  const migratedLegacy = cheki_records.length === 0 && (cheki.length > 0 || cheki_manual_entries.length > 0)
    ? migrateLegacyChekiData(
        {
          cheki: cheki.map((row) => ({
            id: String(row.id),
            event_id: typeof row.event_id === 'string' ? row.event_id : null,
            artist_id: typeof row.artist_id === 'string' ? row.artist_id : null,
            photo_uri: String(row.photo_uri),
            date: typeof row.date === 'string' ? row.date : null,
            price: row.price == null ? null : Number(row.price),
            notes: typeof row.notes === 'string' ? row.notes : null,
            created_at: String(row.created_at),
          })),
          manualEntries: cheki_manual_entries.map((row) => ({
            id: String(row.id),
            artist_id: typeof row.artist_id === 'string' ? row.artist_id : null,
            event_id: typeof row.event_id === 'string' ? row.event_id : null,
            date: typeof row.date === 'string' ? row.date : null,
            count: Number(row.count),
            total_price: row.total_price == null ? null : Number(row.total_price),
            created_at: String(row.created_at),
            updated_at: String(row.updated_at ?? row.created_at),
          })),
          eventDatesById: buildEventDatesById(events, event_sessions),
        },
        { generateId },
      )
    : null;
  const recordsToRestore = migratedLegacy?.records ?? cheki_records;
  const itemsToRestore = migratedLegacy?.items ?? cheki_items;
  const imagesToRestore = migratedLegacy?.images ?? cheki_item_images;

  await db.rawDb.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.rawDb.withTransactionAsync(async () => {
      await db.rawDb.execAsync(`
        DELETE FROM scheduled_reminder_state;
        DELETE FROM important_date_anniversary_rules;
        DELETE FROM important_date_artists;
        DELETE FROM important_dates;
        DELETE FROM event_timetable_entries;
        DELETE FROM event_sessions;
        DELETE FROM event_artists;
        DELETE FROM photos;
        DELETE FROM expenses;
        DELETE FROM cheki_item_images;
        DELETE FROM cheki_items;
        DELETE FROM cheki_records;
        DELETE FROM events;
        DELETE FROM trips;
        DELETE FROM user_config;
        DELETE FROM artists;
      `);

      for (const a of artists) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(a.id),
            String(a.name),
            a.short_name ?? null,
            a.parent_id ?? null,
            a.avatar_uri ?? null,
            a.background_uri ?? null,
            a.background_color ?? null,
            a.url ?? null,
            Number(a.is_favorite ?? 0),
            String(a.created_at),
          ]
        );
      }

      for (const t of trips) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO trips (id, name, origin_city, dest_city, depart_date, return_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(t.id),
            String(t.name),
            t.origin_city ?? null,
            t.dest_city ?? null,
            t.depart_date ?? null,
            t.return_date ?? null,
            t.notes ?? null,
            String(t.created_at),
            String(t.updated_at),
          ]
        );
      }

      for (const e of events) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO events
             (id, title, event_type, status, review_score, notes, details, url,
              setlist_text, actual_expense, trip_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(e.id),
            String(e.title),
            String(e.event_type ?? 'livehouse'),
            String(e.status),
            e.review_score ?? null,
            e.notes ?? null,
            e.details ?? null,
            e.url ?? null,
            e.setlist_text ?? null,
            e.actual_expense ?? e.ticket_price ?? null,
            e.trip_id ?? null,
            String(e.created_at),
            String(e.updated_at),
          ]
        );
      }

      const sessionsToRestore = event_sessions.length > 0
        ? event_sessions
        : events.map((event) => ({
            id: generateId(),
            event_id: String(event.id),
            title: null,
            session_date: String(event.event_date),
            end_date: null,
            open_time: null,
            start_time: event.event_time ?? null,
            end_time: null,
            city: event.city ?? null,
            venue: event.venue ?? null,
            sort_order: 0,
            created_at: String(event.created_at),
            updated_at: String(event.updated_at),
          }));

      for (const session of sessionsToRestore) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO event_sessions
             (id, event_id, title, session_date, end_date, open_time, start_time,
              end_time, city, venue, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(session.id),
            String(session.event_id),
            session.title ?? null,
            String(session.session_date),
            session.end_date ?? null,
            session.open_time ?? null,
            session.start_time ?? null,
            session.end_time ?? null,
            session.city ?? null,
            session.venue ?? null,
            Number(session.sort_order ?? 0),
            String(session.created_at),
            String(session.updated_at),
          ],
        );
      }

      const nextArtistOrderByEvent = new Map<string, number>();
      for (const ea of event_artists) {
        const fallbackOrder = nextArtistOrderByEvent.get(ea.event_id) ?? 0;
        await db.rawDb.runAsync(
          'INSERT OR IGNORE INTO event_artists (event_id, artist_id, sort_order) VALUES (?, ?, ?)',
          [ea.event_id, ea.artist_id, ea.sort_order ?? fallbackOrder]
        );
        nextArtistOrderByEvent.set(ea.event_id, fallbackOrder + 1);
      }

      for (const entry of event_timetable_entries) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO event_timetable_entries
             (id, session_id, title, artist_id, start_time, end_time, notes,
              sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(entry.id),
            String(entry.session_id),
            String(entry.title),
            entry.artist_id ?? null,
            entry.start_time ?? null,
            entry.end_time ?? null,
            entry.notes ?? null,
            Number(entry.sort_order ?? 0),
            String(entry.created_at),
            String(entry.updated_at),
          ],
        );
      }

      for (const ex of expenses) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO expenses (id, trip_id, event_id, category, amount, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            String(ex.id),
            ex.trip_id ?? null,
            ex.event_id ?? null,
            String(ex.category),
            Number(ex.amount),
            ex.notes ?? null,
            String(ex.created_at),
          ]
        );
      }

      for (const record of recordsToRestore) {
        await db.rawDb.runAsync(
          `INSERT INTO cheki_records
             (id, event_id, artist_id, date, quantity, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(record.id),
            record.event_id ?? null,
            record.artist_id ?? null,
            record.date ?? null,
            Number(record.quantity),
            record.notes ?? null,
            String(record.created_at),
            String(record.updated_at),
          ]
        );
      }

      for (const item of itemsToRestore) {
        await db.rawDb.runAsync(
          `INSERT INTO cheki_items
             (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(item.id),
            String(item.record_id),
            Number(item.sort_order),
            Number(item.unit_price ?? 0),
            Number(item.display_aspect_ratio),
            Number(item.is_favorite ?? 0),
            item.notes ?? null,
            String(item.created_at),
            String(item.updated_at),
          ]
        );
      }

      for (const image of imagesToRestore) {
        await db.rawDb.runAsync(
          `INSERT INTO cheki_item_images
             (id, item_id, side, photo_uri, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            String(image.id),
            String(image.item_id),
            String(image.side),
            String(image.photo_uri),
            String(image.created_at),
            String(image.updated_at),
          ],
        );
      }

      for (const ph of photos) {
        await db.rawDb.runAsync(
          'INSERT OR REPLACE INTO photos (id, event_id, local_uri, created_at) VALUES (?, ?, ?, ?)',
          [String(ph.id), ph.event_id ?? null, String(ph.local_uri), String(ph.created_at)]
        );
      }

      for (const item of important_dates) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO important_dates
             (id, title, date, source_kind, linked_event_id, notes, show_on_calendar, reminder_enabled, reminder_offset_days, reminder_time, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(item.id),
            String(item.title),
            String(item.date),
            String(item.source_kind ?? 'manual'),
            item.linked_event_id ?? null,
            item.notes ?? null,
            Number(item.show_on_calendar ?? 1),
            Number(item.reminder_enabled ?? 0),
            Number(item.reminder_offset_days ?? 0),
            String(item.reminder_time ?? '09:00'),
            String(item.created_at),
            String(item.updated_at ?? item.created_at ?? new Date().toISOString()),
          ]
        );
      }

      for (const link of important_date_artists) {
        await db.rawDb.runAsync(
          'INSERT OR IGNORE INTO important_date_artists (important_date_id, artist_id) VALUES (?, ?)',
          [link.important_date_id, link.artist_id]
        );
      }

      for (const anniversary of important_date_anniversary_rules) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO important_date_anniversary_rules
             (id, important_date_id, anniversary_kind, anniversary_value, label, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(anniversary.id),
            String(anniversary.important_date_id),
            String(anniversary.anniversary_kind),
            Number(anniversary.anniversary_value),
            String(anniversary.label),
            Number(anniversary.enabled ?? 1),
            String(anniversary.created_at),
            String(anniversary.updated_at ?? anniversary.created_at ?? new Date().toISOString()),
          ]
        );
      }

      for (const state of scheduled_reminder_state) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO scheduled_reminder_state
             (id, target_kind, target_id, notification_id, scheduled_for, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            String(state.id),
            String(state.target_kind),
            String(state.target_id),
            String(state.notification_id),
            String(state.scheduled_for),
            String(state.updated_at ?? new Date().toISOString()),
          ]
        );
      }

      if (user_config) {
        await db.rawDb.runAsync(
          `INSERT OR REPLACE INTO user_config
             (id, name, avatar_uri, avatar_emoji, oshi_artist_id, artist_confirmation_mode, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            String(user_config.id ?? 'default'),
            String(user_config.name ?? 'Otaku'),
            user_config.avatar_uri ?? null,
            String(user_config.avatar_emoji ?? '🎤'),
            user_config.oshi_artist_id ?? null,
            normalizeArtistConfirmationMode(user_config.artist_confirmation_mode),
            String(user_config.updated_at ?? new Date().toISOString()),
          ]
        );
        if (user_config.oshi_artist_id) {
          await db.rawDb.runAsync(
            'UPDATE artists SET is_favorite = 1 WHERE id = ?',
            [String(user_config.oshi_artist_id)]
          );
        }
      }
    });
  } finally {
    await db.rawDb.execAsync('PRAGMA foreign_keys = ON');
  }
}

function upgradeBackupDataV1ToCurrent(payload: VersionedImportPayload): VersionedImportPayload {
  return {
    version: BACKUP_VERSION,
    data: {
      ...payload.data,
      cheki_manual_entries: payload.data.cheki_manual_entries ?? [],
      important_dates: payload.data.important_dates ?? [],
      important_date_artists: payload.data.important_date_artists ?? [],
      important_date_anniversary_rules: payload.data.important_date_anniversary_rules ?? [],
      scheduled_reminder_state: payload.data.scheduled_reminder_state ?? [],
    },
  };
}

function upgradeBackupDataV2ToCurrent(payload: VersionedImportPayload): VersionedImportPayload {
  return {
    version: BACKUP_VERSION,
    data: {
      ...payload.data,
      cheki_manual_entries: payload.data.cheki_manual_entries ?? [],
      important_dates: payload.data.important_dates ?? [],
      important_date_artists: payload.data.important_date_artists ?? [],
      important_date_anniversary_rules: payload.data.important_date_anniversary_rules ?? [],
      scheduled_reminder_state: payload.data.scheduled_reminder_state ?? [],
    },
  };
}

function normalizeImportPayload(parsed: unknown): VersionedImportPayload | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const candidate = parsed as { version?: unknown; data?: unknown };
  if (typeof candidate.version !== 'number' || !candidate.data || typeof candidate.data !== 'object') {
    return null;
  }

  switch (candidate.version) {
    case 1:
      return upgradeBackupDataV1ToCurrent({
        version: candidate.version,
        data: candidate.data as ImportDataShape,
      });
    case 2:
      return upgradeBackupDataV2ToCurrent({
        version: candidate.version,
        data: candidate.data as ImportDataShape,
      });
    case 3:
      return {
        version: BACKUP_VERSION,
        data: {
          ...(candidate.data as ImportDataShape),
          important_dates: (candidate.data as ImportDataShape).important_dates ?? [],
          important_date_artists: (candidate.data as ImportDataShape).important_date_artists ?? [],
          important_date_anniversary_rules: (candidate.data as ImportDataShape).important_date_anniversary_rules ?? [],
          scheduled_reminder_state: (candidate.data as ImportDataShape).scheduled_reminder_state ?? [],
        },
      };
    case 4:
      return {
        version: BACKUP_VERSION,
        data: candidate.data as ImportDataShape,
      };
    case 5:
      return {
        version: BACKUP_VERSION,
        data: candidate.data as ImportDataShape,
      };
    case 6:
      return {
        version: candidate.version,
        data: candidate.data as ImportDataShape,
      };
    default:
      return null;
  }
}

async function importZipBackup(db: Repositories, file: File): Promise<boolean> {
  const cachedZip = await copyPickedBackupToCache(file);
  const extractDir = createUniqueDirectory(Paths.cache.uri, `ota_backup_import_${Date.now()}`);

  try {
    await unzip(cachedZip.uri, extractDir.uri);

    const manifestFile = new File(extractDir, 'manifest.json');
    const backupFile = new File(extractDir, 'backup.json');
    const manifestExists = pathExists(manifestFile);
    const backupExists = pathExists(backupFile);
    if (!manifestExists || !backupExists) {
      Alert.alert('无法打开', '备份文件缺少必要的数据');
      return false;
    }

    const manifest = JSON.parse(await manifestFile.text()) as FullBackupManifest;
    const manifestMediaFiles = Array.isArray(manifest.media_files) ? manifest.media_files : [];
    if (
      manifest.format !== FULL_BACKUP_MANIFEST_FORMAT
      || typeof manifest.version !== 'number'
      || !manifest.files
      || typeof manifest.files.media_dir !== 'string'
    ) {
      Alert.alert('无法打开', '备份格式错误');
      return false;
    }

    const payload = normalizeImportPayload(JSON.parse(await backupFile.text()));
    if (!payload) {
      Alert.alert('无法打开', '备份格式错误');
      return false;
    }
    const mediaDir = manifest.files.media_dir.endsWith('/')
      ? manifest.files.media_dir
      : `${manifest.files.media_dir}/`;
    const uriMap = new Map<string, string>();
    const missingMediaPaths: string[] = [];

    if (manifestMediaFiles.length > 0) {
      for (const mediaFile of manifestMediaFiles) {
        assertSafeRelativePath(mediaFile.archive_path);
        const mediaEntry = new File(appendPath(extractDir.uri, mediaFile.archive_path));
        if (!pathExists(mediaEntry)) {
          missingMediaPaths.push(mediaFile.archive_path);
          continue;
        }
        const restoredUri = await copyMediaFileToDocuments(mediaFile.filename, mediaEntry);
        uriMap.set(mediaFile.original_uri, restoredUri);
      }

      if (missingMediaPaths.length > 0) {
        throw new Error(`备份缺少 ${missingMediaPaths.length} 个图片文件`);
      }
    } else {
      const mediaUris = collectBackupMediaUrisFromData(payload.data);
      for (const originalUri of mediaUris) {
        const sourceName = sanitizeFilename(new File(String(originalUri)).name || 'media', 'media');
        const archivePath = `${mediaDir}${sourceName}`;
        assertSafeRelativePath(archivePath);
        const mediaEntry = new File(appendPath(extractDir.uri, archivePath));
        if (!pathExists(mediaEntry)) continue;
        const restoredUri = await copyMediaFileToDocuments(sourceName, mediaEntry);
        uriMap.set(originalUri, restoredUri);
      }
    }

    const unmappedLocalMediaUris = collectBackupMediaUrisFromData(payload.data)
      .filter((uri) => !uriMap.has(uri));
    if (unmappedLocalMediaUris.length > 0) {
      throw new Error(`备份缺少 ${unmappedLocalMediaUris.length} 个图片文件`);
    }

    const restoredData: ImportDataShape = {
      artists: replaceMediaUris(
        replaceMediaUris(payload.data.artists as unknown as Row[] | undefined, 'avatar_uri', uriMap),
        'background_uri',
        uriMap,
      ),
      trips: (payload.data.trips as unknown as Row[] | undefined) ?? [],
      events: (payload.data.events as unknown as Row[] | undefined) ?? [],
      event_sessions: (payload.data.event_sessions as unknown as Row[] | undefined) ?? [],
      event_timetable_entries: (payload.data.event_timetable_entries as unknown as Row[] | undefined) ?? [],
      event_artists: payload.data.event_artists,
      expenses: (payload.data.expenses as unknown as Row[] | undefined) ?? [],
      cheki: replaceMediaUris(payload.data.cheki as unknown as Row[] | undefined, 'photo_uri', uriMap),
      cheki_manual_entries: (payload.data.cheki_manual_entries as unknown as Row[] | undefined) ?? [],
      cheki_records: (payload.data.cheki_records as unknown as Row[] | undefined) ?? [],
      cheki_items: (payload.data.cheki_items as unknown as Row[] | undefined) ?? [],
      cheki_item_images: replaceMediaUris(
        payload.data.cheki_item_images as unknown as Row[] | undefined,
        'photo_uri',
        uriMap,
      ),
      photos: replaceMediaUris(payload.data.photos as unknown as Row[] | undefined, 'local_uri', uriMap),
      user_config: typeof payload.data.user_config?.avatar_uri === 'string'
        ? {
            ...(payload.data.user_config as unknown as Row),
            avatar_uri: uriMap.get(payload.data.user_config.avatar_uri) ?? payload.data.user_config.avatar_uri,
          }
        : (payload.data.user_config as unknown as Row),
      important_dates: (payload.data.important_dates as unknown as Row[] | undefined) ?? [],
      important_date_artists: payload.data.important_date_artists,
      important_date_anniversary_rules: (payload.data.important_date_anniversary_rules as unknown as Row[] | undefined) ?? [],
      scheduled_reminder_state: (payload.data.scheduled_reminder_state as unknown as Row[] | undefined) ?? [],
    };

    await restoreBackupData(db, restoredData);
    return true;
  } finally {
    deleteFileQuietly(cachedZip);
    deleteDirectoryQuietly(extractDir);
  }
}

export async function exportFullBackup(db: Repositories): Promise<{
  filename: string;
  destinationUri: string;
  mediaCount: number;
}>;
export async function exportFullBackup(
  db: Repositories,
  options: ExportFullBackupOptions,
): Promise<{
  filename: string;
  destinationUri: string;
  mediaCount: number;
}>;
export async function exportFullBackup(
  db: Repositories,
  options?: ExportFullBackupOptions,
): Promise<{
  filename: string;
  destinationUri: string;
  mediaCount: number;
}> {
  const now = new Date();
  const reportProgress = (progress: number) => {
    options?.onProgress?.(clampProgress(progress));
  };
  reportProgress(2);
  cleanupHistoricCacheBackups();

  const presetMedia = await materializePresetArtistAvatars(db.rawDb);
  if (presetMedia.unresolved > 0) {
    throw new Error(`有 ${presetMedia.unresolved} 个旧版内置艺人头像无法读取，未生成备份`);
  }

  const payload = await buildBackupPayload(db);
  reportProgress(8);

  const mediaUris = collectReferencedMediaUris(payload);
  reportProgress(12);

  const zip = new JSZip();
  const manifestMediaFiles: FullBackupManifest['media_files'] = [];

  zip.file('backup.json', JSON.stringify(payload, null, 2), { compression: 'DEFLATE' });
  reportProgress(16);
  zip.file('ota.db', await db.rawDb.serializeAsync(), { compression: 'DEFLATE' });
  reportProgress(22);

  let mediaCount = 0;
  const mediaTotal = mediaUris.length || 1;
  for (const [index, uri] of mediaUris.entries()) {
    const sourceFile = new File(uri);
    if (!(sourceFile as unknown as { exists?: boolean }).exists) continue;
    const safeName = sanitizeFilename(sourceFile.name || `media_${mediaCount + 1}`, `media_${mediaCount + 1}`);
    const archivePath = `media/${safeName}`;
    zip.file(archivePath, await sourceFile.bytes(), { compression: 'STORE' });
    manifestMediaFiles.push({
      original_uri: uri,
      archive_path: archivePath,
      filename: safeName,
    });
    mediaCount += 1;
    reportProgress(22 + ((index + 1) / mediaTotal) * 58);
    if ((index + 1) % EXPORT_YIELD_INTERVAL === 0) {
      await yieldToUI();
    }
  }

  await yieldToUI();
  zip.file('manifest.json', JSON.stringify({
    format: FULL_BACKUP_MANIFEST_FORMAT,
    version: BACKUP_VERSION,
    exported_at: payload.exported_at,
    note: '这个压缩包里放着你的活动记录和照片，可以留作备份，也可以拿来恢复。',
    files: {
      database: 'ota.db',
      data: 'backup.json',
      media_dir: 'media',
    },
    media_files: manifestMediaFiles,
  } satisfies FullBackupManifest, null, 2), { compression: 'DEFLATE' });
  reportProgress(ZIP_PROGRESS_START);
  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }, (metadata) => {
    const nextProgress = ZIP_PROGRESS_START + ((ZIP_PROGRESS_END - ZIP_PROGRESS_START) * metadata.percent) / 100;
    reportProgress(nextProgress);
  });
  reportProgress(ZIP_PROGRESS_END);

  const filename = `ota_log_backup_${now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_')}.zip`;
  const targetFile = await createUniqueFile(Paths.cache.uri, filename);
  targetFile.write(zipBytes);
  reportProgress(100);

  return {
    filename: targetFile.name,
    destinationUri: targetFile.uri,
    mediaCount,
  };
}

export async function shareBackupFile(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('保存失败，请稍后重试');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/zip',
    dialogTitle: '保存备份',
  });
}

export async function importBackup(db: Repositories): Promise<boolean> {
  const picked = await File.pickFileAsync({ mimeTypes: 'application/zip' });
  if (picked.canceled || !picked.result) {
    Alert.alert('没有选到文件');
    return false;
  }
  const pickedFile = picked.result;

  try {
    return await importZipBackup(db, pickedFile);
  } catch (error) {
    Alert.alert('恢复失败', getErrorMessage(error));
    return false;
  }
}

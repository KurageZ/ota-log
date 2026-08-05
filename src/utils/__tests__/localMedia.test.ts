import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../../db/schema';
import { createAsyncSQLiteAdapter } from '../../db/__tests__/fixtures/sqliteTestAdapter';
import { rebaseLegacyLocalMediaUris } from '../localMedia';

const CURRENT_DOCUMENT_URI =
  'file:///var/mobile/Containers/Data/Application/CURRENT/Documents/';
const mockExistingUris = new Set<string>();
const mockThrowingUris = new Set<string>();

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    name: string;
    size = 1024;
    exists: boolean;

    constructor(base: string | { uri: string }, ...parts: string[]) {
      const baseUri = typeof base === 'string' ? base : base.uri;
      this.uri = parts.length > 0
        ? `${baseUri.replace(/\/$/, '')}/${parts.join('/')}`
        : baseUri;
      if (mockThrowingUris.has(this.uri)) throw new Error('Invalid file URI');
      this.name = this.uri.split('/').pop() ?? '';
      this.exists = mockExistingUris.has(this.uri);
    }

    delete() {}
  }

  return {
    Directory: class {},
    File: MockFile,
    Paths: {
      document: { uri: CURRENT_DOCUMENT_URI },
    },
  };
});

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
  return db;
}

describe('rebaseLegacyLocalMediaUris', () => {
  let db: Database.Database;

  beforeEach(() => {
    mockExistingUris.clear();
    mockThrowingUris.clear();
    db = createDatabase();
  });

  afterEach(() => {
    db.close();
  });

  test('rebases every managed media column after the iOS app container changes', async () => {
    const oldBase =
      'file:///var/mobile/Containers/Data/Application/OLD/Documents/';
    const files = {
      event: 'photo_event.jpg',
      cheki: 'photo_cheki.jpg',
      avatar: 'weibo_avatar_artist.jpg',
      background: 'artist_bg_artist.jpg',
      profile: 'photo_profile.jpg',
    };

    for (const filename of Object.values(files)) {
      mockExistingUris.add(`${CURRENT_DOCUMENT_URI}${filename}`);
    }

    db.prepare(
      `INSERT INTO artists
       (id, name, avatar_uri, background_uri, is_favorite, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    ).run(
      'artist-1',
      'Artist',
      `${oldBase}${files.avatar}`,
      `${oldBase}${files.background}`,
      '2026-01-01T00:00:00.000Z',
    );
    db.prepare(
      'INSERT INTO photos (id, event_id, local_uri, created_at) VALUES (?, NULL, ?, ?)',
    ).run('photo-1', `${oldBase}${files.event}`, '2026-01-01T00:00:00.000Z');
    const now = '2026-01-01T00:00:00.000Z';
    db.prepare(
      `INSERT INTO cheki_records
       (id, quantity, created_at, updated_at)
       VALUES ('record-1', 1, ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO cheki_items
       (id, record_id, sort_order, created_at, updated_at)
       VALUES ('item-1', 'record-1', 0, ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO cheki_item_images
       (id, item_id, side, photo_uri, created_at, updated_at)
       VALUES ('image-1', 'item-1', 'back', ?, ?, ?)`,
    ).run(`${oldBase}${files.cheki}`, now, now);
    db.prepare(
      `INSERT INTO user_config (id, name, avatar_uri, avatar_emoji, updated_at)
       VALUES ('default', 'Otaku', ?, '🎤', ?)`,
    ).run(`${oldBase}${files.profile}`, '2026-01-01T00:00:00.000Z');

    const result = await rebaseLegacyLocalMediaUris(createAsyncSQLiteAdapter(db));

    expect(result).toEqual({ scanned: 5, updated: 5, missing: 0 });
    expect(db.prepare('SELECT avatar_uri, background_uri FROM artists').get()).toEqual({
      avatar_uri: `${CURRENT_DOCUMENT_URI}${files.avatar}`,
      background_uri: `${CURRENT_DOCUMENT_URI}${files.background}`,
    });
    expect(db.prepare('SELECT local_uri FROM photos').get()).toEqual({
      local_uri: `${CURRENT_DOCUMENT_URI}${files.event}`,
    });
    expect(db.prepare('SELECT photo_uri FROM cheki_item_images').get()).toEqual({
      photo_uri: `${CURRENT_DOCUMENT_URI}${files.cheki}`,
    });
    expect(db.prepare('SELECT avatar_uri FROM user_config').get()).toEqual({
      avatar_uri: `${CURRENT_DOCUMENT_URI}${files.profile}`,
    });
  });

  test('leaves current, remote, preset, missing, and invalid local URIs unchanged', async () => {
    const missing =
      'file:///var/mobile/Containers/Data/Application/OLD/Documents/photo_missing.jpg';
    const invalid =
      'file:///var/mobile/Containers/Data/Application/OLD/Documents/photo_invalid.jpg';
    mockExistingUris.add(`${CURRENT_DOCUMENT_URI}photo_current.jpg`);
    mockThrowingUris.add(`${CURRENT_DOCUMENT_URI}photo_invalid.jpg`);

    const values = [
      `${CURRENT_DOCUMENT_URI}photo_current.jpg`,
      'https://example.com/avatar.jpg',
      'preset://artist/avatar',
      missing,
      invalid,
    ];
    for (const [index, uri] of values.entries()) {
      db.prepare(
        `INSERT INTO artists (id, name, avatar_uri, is_favorite, created_at)
         VALUES (?, ?, ?, 0, ?)`,
      ).run(`artist-${index}`, `Artist ${index}`, uri, '2026-01-01T00:00:00.000Z');
    }

    const result = await rebaseLegacyLocalMediaUris(createAsyncSQLiteAdapter(db));

    expect(result).toEqual({ scanned: 2, updated: 0, missing: 2 });
    expect(
      db.prepare('SELECT avatar_uri FROM artists ORDER BY id')
        .all()
        .map((row) => (row as { avatar_uri: string }).avatar_uri),
    ).toEqual(values);
  });
});

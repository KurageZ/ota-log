import Database from 'better-sqlite3';
import { Alert } from 'react-native';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { restoreBackupData } from '../../utils/backup';
import { scanUnreferencedLocalMedia } from '../../utils/localMedia';
import { Repositories } from '../../context/DBContext';

const DOC_URI = 'file:///documents/';

jest.mock('expo-crypto', () => ({
  randomUUID: () => '20000000-0000-4000-8000-000000000001',
}));

jest.mock('expo-file-system', () => {
  const files: Array<{ uri: string; name: string }> = [];
  const throwingUris = new Set<string>();

  class MockFile {
    uri: string;
    name: string;
    size = 1024;
    exists = true;

    constructor(base: string | { uri: string }, ...parts: string[]) {
      const baseUri = typeof base === 'string' ? base : base.uri;
      this.uri = parts.length > 0
        ? `${baseUri.replace(/\/$/, '')}/${parts.join('/')}`
        : baseUri;
      this.name = this.uri.split('/').pop() ?? '';
    }

    delete() {
      if (throwingUris.has(this.uri)) throw new Error('delete failed');
      const index = files.findIndex((entry) => entry.uri === this.uri);
      if (index >= 0) files.splice(index, 1);
    }
  }

  return {
    Directory: class MockDirectory {
      constructor(_base?: string | { uri: string }) {}
      list(): MockFile[] {
        return files.map((entry) => new MockFile(entry.uri) as unknown as MockFile);
      }
    },
    File: MockFile,
    Paths: {
      document: { uri: DOC_URI },
      cache: { uri: 'file:///cache/' },
    },
    __getFiles: () => files,
    __addFile: (uri: string) => {
      files.push({ uri, name: uri.split('/').pop() ?? uri });
    },
    __setThrowing: (uri: string) => {
      throwingUris.add(uri);
    },
  };
});

type MockedFileSystem = {
  __getFiles: () => Array<{ uri: string; name: string }>;
  __addFile: (uri: string) => void;
  __setThrowing: (uri: string) => void;
};

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

jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
  return db;
}

describe('full backup restore media cleanup', () => {
  const NOW = '2026-09-01T00:00:00.000Z';
  let rawDb: Database.Database;

  beforeEach(() => {
    const mockFs = jest.requireMock('expo-file-system') as unknown as MockedFileSystem;
    mockFs.__getFiles().length = 0;
    rawDb = createDatabase();
  });

  afterEach(() => {
    rawDb.close();
    const mockFs = jest.requireMock('expo-file-system') as unknown as MockedFileSystem;
    mockFs.__getFiles().length = 0;
  });

  function repositories(): Repositories {
    const asyncDb = createAsyncSQLiteAdapter(rawDb);
    const rawDbAdapter = {
      ...asyncDb,
      withTransactionAsync: async (callback: () => Promise<void>) => callback(),
      serializeAsync: async () => new Uint8Array(),
    };
    return { rawDb: rawDbAdapter as Repositories['rawDb'] } as unknown as Repositories;
  }

  test('removes superseded files after a successful restore and keeps still-referenced files', async () => {
    const mockFs = jest.requireMock('expo-file-system') as unknown as MockedFileSystem;
    const oldAvatar = `${DOC_URI}artist_avatar_old.jpg`;
    const oldShared = `${DOC_URI}artist_avatar_shared.jpg`;
    const oldPhoto = `${DOC_URI}photo_old.jpg`;
    const newAvatar = `${DOC_URI}artist_avatar_new.jpg`;
    for (const uri of [oldAvatar, oldShared, oldPhoto, newAvatar]) mockFs.__addFile(uri);

    rawDb.prepare(
      `INSERT INTO artists (id, name, avatar_uri, is_favorite, created_at)
       VALUES ('a1', 'A', ?, 0, ?)`,
    ).run(oldAvatar, NOW);
    rawDb.prepare(
      `INSERT INTO artists (id, name, avatar_uri, is_favorite, created_at)
       VALUES ('a2', 'B', ?, 0, ?)`,
    ).run(oldShared, NOW);
    rawDb.prepare(
      'INSERT INTO photos (id, event_id, local_uri, created_at) VALUES (?, NULL, ?, ?)',
    ).run('p1', oldPhoto, NOW);

    // The restore replaces all rows: a1 gets a freshly copied avatar, a2 keeps
    // its shared file (still referenced after the restore), p1 disappears.
    await restoreBackupData(repositories(), {
      artists: [
        {
          id: 'a1',
          name: 'A',
          avatar_uri: newAvatar,
          is_favorite: 0,
          created_at: NOW,
        },
        {
          id: 'a2',
          name: 'B',
          avatar_uri: oldShared,
          is_favorite: 0,
          created_at: NOW,
        },
      ],
    });

    const remaining = mockFs.__getFiles().map((entry) => entry.uri);
    expect(remaining).toEqual(expect.arrayContaining([newAvatar, oldShared]));
    expect(remaining).not.toEqual(expect.arrayContaining([oldAvatar, oldPhoto]));
    expect(await scanUnreferencedLocalMedia(repositories().rawDb)).toEqual({
      scanned: 2,
      unused: 0,
      bytes: 0,
    });
  });

  test('keeps restore success when a cleanup deletion fails', async () => {
    const mockFs = jest.requireMock('expo-file-system') as unknown as MockedFileSystem;
    const oldAvatar = `${DOC_URI}artist_avatar_blocked.jpg`;
    const newAvatar = `${DOC_URI}artist_avatar_new.jpg`;
    mockFs.__addFile(oldAvatar);
    mockFs.__addFile(newAvatar);
    mockFs.__setThrowing(oldAvatar);

    rawDb.prepare(
      `INSERT INTO artists (id, name, avatar_uri, is_favorite, created_at)
       VALUES ('a1', 'A', ?, 0, ?)`,
    ).run(oldAvatar, NOW);

    await expect(restoreBackupData(repositories(), {
      artists: [{
        id: 'a1',
        name: 'A',
        avatar_uri: newAvatar,
        is_favorite: 0,
        created_at: NOW,
      }],
    })).resolves.toBeUndefined();

    const artist = rawDb.prepare('SELECT avatar_uri FROM artists WHERE id = ?')
      .get('a1') as { avatar_uri: string };
    expect(artist.avatar_uri).toBe(newAvatar);
    // Best-effort cleanup: the blocked old file is simply left behind.
    expect(mockFs.__getFiles().map((entry) => entry.uri))
      .toEqual(expect.arrayContaining([oldAvatar, newAvatar]));
  });
});

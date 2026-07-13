import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';
import { ArtistRepository } from '../../repositories/ArtistRepository';
import { deleteLocalFileIfUnreferenced as mockDeleteLocalFileIfUnreferenced } from '../../utils/localMedia';

jest.mock('../../utils/uuid', () => ({
  generateId: jest.fn(() => 'generated-artist-id'),
}));

jest.mock('../../utils/localMedia', () => ({
  deleteLocalFileIfUnreferenced: jest.fn(async () => true),
}));

const mockedDeleteLocalFileIfUnreferenced = mockDeleteLocalFileIfUnreferenced as jest.MockedFunction<typeof mockDeleteLocalFileIfUnreferenced>;

describe('ArtistRepository artist media metadata support', () => {
  let rawDb: Database.Database;
  let artistRepository: ArtistRepository;

  beforeEach(() => {
    rawDb = new Database(':memory:');
    rawDb.exec('PRAGMA foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) {
      rawDb.exec(statement);
    }

    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-1',
      'Artist One',
      null,
      null,
      'file:///artist-avatar-old.jpg',
      'file:///artist-bg-old.jpg',
      '#5f4b8b',
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-member-old',
      'Artist Member Old',
      null,
      'artist-1',
      null,
      null,
      null,
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-member-keep',
      'Artist Member Keep',
      null,
      'artist-1',
      null,
      null,
      null,
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-member-new',
      'Artist Member New',
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );

    artistRepository = new ArtistRepository(createAsyncSQLiteAdapter(rawDb));
    mockedDeleteLocalFileIfUnreferenced.mockClear();
  });

  afterEach(() => {
    rawDb.close();
  });

  test('create persists background_uri and background_color', async () => {
    const artist = await artistRepository.create({
      name: 'Artist Two',
      avatar_uri: 'file:///artist-avatar-new.jpg',
      background_uri: 'file:///artist-bg-new.jpg',
      background_color: '#7a4fb0',
    });

    expect(artist).toMatchObject({
      id: 'generated-artist-id',
      background_uri: 'file:///artist-bg-new.jpg',
      background_color: '#7a4fb0',
    });
    expect(
      rawDb.prepare('SELECT background_uri, background_color FROM artists WHERE id = ?').get('generated-artist-id')
    ).toEqual({
      background_uri: 'file:///artist-bg-new.jpg',
      background_color: '#7a4fb0',
    });
  });

  test('update replaces background_uri, persists background_color, and cleans up the previous file', async () => {
    await artistRepository.update('artist-1', {
      background_uri: 'file:///artist-bg-next.jpg',
      background_color: '#4b5574',
    });

    expect(
      rawDb.prepare('SELECT background_uri, background_color FROM artists WHERE id = ?').get('artist-1')
    ).toEqual({
      background_uri: 'file:///artist-bg-next.jpg',
      background_color: '#4b5574',
    });
    expect(mockedDeleteLocalFileIfUnreferenced).toHaveBeenCalledWith(
      expect.anything(),
      'file:///artist-bg-old.jpg',
    );
  });

  test('update only cleans up media fields that were actually changed', async () => {
    await artistRepository.update('artist-1', {
      avatar_uri: 'file:///artist-avatar-next.jpg',
    });

    expect(
      rawDb.prepare('SELECT avatar_uri, background_uri, background_color FROM artists WHERE id = ?').get('artist-1')
    ).toEqual({
      avatar_uri: 'file:///artist-avatar-next.jpg',
      background_uri: 'file:///artist-bg-old.jpg',
      background_color: '#5f4b8b',
    });
    expect(mockedDeleteLocalFileIfUnreferenced).toHaveBeenCalledWith(
      expect.anything(),
      'file:///artist-avatar-old.jpg',
    );
    expect(mockedDeleteLocalFileIfUnreferenced).not.toHaveBeenCalledWith(
      expect.anything(),
      'file:///artist-bg-old.jpg',
    );
  });

  test('delete cleans up avatar and background files', async () => {
    await artistRepository.delete('artist-1');

    expect(
      rawDb.prepare('SELECT COUNT(*) FROM artists WHERE id = ?').pluck().get('artist-1')
    ).toBe(0);
    expect(mockedDeleteLocalFileIfUnreferenced).toHaveBeenCalledWith(expect.anything(), 'file:///artist-avatar-old.jpg');
    expect(mockedDeleteLocalFileIfUnreferenced).toHaveBeenCalledWith(expect.anything(), 'file:///artist-bg-old.jpg');
  });

  test('restore-shaped writes keep background_color round-trippable', async () => {
    await artistRepository.update('artist-1', {
      background_color: '#6d7288',
    });

    expect(
      rawDb.prepare('SELECT background_color FROM artists WHERE id = ?').pluck().get('artist-1')
    ).toBe('#6d7288');
  });

  test('setMembers reassigns selected members and clears deselected ones', async () => {
    await artistRepository.setMembers('artist-1', ['artist-member-keep', 'artist-member-new', 'artist-1', 'artist-member-new']);

    expect(
      rawDb.prepare('SELECT parent_id FROM artists WHERE id = ?').pluck().get('artist-member-old')
    ).toBeNull();
    expect(
      rawDb.prepare('SELECT parent_id FROM artists WHERE id = ?').pluck().get('artist-member-keep')
    ).toBe('artist-1');
    expect(
      rawDb.prepare('SELECT parent_id FROM artists WHERE id = ?').pluck().get('artist-member-new')
    ).toBe('artist-1');
    expect(
      rawDb.prepare('SELECT parent_id FROM artists WHERE id = ?').pluck().get('artist-1')
    ).toBeNull();
  });
});

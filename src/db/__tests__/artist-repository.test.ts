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
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
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
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-member-old',
      'Artist Member Old',
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'artist-member-keep',
      'Artist Member Keep',
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      '2026-01-01T00:00:00.000Z',
    );
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
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
    rawDb.prepare(`INSERT INTO artist_basic_affiliations
      (member_artist_id, parent_artist_id, created_at, updated_at)
      VALUES (?, ?, ?, ?), (?, ?, ?, ?)`
    ).run(
      'artist-member-old', 'artist-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
      'artist-member-keep', 'artist-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
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

  test('create persists is_favorite when provided', async () => {
    const artist = await artistRepository.create({
      name: 'Favorite Artist',
      is_favorite: 1,
    });

    expect(
      rawDb.prepare('SELECT is_favorite FROM artists WHERE id = ?').pluck().get('generated-artist-id')
    ).toBe(1);
    expect(artist.is_favorite).toBe(1);
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

  test('delete preserves avatar and background files', async () => {
    await artistRepository.delete('artist-1');

    expect(
      rawDb.prepare('SELECT COUNT(*) FROM artists WHERE id = ?').pluck().get('artist-1')
    ).toBe(0);
    expect(mockedDeleteLocalFileIfUnreferenced).not.toHaveBeenCalled();
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
      rawDb.prepare('SELECT parent_artist_id FROM artist_basic_affiliations WHERE member_artist_id = ?').pluck().get('artist-member-old')
    ).toBeUndefined();
    expect(
      rawDb.prepare('SELECT parent_artist_id FROM artist_basic_affiliations WHERE member_artist_id = ?').pluck().get('artist-member-keep')
    ).toBe('artist-1');
    expect(
      rawDb.prepare('SELECT parent_artist_id FROM artist_basic_affiliations WHERE member_artist_id = ?').pluck().get('artist-member-new')
    ).toBe('artist-1');
    expect(
      rawDb.prepare('SELECT parent_artist_id FROM artist_basic_affiliations WHERE member_artist_id = ?').pluck().get('artist-1')
    ).toBeUndefined();
  });

  test('findCurrentMembers selects members valid on the activity date, including date boundaries', async () => {
    rawDb.prepare("INSERT INTO artists (id, name, artist_type, created_at) VALUES ('event-group', 'Event Group', 'group', '2026-01-01')").run();
    const insertPerson = rawDb.prepare("INSERT INTO artists (id, name, artist_type, created_at) VALUES (?, ?, 'person', '2026-01-01')");
    insertPerson.run('event-member-old', 'Old');
    insertPerson.run('event-member-keep', 'Active');
    insertPerson.run('event-member-new', 'New');
    const insert = rawDb.prepare(`INSERT INTO artist_group_memberships
      (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, 'event-group', ?, ?, '2026-01-01', '2026-01-01')`);
    insert.run('old-membership', 'event-member-old', null, '2026-10-08');
    insert.run('active-membership', 'event-member-keep', '2026-10-09', '2026-10-09');
    insert.run('future-membership', 'event-member-new', '2026-10-10', null);
    expect((await artistRepository.findCurrentMembers('event-group', '2026-10-09')).map((artist) => artist.id))
      .toEqual(['event-member-keep']);
    expect((await artistRepository.findCurrentMembers('event-group', '2026-10-08')).map((artist) => artist.id))
      .toEqual(['event-member-old']);
    expect((await artistRepository.findCurrentMembers('event-group', '2026-10-10')).map((artist) => artist.id))
      .toEqual(['event-member-new']);
  });

  test('findAll falls back to current memberships for parent_id', async () => {
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('member-only', 'Member Only', null, 'person', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('group-only', 'Group Only', null, 'group', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artist_group_memberships
        (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
    ).run(
      'membership-1', 'member-only', 'group-only',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
    );

    const artists = await artistRepository.findAll('2026-06-01');
    const byId = new Map(artists.map((artist) => [artist.id, artist]));

    // 无 basic affiliation 时，parent_id 取当前 membership 的团体
    expect(byId.get('member-only')?.parent_id).toBe('group-only');
    // 有 basic affiliation 时仍以 basic affiliation 为准
    expect(byId.get('artist-member-old')?.parent_id).toBe('artist-1');
  });

  test('findAll ignores expired memberships when resolving parent_id', async () => {
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('member-only', 'Member Only', null, 'person', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('group-only', 'Group Only', null, 'group', null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    rawDb.prepare(
      `INSERT INTO artist_group_memberships
        (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'membership-expired', 'member-only', 'group-only',
      '2026-01-01', '2026-02-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
    );

    const artists = await artistRepository.findAll('2026-06-01');
    expect(artists.find((artist) => artist.id === 'member-only')?.parent_id).toBeNull();
  });

  test('infers members as people and their direct parent as a group', async () => {
    const inferred = await artistRepository.inferTypeConversion();

    expect(inferred).toEqual({
      decisions: {
        'artist-member-old': 'person',
        'artist-member-keep': 'person',
        'artist-1': 'group',
      },
      personCount: 2,
      groupCount: 1,
      membershipCount: 2,
      skippedArtistCount: 0,
    });
    expect(inferred.decisions['artist-member-new']).toBeUndefined();
  });

  test('returns direct activity counts for conversion priority', async () => {
    rawDb.prepare(
      `INSERT INTO events (id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
    ).run(
      'event-a', 'Event A', 'completed', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
      'event-b', 'Event B', 'planned', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z',
    );
    rawDb.prepare(
      `INSERT INTO event_artists (event_id, artist_id, sort_order)
       VALUES (?, ?, ?), (?, ?, ?)`,
    ).run('event-a', 'artist-member-old', 0, 'event-b', 'artist-member-old', 0);

    await expect(artistRepository.findDirectActivityCounts()).resolves.toEqual({
      'artist-member-old': 2,
    });
  });

  test('skips an entire multi-level affiliation component', async () => {
    rawDb.prepare(
      `INSERT INTO artist_basic_affiliations
        (member_artist_id, parent_artist_id, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
    ).run(
      'artist-member-new', 'artist-member-old',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
    );

    const inferred = await artistRepository.inferTypeConversion();

    expect(inferred.decisions).toEqual({});
    expect(inferred.membershipCount).toBe(0);
    expect(inferred.skippedArtistCount).toBe(4);
  });

  test('findCurrentGroupmates returns current members of the same current groups, deduped and excluding the person', async () => {
    for (const [id, name, type] of [
      ['self', 'Self', 'person'],
      ['group-a', 'Group A', 'group'],
      ['group-b', 'Group B', 'group'],
      ['mate-a', 'Mate A', 'person'],
      ['mate-shared', 'Mate Shared', 'person'],
      ['mate-past', 'Mate Past', 'person'],
      ['mate-other', 'Mate Other', 'person'],
    ] as const) {
      rawDb.prepare(
        `INSERT INTO artists (id, name, short_name, artist_type, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, name, null, type, null, null, null, null, 0, '2026-01-01T00:00:00.000Z');
    }
    const insertMembership = (
      id: string,
      personId: string,
      groupId: string,
      start: string | null,
      end: string | null,
    ) => {
      rawDb.prepare(
        `INSERT INTO artist_group_memberships
          (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, personId, groupId, start, end, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    };

    insertMembership('ms-self-a', 'self', 'group-a', null, null);
    insertMembership('ms-self-past-b', 'self', 'group-b', '2020-01-01', '2025-01-01');
    insertMembership('ms-mate-a', 'mate-a', 'group-a', null, null);
    insertMembership('ms-mate-shared-a', 'mate-shared', 'group-a', null, null);
    insertMembership('ms-mate-shared-b', 'mate-shared', 'group-b', null, null);
    insertMembership('ms-mate-past', 'mate-past', 'group-a', '2020-01-01', '2025-01-01');
    insertMembership('ms-mate-other-b', 'mate-other', 'group-b', null, null);

    const groupmates = await artistRepository.findCurrentGroupmates('self', '2026-06-01');

    // 只返回当前团体 group-a 的现役成员，跨团成员去重、排除本人；
    // 已毕业成员（mate-past）、仅属于本人已退出团体的成员（mate-other）不返回。
    expect(groupmates.map((artist) => artist.id)).toEqual(['mate-a', 'mate-shared']);
  });
});

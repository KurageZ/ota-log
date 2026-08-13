import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';

describe('Artist activity attribution', () => {
  let db: Database.Database;
  const now = '2026-01-01T00:00:00.000Z';

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
    const insertArtist = db.prepare(
      'INSERT INTO artists (id, name, artist_type, created_at) VALUES (?, ?, ?, ?)',
    );
    insertArtist.run('person', 'Person', 'person', now);
    insertArtist.run('group-a', 'Group A', 'group', now);
    insertArtist.run('group-b', 'Group B', 'group', now);
    insertArtist.run('unset', 'Unset', null, now);
    insertArtist.run('unset-parent', 'Unset Parent', null, now);
  });

  afterEach(() => db.close());

  function insertEvent(id: string, dates: Array<{ start: string; end?: string }>, artistIds: string[]) {
    db.prepare(`INSERT INTO events
      (id, title, event_type, status, created_at, updated_at)
      VALUES (?, ?, 'livehouse', 'completed', ?, ?)`).run(id, id, now, now);
    const insertSession = db.prepare(`INSERT INTO event_sessions
      (id, event_id, session_date, end_date, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    dates.forEach((date, index) => insertSession.run(
      `${id}-session-${index}`, id, date.start, date.end ?? null, index, now, now,
    ));
    const insertArtist = db.prepare(
      'INSERT INTO event_artists (event_id, artist_id, sort_order) VALUES (?, ?, ?)',
    );
    artistIds.forEach((artistId, index) => insertArtist.run(id, artistId, index));
  }

  test('keeps direct associations and attributes group events only across overlapping membership dates', () => {
    db.prepare(`INSERT INTO artist_group_memberships
      (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
      VALUES ('membership', 'person', 'group-a', '2025-04-01', '2025-09-30', ?, ?)`).run(now, now);
    insertEvent('before', [{ start: '2025-03-31' }], ['group-a']);
    insertEvent('start-boundary', [{ start: '2025-04-01' }], ['group-a']);
    insertEvent('multi-session', [{ start: '2025-03-20' }, { start: '2025-06-01' }], ['group-a']);
    insertEvent('overnight', [{ start: '2025-03-31', end: '2025-04-01' }], ['group-a']);
    insertEvent('end-boundary', [{ start: '2025-09-30' }], ['group-a']);
    insertEvent('after', [{ start: '2025-10-01' }], ['group-a']);
    insertEvent('direct', [{ start: '2025-10-01' }], ['person']);
    insertEvent('unset-direct', [{ start: '2025-06-01' }], ['unset']);
    insertEvent('deduplicated', [{ start: '2025-06-01' }], ['person', 'group-a']);

    const rows = db.prepare(`SELECT event_id
      FROM event_artist_attributions
      WHERE artist_id = 'person'
      ORDER BY event_id`).pluck().all();
    expect(rows).toEqual([
      'deduplicated', 'direct', 'end-boundary', 'multi-session', 'overnight', 'start-boundary',
    ]);
    expect(db.prepare(`SELECT COUNT(*)
      FROM event_artist_attributions
      WHERE event_id = 'deduplicated' AND artist_id = 'person'`).pluck().get()).toBe(1);
    expect(db.prepare(`SELECT artist_id
      FROM event_artist_attributions
      WHERE event_id = 'unset-direct'`).pluck().all()).toEqual(['unset']);
  });

  test('ignores basic affiliations and never attributes person events back to groups', () => {
    db.prepare(`INSERT INTO artist_basic_affiliations
      (member_artist_id, parent_artist_id, created_at, updated_at)
      VALUES ('unset', 'unset-parent', ?, ?)`).run(now, now);
    insertEvent('basic-parent-event', [{ start: '2025-06-01' }], ['unset-parent']);
    insertEvent('person-event', [{ start: '2025-06-01' }], ['person']);

    expect(db.prepare(`SELECT event_id FROM event_artist_attributions WHERE artist_id = 'unset'`).all())
      .toEqual([]);
    expect(db.prepare(`SELECT event_id FROM event_artist_attributions WHERE artist_id = 'group-a'`).all())
      .toEqual([]);
  });
});

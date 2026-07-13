import { buildAnnouncementCaseFixture } from '../announcementCases';

describe('buildAnnouncementCaseFixture', () => {
  test('builds a draft fixture from current database rows', () => {
    const fixture = buildAnnouncementCaseFixture(
      [
        { id: 'artist-1', name: 'Artist One', short_name: 'A1' },
        { id: 'artist-2', name: 'Artist Two', short_name: null },
      ],
      [
        {
          id: 'event-older',
          title: 'Older Event',
          event_date: '2026-01-01',
          event_time: null,
          city: null,
          venue: null,
          ticket_price: null,
          details: ' older details ',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'event-latest',
          title: 'Latest Event',
          event_date: '2026-02-01',
          event_time: '18:30',
          city: '上海',
          venue: '新歌空间',
          ticket_price: 100,
          details: 'latest details',
          created_at: '2026-02-01T00:00:00.000Z',
        },
        {
          id: 'event-empty',
          title: 'Should be ignored',
          event_date: '2026-03-01',
          event_time: null,
          city: null,
          venue: null,
          ticket_price: null,
          details: '  ',
          created_at: '2026-03-01T00:00:00.000Z',
        },
      ],
      [
        { event_id: 'event-latest', artist_id: 'artist-2' },
        { event_id: 'event-latest', artist_id: 'artist-1' },
      ],
      new Date('2026-05-27T00:00:00.000Z'),
    );

    expect(fixture.draft).toBe(true);
    expect(fixture.artistCatalog).toEqual([
      { id: 'artist-1', name: 'Artist One', short_name: 'A1' },
      { id: 'artist-2', name: 'Artist Two', short_name: null },
    ]);
    expect(fixture.cases).toHaveLength(2);
    expect(fixture.cases.map((item) => item.id)).toEqual(['event-latest', 'event-older']);
    expect(fixture.cases[0]).toMatchObject({
      id: 'event-latest',
      referenceYear: 2026,
      rawText: 'latest details',
      baseline: {
        title: 'Latest Event',
        linkedArtistIds: ['artist-2', 'artist-1'],
        },
        expected: {
          parsed: {
            ticket_price: 100,
          },
        match: {
          matchedArtistIds: ['artist-2', 'artist-1'],
          unmatchedArtistNames: [],
        },
      },
    });
  });

  test('falls back to the current year when event_date is missing', () => {
    const fixture = buildAnnouncementCaseFixture(
      [{ id: 'artist-1', name: 'Artist One', short_name: null }],
      [
        {
          id: 'event-1',
          title: 'No Date Event',
          event_date: null,
          event_time: null,
          city: null,
          venue: null,
          ticket_price: null,
          details: 'details',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      [],
      new Date('2027-01-01T00:00:00.000Z'),
    );

    expect(fixture.cases[0].referenceYear).toBe(2027);
  });
});

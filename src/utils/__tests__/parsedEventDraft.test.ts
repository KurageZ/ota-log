import { buildParsedEventDraft } from '../parsedEventDraft';
import type { ParsedAnnouncement } from '../parseAnnouncement';

const baseParsed: ParsedAnnouncement = {
  title: '测试活动',
  event_date: '2026-05-30',
  event_time: '19:30',
  city: '上海',
  venue: '育音堂',
  artist: null,
  ticket_price: 80,
  artist_mentions: [],
};

describe('buildParsedEventDraft', () => {
  test('requests artist confirmation when parsed artists include unmatched names', () => {
    const result = buildParsedEventDraft(
      '公告正文',
      {
        ...baseParsed,
        artist_mentions: [
          { rawName: 'FixtureArtist040', source: 'lineup', order: 0 },
          { rawName: '全新艺人NewFace', source: 'mention', order: 1 },
        ],
      },
      [
        { id: 'artist-1', name: 'FixtureArtist040', short_name: null },
      ],
    );

    expect(result.shouldConfirmArtists).toBe(true);
    expect(result.matchedIds).toEqual(['artist-1']);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.rawName).toBe('全新艺人NewFace');
    expect(result.fields.title).toBe('测试活动');
    expect(result.fields.details).toBe('公告正文');
  });

  test('skips artist confirmation when all parsed artists are matched', () => {
    const result = buildParsedEventDraft(
      '公告正文',
      {
        ...baseParsed,
        artist_mentions: [
          { rawName: 'FixtureArtist040', source: 'lineup', order: 0 },
        ],
      },
      [
        { id: 'artist-1', name: 'FixtureArtist040', short_name: null },
      ],
    );

    expect(result.shouldConfirmArtists).toBe(false);
    expect(result.matchedIds).toEqual(['artist-1']);
    expect(result.candidates).toEqual([]);
  });

  test('requests confirmation for a unique low-confidence artist suggestion', () => {
    const result = buildParsedEventDraft(
      '公告正文',
      {
        ...baseParsed,
        artist_mentions: [
          { rawName: 'Nova', source: 'lineup', order: 0 },
        ],
      },
      [
        { id: 'artist-1', name: 'NovaLight', short_name: null },
      ],
    );

    expect(result.shouldConfirmArtists).toBe(true);
    expect(result.matchedIds).toEqual([]);
    expect(result.candidates[0]).toMatchObject({
      rawName: 'Nova',
      resolution: 'skip',
      suggestions: [{ artistId: 'artist-1', confidence: 'contains' }],
    });
  });

  test('does not treat public ticket price as the user actual expense', () => {
    const result = buildParsedEventDraft(
      '公告正文',
      {
        ...baseParsed,
        ticket_price: 0,
      },
      [],
    );

    expect(result.fields).not.toHaveProperty('actual_expense');
  });

  test('prefills opening, performance, and ending times without collapsing them', () => {
    const result = buildParsedEventDraft(
      'OPEN 17:30 START 18:30 END 20:00',
      {
        ...baseParsed,
        open_time: '17:30',
        start_time: '18:30',
        end_time: '20:00',
      },
      [],
    );

    expect(result.fields.sessions?.[0]).toMatchObject({
      session_date: '2026-05-30',
      open_time: '17:30',
      start_time: '18:30',
      end_time: '20:00',
    });
  });
});

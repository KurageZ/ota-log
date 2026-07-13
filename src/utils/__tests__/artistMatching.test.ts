import { matchArtistsFromMentions } from '../artistMatching';
import type { ArtistMention } from '../parseAnnouncement';

function mentions(...rawNames: string[]): ArtistMention[] {
  return rawNames.map((rawName, order) => ({ rawName, source: 'mention', order }));
}

describe('artist matching', () => {
  test('matches raw account handles after normalization and reports the match reason', () => {
    const result = matchArtistsFromMentions(
      mentions('FixtureArtist031_Official'),
      [{ id: 'artist-1', name: 'FixtureArtist031', short_name: null }],
    );

    expect(result.matchedIds).toEqual(['artist-1']);
    expect(result.matches).toEqual([
      {
        rawName: 'FixtureArtist031_Official',
        artistId: 'artist-1',
        confidence: 'alias-exact',
        matchedField: 'name',
      },
    ]);
  });

  test('deduplicates raw aliases only during matching', () => {
    const result = matchArtistsFromMentions(
      mentions('FixtureArtist011', 'fixtureartist011', 'FixtureArtist011_official'),
      [{ id: 'artist-1', name: 'FixtureArtist011', short_name: null }],
    );

    expect(result.matchedIds).toEqual(['artist-1']);
    expect(result.matches).toHaveLength(1);
    expect(result.candidates).toEqual([]);
  });

  test('returns common visual variants as confirmation suggestions', () => {
    const result = matchArtistsFromMentions(
      mentions('MoonИote', 'Starl1ne'),
      [
        { id: 'moon-note', name: 'MoonNote_Official', short_name: 'MoonNote' },
        { id: 'star-line', name: 'Starline_Official', short_name: 'Starline' },
      ],
    );

    expect(result.matchedIds).toEqual([]);
    expect(result.candidates.map((candidate) => ({
      rawName: candidate.rawName,
      resolution: candidate.resolution,
      suggestions: candidate.suggestions.map((suggestion) => suggestion.artistId),
    }))).toEqual([
      {
        rawName: 'MoonИote',
        resolution: 'skip',
        suggestions: ['moon-note'],
      },
      {
        rawName: 'Starl1ne',
        resolution: 'skip',
        suggestions: ['star-line'],
      },
    ]);
  });

  test('returns equal-score matches as suggestions instead of selecting the first artist', () => {
    const result = matchArtistsFromMentions(
      mentions('Nova'),
      [
        { id: 'artist-1', name: 'NovaLight', short_name: null },
        { id: 'artist-2', name: 'NovaWing', short_name: null },
      ],
    );

    expect(result.matchedIds).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].resolution).toBe('skip');
    expect(result.candidates[0].suggestions.map((item) => item.artistId)).toEqual([
      'artist-1',
      'artist-2',
    ]);
  });

  test('returns a unique contains match as a confirmation suggestion', () => {
    const result = matchArtistsFromMentions(
      mentions('Nova'),
      [{ id: 'artist-1', name: 'NovaLight', short_name: null }],
    );

    expect(result.matchedIds).toEqual([]);
    expect(result.candidates[0]).toMatchObject({
      rawName: 'Nova',
      resolution: 'skip',
      suggestions: [{ artistId: 'artist-1', confidence: 'contains' }],
    });
  });

  test('keeps event-specific artist inference in the matching pipeline', () => {
    const result = matchArtistsFromMentions(
      [],
      [
        { id: 'fixtureartist040', name: 'FixtureArtist040', short_name: null },
        { id: 'lapis', name: 'FixtureArtist023', short_name: null },
        { id: 'annyx', name: 'FixtureArtist030', short_name: null },
        { id: 'vortex', name: 'FixtureArtist011', short_name: null },
      ],
      { announcementText: '🌋【ultimatum game 】⛩️🌀💎' },
    );

    expect(result.matchedIds).toEqual(['fixtureartist040', 'lapis', 'annyx', 'vortex']);
  });

  test('keeps unmatched raw text for new artist confirmation', () => {
    const result = matchArtistsFromMentions(
      mentions('青星NewFace'),
      [],
    );

    expect(result.candidates[0]).toMatchObject({
      rawName: '青星NewFace',
      name: 'NewFace',
      short_name: '青星',
      editName: '青星NewFace',
      resolution: 'create',
      suggestions: [],
    });
  });
});

import type { ArtistCandidate } from '../artistMatching';
import {
  getArtistCandidatesForConfirmation,
  normalizeArtistConfirmationMode,
  selectAllArtistCandidates,
} from '../artistConfirmation';

const unmatched: ArtistCandidate = {
  rawName: 'New Face',
  name: 'New Face',
  short_name: null,
  editName: 'New Face',
  resolution: 'create',
  suggestions: [],
};

const possibleMatch: ArtistCandidate = {
  rawName: 'Nova',
  name: 'Nova',
  short_name: null,
  editName: 'Nova',
  resolution: 'artist-1',
  suggestions: [{
    artistId: 'artist-1',
    name: 'NovaLight',
    short_name: null,
    confidence: 'contains',
    matchedField: 'name',
  }],
};

describe('artist confirmation preferences', () => {
  test('shows every candidate unselected in the default mode', () => {
    expect(getArtistCandidatesForConfirmation([unmatched, possibleMatch], 'always'))
      .toEqual([
        { ...unmatched, resolution: 'skip' },
        { ...possibleMatch, resolution: 'skip' },
      ]);
  });

  test('only shows candidates with local artist suggestions in matches-only mode', () => {
    expect(getArtistCandidatesForConfirmation([unmatched, possibleMatch], 'matches_only'))
      .toEqual([{ ...possibleMatch, resolution: 'skip' }]);
  });

  test('skips confirmation in never mode and selects all visible candidates on request', () => {
    expect(getArtistCandidatesForConfirmation([unmatched, possibleMatch], 'never')).toEqual([]);
    expect(selectAllArtistCandidates([
      { ...unmatched, resolution: 'skip' },
      { ...possibleMatch, resolution: 'skip' },
    ])).toEqual([
      { ...unmatched, resolution: 'create' },
      { ...possibleMatch, resolution: 'create' },
    ]);
  });

  test('falls back to the default mode for missing or unknown stored values', () => {
    expect(normalizeArtistConfirmationMode(undefined)).toBe('always');
    expect(normalizeArtistConfirmationMode('unknown')).toBe('always');
    expect(normalizeArtistConfirmationMode('never')).toBe('never');
  });
});

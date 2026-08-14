import {
  buildEventDeepLinkState,
  cloneEventListFilters,
  countEventFilterCategories,
  EMPTY_EVENT_LIST_FILTERS,
} from '../eventFilters';

describe('eventFilters', () => {
  test('clones mutable filter values for draft editing', () => {
    const applied = cloneEventListFilters(EMPTY_EVENT_LIST_FILTERS);
    const draft = cloneEventListFilters(applied);
    draft.statuses.push('planned');
    draft.artistIds.push('artist-1');
    expect(applied.statuses).toEqual([]);
    expect(applied.artistIds).toEqual([]);
  });

  test('counts categories rather than values while counting content switches independently', () => {
    expect(countEventFilterCategories({
      ...cloneEventListFilters(EMPTY_EVENT_LIST_FILTERS),
      statuses: ['planned', 'completed'],
      artistIds: ['artist-1', 'artist-2'],
      hasNotes: true,
      hasCheki: true,
    })).toBe(4);
  });

  test('converts legacy deep-link filters and moves city / venue into keyword search', () => {
    const result = buildEventDeepLinkState({
      city: 'Tokyo',
      venue: 'Zepp',
      status: 'planned,completed',
      year: '2026',
      month: '2',
      scope: 'favorite',
      artist_id: 'artist-3',
      min_score: '4',
    }, {
      favoriteArtistIds: ['artist-1', 'artist-2'],
      oshiArtistId: 'artist-3',
      selectableArtistIds: ['artist-1', 'artist-3'],
    });

    expect(result.hasDeepLink).toBe(true);
    expect(result.keyword).toBe('Tokyo Zepp');
    expect(result.filters.date).toEqual({ mode: 'month', startDate: '2026-02-01', endDate: '2026-02-28' });
    expect(result.filters.statuses).toEqual(['planned', 'completed']);
    expect(result.filters.artistIds).toEqual(['artist-3', 'artist-1']);
    expect(result.filters.artistScope).toBe('favorite');
    expect(result.filters.minScore).toBe(4);
  });

  test('ignores a stats preset left behind after consuming status and date filters', () => {
    const result = buildEventDeepLinkState({
      preset: 'month',
    } as Parameters<typeof buildEventDeepLinkState>[0], {
      favoriteArtistIds: [],
      oshiArtistId: null,
      selectableArtistIds: [],
    });

    expect(result.hasDeepLink).toBe(false);
  });

  test('preserves an explicit deep-link artist outside the selectable candidates', () => {
    const result = buildEventDeepLinkState({ artist_id: 'artist-without-events' }, {
      favoriteArtistIds: [],
      oshiArtistId: null,
      selectableArtistIds: ['artist-with-events'],
    });

    expect(result.filters.artistIds).toEqual(['artist-without-events']);
    expect(countEventFilterCategories(result.filters)).toBe(1);
  });

  test.each(['favorite', 'oshi'] as const)('preserves an empty %s scope as an active filter', (scope) => {
    const result = buildEventDeepLinkState({ scope }, {
      favoriteArtistIds: [],
      oshiArtistId: null,
      selectableArtistIds: [],
    });

    expect(result.filters.artistIds).toEqual([]);
    expect(result.filters.artistScope).toBe(scope);
    expect(countEventFilterCategories(result.filters)).toBe(1);
  });
});

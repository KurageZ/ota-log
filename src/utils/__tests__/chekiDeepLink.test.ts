import {
  buildChekiDeepLinkState,
  createClearedChekiDeepLinkParams,
  getChekiDeepLinkSignature,
} from '../chekiDeepLink';

describe('buildChekiDeepLinkState', () => {
  it('applies shared stats filters to the previous album mode', () => {
    const result = buildChekiDeepLinkState({
      artist_id: 'artist-1',
      preset: 'custom',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    }, 'album');

    expect(result).toEqual({
      hasDeepLink: true,
      targetMode: 'album',
      filterAction: 'replace',
      filters: expect.objectContaining({
        artistIds: ['artist-1'],
        date: {
          mode: 'custom',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
      }),
    });
  });

  it('applies the same shared stats filters to the previous record mode', () => {
    const result = buildChekiDeepLinkState({
      artist_id: ['artist-1', 'artist-2,artist-1'],
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    }, 'record');

    expect(result).toEqual({
      hasDeepLink: true,
      targetMode: 'record',
      filterAction: 'replace',
      filters: expect.objectContaining({
        artistIds: ['artist-1', 'artist-2'],
        eventId: null,
        date: {
          mode: 'custom',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        },
      }),
    });
  });

  it('forces record mode for an exact event even when album was requested', () => {
    const result = buildChekiDeepLinkState({
      event_id: 'event-1',
      browse: 'album',
    }, 'album');

    expect(result).toEqual({
      hasDeepLink: true,
      targetMode: 'record',
      filterAction: 'replace',
      filters: expect.objectContaining({ eventId: 'event-1' }),
    });
  });

  it('honors an explicit mode when no mode-specific condition conflicts', () => {
    expect(buildChekiDeepLinkState({ browse: 'record' }, 'album')).toEqual({
      hasDeepLink: true,
      targetMode: 'record',
      filterAction: 'preserve',
    });
    expect(buildChekiDeepLinkState({ browse: 'album', date: '2026-08-14' }, 'record')).toEqual({
      hasDeepLink: true,
      targetMode: 'album',
      filterAction: 'replace',
      filters: expect.objectContaining({
        artistIds: [],
        date: { mode: 'day', startDate: '2026-08-14', endDate: '2026-08-14' },
      }),
    });
  });

  it('treats all-time as a date-only clear and ignores conflicting date params', () => {
    expect(buildChekiDeepLinkState({ preset: 'all' }, 'album')).toEqual({
      hasDeepLink: true,
      targetMode: 'album',
      filterAction: 'clearDate',
    });
    expect(buildChekiDeepLinkState({
      preset: 'all',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    }, 'record')).toEqual({
      hasDeepLink: true,
      targetMode: 'record',
      filterAction: 'clearDate',
    });
  });

  it('uses one route-key contract for signatures and consumed params', () => {
    const params = { artist_id: 'artist-1', browse: 'album' };
    expect(getChekiDeepLinkSignature(params)).not.toBe(getChekiDeepLinkSignature({ browse: 'album' }));
    expect(createClearedChekiDeepLinkParams()).toEqual({
      artist_id: '',
      event_id: '',
      year: '',
      month: '',
      date: '',
      startDate: '',
      endDate: '',
      preset: '',
      browse: '',
    });
  });

  it('ignores empty route parameters', () => {
    expect(buildChekiDeepLinkState({
      artist_id: '',
      event_id: '',
      startDate: '',
      endDate: '',
      preset: '',
      browse: '',
    }, 'record')).toEqual({
      hasDeepLink: false,
      targetMode: 'record',
    });
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT,
  HOME_PREFERENCES_STORAGE_KEY,
  MAX_FEATURED_ARTISTS_PER_HOME_CARD,
  MAX_RECENT_COMPLETED_DISPLAY_LIMIT,
  MIN_RECENT_COMPLETED_DISPLAY_LIMIT,
  RECENT_COMPLETED_DISPLAY_ALL,
  createDefaultHomePinnedInfo,
  createDefaultHomePreferences,
  createDefaultHomeCards,
  loadHomeCards,
  loadHomePreferences,
  sanitizeRecentCompletedDisplayLimit,
  sanitizeHomeCards,
  sanitizeHomePinnedInfo,
  sanitizeHomePreferences,
  saveHomeCards,
  saveHomePreferences,
} from '../homePreferences';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('homePreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates default cards with only future, recent completed, and cheki overview enabled', () => {
    expect(createDefaultHomeCards('oshi')).toEqual([
      { type: 'futureActivity', visible: true },
      { type: 'recentCompleted', visible: true, displayLimit: DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT },
      { type: 'chekiOverview', visible: true },
      { type: 'featuredArtist', visible: false, artistIds: ['oshi'] },
      { type: 'monthOverview', visible: false },
      { type: 'importantDates', visible: false, dateItemIds: [] },
    ]);
  });

  it('creates an unselected featured artist card when no oshi artist exists', () => {
    expect(createDefaultHomeCards(null).find((card) => card.type === 'featuredArtist')).toEqual({ type: 'featuredArtist', visible: false, artistIds: [] });
  });

  it('creates default preferences with next event pinned info', () => {
    expect(createDefaultHomePinnedInfo()).toEqual({ type: 'nextEvent' });
    expect(createDefaultHomePreferences('oshi')).toEqual({
      pinnedInfo: { type: 'nextEvent' },
      cards: createDefaultHomeCards('oshi'),
    });
  });

  it('falls back to default cards when stored JSON is invalid', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');

    const cards = await loadHomeCards({ oshiArtistId: 'oshi' });

    expect(cards).toEqual(createDefaultHomeCards('oshi'));
  });

  it('loads object-shaped preferences with pinned info', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
      pinnedInfo: { type: 'featuredArtist', artistId: 'kept' },
      cards: [
        { type: 'futureActivity', visible: true },
        { type: 'featuredArtist', artistIds: [] },
      ],
    }));

    const preferences = await loadHomePreferences({
      oshiArtistId: 'oshi',
      validArtistIds: new Set(['kept', 'oshi']),
    });

    expect(preferences.pinnedInfo).toEqual({ type: 'featuredArtist', artistId: 'kept' });
    expect(preferences.cards[1]).toEqual({ type: 'featuredArtist', visible: true, artistIds: ['oshi'] });
  });

  it('keeps old array-shaped preferences readable', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify([
      { type: 'futureActivity', visible: true },
      { type: 'monthOverview', visible: false },
    ]));

    const preferences = await loadHomePreferences();

    expect(preferences.pinnedInfo).toEqual({ type: 'nextEvent' });
    expect(preferences.cards.find((card) => card.type === 'monthOverview')).toEqual({ type: 'monthOverview', visible: false });
  });

  it('uses the oshi artist for an unselected stored featured artist card', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify([
      { type: 'futureActivity', visible: true },
      { type: 'featuredArtist', artistIds: [] },
    ]));

    const cards = await loadHomeCards({
      oshiArtistId: 'oshi',
      validArtistIds: new Set(['oshi']),
    });

    expect(cards[1]).toEqual({ type: 'featuredArtist', visible: true, artistIds: ['oshi'] });
  });

  it('adds future activity when it is missing', () => {
    const cards = sanitizeHomeCards([{ type: 'monthOverview', visible: true }]);

    expect(cards[0]).toEqual({ type: 'futureActivity', visible: true });
  });

  it('deduplicates singleton cards and preserves the first visibility value', () => {
    const cards = sanitizeHomeCards([
      { type: 'futureActivity', visible: true },
      { type: 'monthOverview', visible: false },
      { type: 'monthOverview', visible: true },
    ]);

    expect(cards.filter((card) => card.type === 'monthOverview')).toEqual([
      { type: 'monthOverview', visible: false },
    ]);
  });

  it('removes unknown card types', () => {
    const cards = sanitizeHomeCards([
      { type: 'futureActivity', visible: true },
      { type: 'unknownCard' },
      { type: 'recentCompleted', visible: true },
    ]);

    expect(cards.some((card) => (card as { type: string }).type === 'unknownCard')).toBe(false);
  });

  it('merges old featured artist cards into one card and filters artists that no longer exist', () => {
    const cards = sanitizeHomeCards(
      [
        { type: 'futureActivity', visible: true },
        { type: 'featuredArtist', artistId: 'kept' },
        { type: 'featuredArtist', artistId: 'also-kept' },
        { type: 'featuredArtist', artistId: 'deleted' },
      ],
      { validArtistIds: new Set(['kept', 'also-kept']) },
    );

    expect(cards.filter((card) => card.type === 'featuredArtist')).toEqual([
      { type: 'featuredArtist', visible: true, artistIds: ['kept', 'also-kept'] },
    ]);
  });

  it('keeps at most five featured artists in the featured artist card', () => {
    const cards = sanitizeHomeCards([
      { type: 'futureActivity', visible: true },
      { type: 'featuredArtist', artistIds: Array.from({ length: MAX_FEATURED_ARTISTS_PER_HOME_CARD + 2 }, (_, index) => `artist-${index}`) },
    ]);

    expect(cards.find((card) => card.type === 'featuredArtist')).toEqual({
      type: 'featuredArtist',
      visible: true,
      artistIds: Array.from({ length: MAX_FEATURED_ARTISTS_PER_HOME_CARD }, (_, index) => `artist-${index}`),
    });
  });

  it('deduplicates important dates without imposing a display limit', () => {
    const dateItemIds = Array.from({ length: 12 }, (_, index) => `date-${index}`);
    const cards = sanitizeHomeCards(
      [
        { type: 'futureActivity', visible: true },
        { type: 'importantDates', visible: true, dateItemIds: [...dateItemIds, 'date-1', 'deleted'] },
      ],
      { validDateItemIds: new Set(dateItemIds) },
    );

    expect(cards.find((card) => card.type === 'importantDates')).toEqual({
      type: 'importantDates',
      visible: true,
      dateItemIds,
    });
  });

  it('deduplicates singleton important dates cards and preserves the first one', () => {
    const cards = sanitizeHomeCards([
      { type: 'futureActivity', visible: true },
      { type: 'importantDates', visible: true, dateItemIds: ['date-1'] },
      { type: 'importantDates', visible: false, dateItemIds: ['date-2'] },
    ]);

    expect(cards.filter((card) => card.type === 'importantDates')).toEqual([
      { type: 'importantDates', visible: true, dateItemIds: ['date-1'] },
    ]);
  });

  it('sanitizes recent completed display limits', () => {
    expect(sanitizeRecentCompletedDisplayLimit(0)).toBe(MIN_RECENT_COMPLETED_DISPLAY_LIMIT);
    expect(sanitizeRecentCompletedDisplayLimit(999)).toBe(MAX_RECENT_COMPLETED_DISPLAY_LIMIT);
    expect(sanitizeRecentCompletedDisplayLimit(7.8)).toBe(7);
    expect(sanitizeRecentCompletedDisplayLimit(RECENT_COMPLETED_DISPLAY_ALL)).toBe(RECENT_COMPLETED_DISPLAY_ALL);
  });

  it('sanitizes pinned info and removes deleted pinned artists', () => {
    expect(sanitizeHomePinnedInfo({ type: 'monthSummary' })).toEqual({ type: 'monthSummary' });
    expect(sanitizeHomePinnedInfo(
      { type: 'featuredArtist', artistId: 'deleted' },
      { validArtistIds: new Set(['kept']) },
    )).toEqual({ type: 'featuredArtist', artistId: null });
    expect(sanitizeHomePinnedInfo({ type: 'unknown' })).toEqual({ type: 'nextEvent' });
  });

  it('sanitizes object-shaped preferences', () => {
    const preferences = sanitizeHomePreferences(
      {
        pinnedInfo: { type: 'featuredArtist', artistId: 'kept' },
        cards: [
          { type: 'futureActivity', visible: true },
          { type: 'featuredArtist', artistIds: ['kept'] },
          { type: 'unknownCard' },
        ],
      },
      { validArtistIds: new Set(['kept']) },
    );

    expect(preferences.pinnedInfo).toEqual({ type: 'featuredArtist', artistId: 'kept' });
    expect(preferences.cards.some((card) => (card as { type: string }).type === 'unknownCard')).toBe(false);
  });

  it('saves sanitized cards under the home preferences storage key', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
      pinnedInfo: { type: 'monthSummary' },
      cards: createDefaultHomeCards(),
    }));

    const cards = [
      { type: 'futureActivity', visible: true },
      { type: 'recentCompleted', visible: false, displayLimit: DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT },
    ] as const;

    await saveHomeCards([...cards]);

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      HOME_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        pinnedInfo: { type: 'monthSummary' },
        cards: sanitizeHomeCards(cards),
      }),
    );
  });

  it('saves sanitized preferences under the home preferences storage key', async () => {
    const preferences = {
      pinnedInfo: { type: 'featuredArtist', artistId: 'kept' },
      cards: [
        { type: 'futureActivity', visible: true },
        { type: 'recentCompleted', visible: false, displayLimit: DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT },
      ],
    } as const;

    await saveHomePreferences({
      pinnedInfo: preferences.pinnedInfo,
      cards: [...preferences.cards],
    });

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      HOME_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        pinnedInfo: preferences.pinnedInfo,
        cards: sanitizeHomeCards(preferences.cards),
      }),
    );
  });
});

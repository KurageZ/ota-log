import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STATS_PREFERENCES_STORAGE_KEY,
  STATS_SECTION_TYPES,
  createDefaultStatsPreferences,
  createDefaultStatsSections,
  getUnseenStatsSectionTypes,
  loadStatsPreferences,
  markStatsSectionsSeen,
  sanitizeStatsPreferences,
  saveStatsPreferences,
} from '../statsPreferences';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('statsPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the current layout with every section visible and seen', () => {
    expect(createDefaultStatsPreferences()).toEqual({
      sections: [
        { type: 'activity', visible: true },
        { type: 'oshi', visible: true },
        { type: 'spending', visible: true },
        { type: 'perfectEvents', visible: true },
        { type: 'cheki', visible: true },
      ],
      seenSectionTypes: [...STATS_SECTION_TYPES],
    });
  });

  it('uses the full default without new markers when storage is empty', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(null);

    const preferences = await loadStatsPreferences();

    expect(preferences.sections).toEqual(createDefaultStatsSections());
    expect(getUnseenStatsSectionTypes(preferences)).toEqual([]);
  });

  it('falls back to the full default when stored JSON is invalid', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');

    await expect(loadStatsPreferences()).resolves.toEqual(createDefaultStatsPreferences());
  });

  it('preserves order and visibility while removing duplicates and unknown types', () => {
    const preferences = sanitizeStatsPreferences({
      sections: [
        { type: 'cheki', visible: false },
        { type: 'activity', visible: true },
        { type: 'cheki', visible: true },
        { type: 'unknown', visible: true },
        { type: 'oshi', visible: false },
        { type: 'spending', visible: true },
        { type: 'perfectEvents', visible: true },
      ],
      seenSectionTypes: ['cheki', 'activity', 'unknown'],
    });

    expect(preferences.sections).toEqual([
      { type: 'cheki', visible: false },
      { type: 'activity', visible: true },
      { type: 'oshi', visible: false },
      { type: 'spending', visible: true },
      { type: 'perfectEvents', visible: true },
    ]);
    expect(preferences.seenSectionTypes).toEqual(STATS_SECTION_TYPES);
  });

  it('appends missing sections disabled and marks them unseen for an existing configuration', () => {
    const preferences = sanitizeStatsPreferences({
      sections: [
        { type: 'activity', visible: true },
        { type: 'oshi', visible: false },
        { type: 'spending', visible: true },
        { type: 'perfectEvents', visible: true },
      ],
      seenSectionTypes: ['activity', 'oshi', 'spending', 'perfectEvents'],
    });

    expect(preferences.sections.at(-1)).toEqual({ type: 'cheki', visible: false });
    expect(getUnseenStatsSectionTypes(preferences)).toEqual(['cheki']);
  });

  it('treats configured sections as seen when loading an older shape without seenSectionTypes', () => {
    const preferences = sanitizeStatsPreferences({
      sections: createDefaultStatsSections(),
    });

    expect(getUnseenStatsSectionTypes(preferences)).toEqual([]);
  });

  it('marks selected new sections seen without changing layout', () => {
    const preferences = sanitizeStatsPreferences({
      sections: [{ type: 'activity', visible: true }],
      seenSectionTypes: ['activity'],
    });

    const updated = markStatsSectionsSeen(preferences, ['oshi', 'spending']);

    expect(updated.sections).toBe(preferences.sections);
    expect(updated.seenSectionTypes).toEqual(['activity', 'oshi', 'spending']);
  });

  it('saves sanitized preferences under the stats storage key', async () => {
    const preferences = {
      sections: [
        { type: 'cheki', visible: false },
        { type: 'activity', visible: true },
      ],
      seenSectionTypes: ['activity'],
    } as const;

    await saveStatsPreferences({
      sections: [...preferences.sections],
      seenSectionTypes: [...preferences.seenSectionTypes],
    });

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      STATS_PREFERENCES_STORAGE_KEY,
      JSON.stringify(sanitizeStatsPreferences(preferences)),
    );
  });
});


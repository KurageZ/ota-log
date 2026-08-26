import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHEKI_VIEW_PREFERENCES_STORAGE_KEY,
  DEFAULT_CHEKI_VIEW_PREFERENCES,
  loadChekiViewPreferences,
  sanitizeChekiViewPreferences,
  saveChekiViewPreferences,
} from '../chekiViewPreferences';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('chekiViewPreferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resets legacy three-mode values to the new defaults', () => {
    expect(sanitizeChekiViewPreferences({ mode: 'record', density: 'small' }))
      .toEqual(DEFAULT_CHEKI_VIEW_PREFERENCES);
  });

  it('sanitizes the album and record view preferences', () => {
    expect(sanitizeChekiViewPreferences({
      browseMode: 'record',
      defaultBrowseMode: 'record',
      albumGrouping: 'date',
      albumSortOrder: 'asc',
      recordSortOrder: 'desc',
      density: 'small',
      landscapeRotation: 'counterclockwise',
      showRecordThumbnails: false,
      albumModeHintDismissed: true,
    })).toEqual({
      browseMode: 'record',
      defaultBrowseMode: 'record',
      albumGrouping: 'date',
      albumSortOrder: 'asc',
      recordSortOrder: 'desc',
      density: 'small',
      landscapeRotation: 'counterclockwise',
      showRecordThumbnails: false,
      albumModeHintDismissed: true,
    });
  });

  it('migrates the previous item preferences without losing user choices', () => {
    expect(sanitizeChekiViewPreferences({
      browseMode: 'item',
      itemLayout: 'album',
      sortOrder: 'asc',
      density: 'large',
      showRecordThumbnails: false,
      albumModeHintDismissed: true,
    })).toEqual({
      browseMode: 'album',
      defaultBrowseMode: 'album',
      albumGrouping: 'none',
      albumSortOrder: 'asc',
      recordSortOrder: 'asc',
      density: 'large',
      landscapeRotation: 'original',
      showRecordThumbnails: false,
      albumModeHintDismissed: true,
    });
  });

  it('defaults the album to large images with the portrait grid', () => {
    expect(DEFAULT_CHEKI_VIEW_PREFERENCES.density).toBe('large');
    expect(DEFAULT_CHEKI_VIEW_PREFERENCES.defaultBrowseMode).toBe('album');
  });

  it('falls back to the album default when the stored default browse mode is invalid', () => {
    expect(sanitizeChekiViewPreferences({
      browseMode: 'album',
      defaultBrowseMode: 'timeline',
    }).defaultBrowseMode).toBe('album');
  });

  it('keeps a user-selected default browse mode', () => {
    expect(sanitizeChekiViewPreferences({
      browseMode: 'album',
      defaultBrowseMode: 'record',
    }).defaultBrowseMode).toBe('record');
  });

  it('defaults an invalid or missing landscape rotation to the original image direction', () => {
    expect(sanitizeChekiViewPreferences({ landscapeRotation: 'upside-down' }).landscapeRotation)
      .toBe('original');
    expect(sanitizeChekiViewPreferences({}).landscapeRotation).toBe('original');
  });

  it('falls back to defaults when stored JSON is invalid', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');
    await expect(loadChekiViewPreferences()).resolves.toEqual(DEFAULT_CHEKI_VIEW_PREFERENCES);
  });

  it('saves sanitized preferences under the v2 storage key', async () => {
    const preferences = {
      browseMode: 'album' as const,
      defaultBrowseMode: 'album' as const,
      albumGrouping: 'none' as const,
      albumSortOrder: 'asc' as const,
      recordSortOrder: 'desc' as const,
      density: 'small' as const,
      landscapeRotation: 'clockwise' as const,
      showRecordThumbnails: false,
      albumModeHintDismissed: true,
    };
    await saveChekiViewPreferences(preferences);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      CHEKI_VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  });
});

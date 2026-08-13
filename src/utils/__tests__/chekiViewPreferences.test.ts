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
      albumGrouping: 'date',
      albumSortOrder: 'asc',
      recordSortOrder: 'desc',
      density: 'small',
      useSpecAspectRatio: false,
      showRecordThumbnails: false,
    })).toEqual({
      browseMode: 'record',
      albumGrouping: 'date',
      albumSortOrder: 'asc',
      recordSortOrder: 'desc',
      density: 'small',
      useSpecAspectRatio: false,
      showRecordThumbnails: false,
    });
  });

  it('migrates the previous item preferences without losing user choices', () => {
    expect(sanitizeChekiViewPreferences({
      browseMode: 'item',
      itemLayout: 'album',
      sortOrder: 'asc',
      density: 'large',
      showRecordThumbnails: false,
    })).toEqual({
      browseMode: 'album',
      albumGrouping: 'none',
      albumSortOrder: 'asc',
      recordSortOrder: 'asc',
      density: 'large',
      useSpecAspectRatio: false,
      showRecordThumbnails: false,
    });
  });

  it('defaults the album to large images with a uniform ratio', () => {
    expect(DEFAULT_CHEKI_VIEW_PREFERENCES.density).toBe('large');
    expect(DEFAULT_CHEKI_VIEW_PREFERENCES.useSpecAspectRatio).toBe(false);
  });

  it('falls back to defaults when stored JSON is invalid', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');
    await expect(loadChekiViewPreferences()).resolves.toEqual(DEFAULT_CHEKI_VIEW_PREFERENCES);
  });

  it('saves sanitized preferences under the v2 storage key', async () => {
    const preferences = {
      browseMode: 'album' as const,
      albumGrouping: 'none' as const,
      albumSortOrder: 'asc' as const,
      recordSortOrder: 'desc' as const,
      density: 'small' as const,
      useSpecAspectRatio: false,
      showRecordThumbnails: false,
    };
    await saveChekiViewPreferences(preferences);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      CHEKI_VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  });
});

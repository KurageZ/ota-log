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

  it('sanitizes the two-level browse preference', () => {
    expect(sanitizeChekiViewPreferences({
      browseMode: 'record',
      itemLayout: 'album',
      sortOrder: 'asc',
      density: 'small',
      showRecordThumbnails: false,
    })).toEqual({
      browseMode: 'record',
      itemLayout: 'album',
      sortOrder: 'asc',
      density: 'small',
      showRecordThumbnails: false,
    });
  });

  it('falls back to defaults when stored JSON is invalid', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');
    await expect(loadChekiViewPreferences()).resolves.toEqual(DEFAULT_CHEKI_VIEW_PREFERENCES);
  });

  it('saves sanitized preferences under the v2 storage key', async () => {
    const preferences = {
      browseMode: 'item' as const,
      itemLayout: 'album' as const,
      sortOrder: 'asc' as const,
      density: 'small' as const,
      showRecordThumbnails: false,
    };
    await saveChekiViewPreferences(preferences);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      CHEKI_VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  });
});

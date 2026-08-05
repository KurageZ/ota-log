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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to default preferences for invalid values', () => {
    expect(sanitizeChekiViewPreferences({ organization: 'unknown', display: 'bad', columns: 2 })).toEqual(
      DEFAULT_CHEKI_VIEW_PREFERENCES,
    );
  });

  it('drops removed free organization values', () => {
    expect(sanitizeChekiViewPreferences({ organization: 'free', display: 'stack', columns: 5 })).toEqual({
      mode: 'artist',
      sortOrder: 'desc',
      density: 'small',
      showRecordThumbnails: true,
    });
  });

  it('migrates old fixed column preferences to photo size density', () => {
    expect(sanitizeChekiViewPreferences({ organization: 'artist', display: 'grid', columns: 3 })).toEqual({
      mode: 'artist',
      sortOrder: 'desc',
      density: 'large',
      showRecordThumbnails: true,
    });
    expect(sanitizeChekiViewPreferences({ organization: 'artist', display: 'grid', columns: 4 })).toEqual({
      mode: 'artist',
      sortOrder: 'desc',
      density: 'medium',
      showRecordThumbnails: true,
    });
    expect(sanitizeChekiViewPreferences({ organization: 'artist', display: 'grid', columns: 5 })).toEqual({
      mode: 'artist',
      sortOrder: 'desc',
      density: 'small',
      showRecordThumbnails: true,
    });
  });

  it('migrates old time stack and time grid preferences to the new modes', () => {
    expect(sanitizeChekiViewPreferences({ organization: 'time', display: 'stack', density: 'medium' })).toEqual({
      mode: 'record',
      sortOrder: 'desc',
      density: 'medium',
      showRecordThumbnails: true,
    });
    expect(sanitizeChekiViewPreferences({ organization: 'time', display: 'grid', density: 'small' })).toEqual({
      mode: 'album',
      sortOrder: 'desc',
      density: 'small',
      showRecordThumbnails: true,
    });
  });

  it('loads stored preferences from AsyncStorage', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
      mode: 'date',
      sortOrder: 'asc',
      density: 'medium',
    }));

    await expect(loadChekiViewPreferences()).resolves.toEqual({
      mode: 'record',
      sortOrder: 'asc',
      density: 'medium',
      showRecordThumbnails: true,
    });
  });

  it('preserves the record thumbnail preference', () => {
    expect(sanitizeChekiViewPreferences({
      mode: 'record',
      sortOrder: 'desc',
      density: 'medium',
      showRecordThumbnails: false,
    })).toEqual({
      mode: 'record',
      sortOrder: 'desc',
      density: 'medium',
      showRecordThumbnails: false,
    });
  });

  it('falls back to defaults when stored JSON is invalid', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');

    await expect(loadChekiViewPreferences()).resolves.toEqual(DEFAULT_CHEKI_VIEW_PREFERENCES);
  });

  it('saves sanitized preferences under the cheki view storage key', async () => {
    await saveChekiViewPreferences({
      mode: 'album',
      sortOrder: 'asc',
      density: 'small',
      showRecordThumbnails: false,
    });

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      CHEKI_VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        mode: 'album',
        sortOrder: 'asc',
        density: 'small',
        showRecordThumbnails: false,
      }),
    );
  });
});

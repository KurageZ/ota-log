import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cheki } from '../../types/models';
import {
  CHEKI_PHOTO_WIDGET_PREFERENCES_STORAGE_KEY,
  filterChekiForPhotoWidget,
  loadChekiPhotoWidgetPreferences,
  sanitizeChekiPhotoWidgetPreferences,
  saveChekiPhotoWidgetPreferences,
  subscribeToChekiPhotoWidgetPreferenceChanges,
} from '../chekiPhotoWidgetPreferences';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function createCheki(id: string, artistId: string | null): Cheki {
  return {
    id,
    artist_id: artistId,
    event_id: null,
    photo_uri: `file:///${id}.jpg`,
    front_photo_uri: `file:///${id}.jpg`,
    back_photo_uri: null,
    date: null,
    price: null,
    notes: null,
    is_favorite: 0,
    created_at: '2026-07-17T00:00:00.000Z',
  };
}

describe('cheki photo widget preferences', () => {
  beforeEach(() => {
    mockedAsyncStorage.getItem.mockReset();
    mockedAsyncStorage.setItem.mockReset();
  });

  test('sanitizes invalid values to all artists', () => {
    expect(sanitizeChekiPhotoWidgetPreferences(null)).toEqual({ artistIds: [] });
    expect(sanitizeChekiPhotoWidgetPreferences({ artistIds: 'artist-1' })).toEqual({ artistIds: [] });
    expect(sanitizeChekiPhotoWidgetPreferences({ artistIds: ['', 42] })).toEqual({ artistIds: [] });
  });

  test('loads multiple selected artists from storage', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
      artistIds: ['artist-1', ' artist-2 ', 'artist-1'],
    }));

    await expect(loadChekiPhotoWidgetPreferences()).resolves.toEqual({
      artistIds: ['artist-1', 'artist-2'],
    });
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
      CHEKI_PHOTO_WIDGET_PREFERENCES_STORAGE_KEY,
    );
  });

  test('migrates the original single-artist preference', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ artistId: 'artist-1' }));
    await expect(loadChekiPhotoWidgetPreferences()).resolves.toEqual({ artistIds: ['artist-1'] });
  });

  test('falls back to all artists when stored data is unreadable', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');
    await expect(loadChekiPhotoWidgetPreferences()).resolves.toEqual({ artistIds: [] });
  });

  test('saves the preference and notifies active widget synchronizers', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToChekiPhotoWidgetPreferenceChanges(listener);

    await saveChekiPhotoWidgetPreferences({ artistIds: ['artist-1', 'artist-2'] });

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      CHEKI_PHOTO_WIDGET_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ artistIds: ['artist-1', 'artist-2'] }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test('filters photos by multiple selected artists and keeps repository order', () => {
    const records = [
      createCheki('newest-a', 'artist-a'),
      createCheki('middle-b', 'artist-b'),
      createCheki('oldest-a', 'artist-a'),
      createCheki('unlinked', null),
    ];

    expect(filterChekiForPhotoWidget(records, { artistIds: ['artist-a', 'artist-b'] }).map((item) => item.id))
      .toEqual(['newest-a', 'middle-b', 'oldest-a']);
    expect(filterChekiForPhotoWidget(records, { artistIds: [] })).toBe(records);
  });
});

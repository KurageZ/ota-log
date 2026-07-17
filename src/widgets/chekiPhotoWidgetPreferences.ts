import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cheki } from '../types/models';

export const CHEKI_PHOTO_WIDGET_PREFERENCES_STORAGE_KEY = 'ota-log.cheki-photo-widget-preferences.v1';

export interface ChekiPhotoWidgetPreferences {
  artistIds: string[];
}

export const DEFAULT_CHEKI_PHOTO_WIDGET_PREFERENCES: ChekiPhotoWidgetPreferences = {
  artistIds: [],
};

const changeListeners = new Set<() => void>();

export function sanitizeChekiPhotoWidgetPreferences(value: unknown): ChekiPhotoWidgetPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_CHEKI_PHOTO_WIDGET_PREFERENCES;

  const candidate = value as { artistIds?: unknown; artistId?: unknown };
  if (Array.isArray(candidate.artistIds)) {
    const artistIds = candidate.artistIds.flatMap((artistId) => {
      if (typeof artistId !== 'string') return [];
      const trimmedArtistId = artistId.trim();
      return trimmedArtistId ? [trimmedArtistId] : [];
    });
    return {
      artistIds: [...new Set(artistIds)],
    };
  }

  // 兼容最初的单选格式。
  return {
    artistIds: typeof candidate.artistId === 'string' && candidate.artistId.trim()
      ? [candidate.artistId.trim()]
      : [],
  };
}

export async function loadChekiPhotoWidgetPreferences(): Promise<ChekiPhotoWidgetPreferences> {
  try {
    const raw = await AsyncStorage.getItem(CHEKI_PHOTO_WIDGET_PREFERENCES_STORAGE_KEY);
    return raw ? sanitizeChekiPhotoWidgetPreferences(JSON.parse(raw)) : DEFAULT_CHEKI_PHOTO_WIDGET_PREFERENCES;
  } catch {
    return DEFAULT_CHEKI_PHOTO_WIDGET_PREFERENCES;
  }
}

export async function saveChekiPhotoWidgetPreferences(
  preferences: ChekiPhotoWidgetPreferences,
): Promise<void> {
  const sanitized = sanitizeChekiPhotoWidgetPreferences(preferences);
  await AsyncStorage.setItem(
    CHEKI_PHOTO_WIDGET_PREFERENCES_STORAGE_KEY,
    JSON.stringify(sanitized),
  );
  for (const listener of changeListeners) listener();
}

export function subscribeToChekiPhotoWidgetPreferenceChanges(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function filterChekiForPhotoWidget(
  chekiRecords: Cheki[],
  preferences: ChekiPhotoWidgetPreferences,
): Cheki[] {
  if (preferences.artistIds.length === 0) return chekiRecords;
  const selectedArtistIds = new Set(preferences.artistIds);
  return chekiRecords.filter(
    (cheki) => cheki.artist_id !== null && selectedArtistIds.has(cheki.artist_id),
  );
}

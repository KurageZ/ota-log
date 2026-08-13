import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChekiGridDensity } from './cheki';

export const CHEKI_VIEW_PREFERENCES_STORAGE_KEY = 'ota-log.cheki-view-preferences.v2';

export type ChekiBrowseMode = 'album' | 'record';
export type ChekiAlbumGrouping = 'artist' | 'date' | 'none';
export type ChekiSortOrder = 'desc' | 'asc';

export interface ChekiViewPreferences {
  browseMode: ChekiBrowseMode;
  albumGrouping: ChekiAlbumGrouping;
  albumSortOrder: ChekiSortOrder;
  recordSortOrder: ChekiSortOrder;
  density: ChekiGridDensity;
  useSpecAspectRatio: boolean;
  showRecordThumbnails: boolean;
}

export const DEFAULT_CHEKI_VIEW_PREFERENCES: ChekiViewPreferences = {
  browseMode: 'album',
  albumGrouping: 'artist',
  albumSortOrder: 'desc',
  recordSortOrder: 'desc',
  density: 'large',
  useSpecAspectRatio: false,
  showRecordThumbnails: true,
};

function isBrowseMode(value: unknown): value is ChekiBrowseMode {
  return value === 'album' || value === 'record';
}

function isAlbumGrouping(value: unknown): value is ChekiAlbumGrouping {
  return value === 'artist' || value === 'date' || value === 'none';
}

function isSortOrder(value: unknown): value is ChekiSortOrder {
  return value === 'desc' || value === 'asc';
}

function isDensity(value: unknown): value is ChekiGridDensity {
  return value === 'large' || value === 'medium' || value === 'small';
}

export function sanitizeChekiViewPreferences(value: unknown): ChekiViewPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_CHEKI_VIEW_PREFERENCES;
  const raw = value as Record<string, unknown>;
  if ('mode' in raw && !('browseMode' in raw)) return DEFAULT_CHEKI_VIEW_PREFERENCES;
  const legacySortOrder = isSortOrder(raw.sortOrder) ? raw.sortOrder : null;
  const legacyGrouping = raw.itemLayout === 'artist'
    ? 'artist'
    : raw.itemLayout === 'album'
      ? 'none'
      : null;
  return {
    browseMode: isBrowseMode(raw.browseMode)
      ? raw.browseMode
      : raw.browseMode === 'item'
        ? 'album'
      : DEFAULT_CHEKI_VIEW_PREFERENCES.browseMode,
    albumGrouping: isAlbumGrouping(raw.albumGrouping)
      ? raw.albumGrouping
      : legacyGrouping ?? DEFAULT_CHEKI_VIEW_PREFERENCES.albumGrouping,
    albumSortOrder: isSortOrder(raw.albumSortOrder)
      ? raw.albumSortOrder
      : legacySortOrder ?? DEFAULT_CHEKI_VIEW_PREFERENCES.albumSortOrder,
    recordSortOrder: isSortOrder(raw.recordSortOrder)
      ? raw.recordSortOrder
      : legacySortOrder ?? DEFAULT_CHEKI_VIEW_PREFERENCES.recordSortOrder,
    density: isDensity(raw.density)
      ? raw.density
      : DEFAULT_CHEKI_VIEW_PREFERENCES.density,
    useSpecAspectRatio: typeof raw.useSpecAspectRatio === 'boolean'
      ? raw.useSpecAspectRatio
      : DEFAULT_CHEKI_VIEW_PREFERENCES.useSpecAspectRatio,
    showRecordThumbnails: typeof raw.showRecordThumbnails === 'boolean'
      ? raw.showRecordThumbnails
      : DEFAULT_CHEKI_VIEW_PREFERENCES.showRecordThumbnails,
  };
}

export async function loadChekiViewPreferences(): Promise<ChekiViewPreferences> {
  try {
    const raw = await AsyncStorage.getItem(CHEKI_VIEW_PREFERENCES_STORAGE_KEY);
    return sanitizeChekiViewPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_CHEKI_VIEW_PREFERENCES;
  }
}

export async function saveChekiViewPreferences(preferences: ChekiViewPreferences): Promise<void> {
  await AsyncStorage.setItem(
    CHEKI_VIEW_PREFERENCES_STORAGE_KEY,
    JSON.stringify(sanitizeChekiViewPreferences(preferences)),
  );
}

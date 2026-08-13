import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChekiGridDensity } from './cheki';

export const CHEKI_VIEW_PREFERENCES_STORAGE_KEY = 'ota-log.cheki-view-preferences.v2';

export type ChekiBrowseMode = 'item' | 'record';
export type ChekiItemLayout = 'artist' | 'album';
export type ChekiSortOrder = 'desc' | 'asc';

export interface ChekiViewPreferences {
  browseMode: ChekiBrowseMode;
  itemLayout: ChekiItemLayout;
  sortOrder: ChekiSortOrder;
  density: ChekiGridDensity;
  showRecordThumbnails: boolean;
}

export const DEFAULT_CHEKI_VIEW_PREFERENCES: ChekiViewPreferences = {
  browseMode: 'item',
  itemLayout: 'artist',
  sortOrder: 'desc',
  density: 'medium',
  showRecordThumbnails: true,
};

function isBrowseMode(value: unknown): value is ChekiBrowseMode {
  return value === 'item' || value === 'record';
}

function isItemLayout(value: unknown): value is ChekiItemLayout {
  return value === 'artist' || value === 'album';
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
  return {
    browseMode: isBrowseMode(raw.browseMode)
      ? raw.browseMode
      : DEFAULT_CHEKI_VIEW_PREFERENCES.browseMode,
    itemLayout: isItemLayout(raw.itemLayout)
      ? raw.itemLayout
      : DEFAULT_CHEKI_VIEW_PREFERENCES.itemLayout,
    sortOrder: isSortOrder(raw.sortOrder)
      ? raw.sortOrder
      : DEFAULT_CHEKI_VIEW_PREFERENCES.sortOrder,
    density: isDensity(raw.density)
      ? raw.density
      : DEFAULT_CHEKI_VIEW_PREFERENCES.density,
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

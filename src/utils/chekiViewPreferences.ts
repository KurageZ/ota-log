import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChekiGridDensity } from './cheki';

export const CHEKI_VIEW_PREFERENCES_STORAGE_KEY = 'ota-log.cheki-view-preferences.v1';

export type ChekiViewMode = 'artist' | 'record' | 'album';
export type ChekiSortOrder = 'desc' | 'asc';

export interface ChekiViewPreferences {
  mode: ChekiViewMode;
  sortOrder: ChekiSortOrder;
  density: ChekiGridDensity;
  showRecordThumbnails: boolean;
}

export const DEFAULT_CHEKI_VIEW_PREFERENCES: ChekiViewPreferences = {
  mode: 'artist',
  sortOrder: 'desc',
  density: 'medium',
  showRecordThumbnails: true,
};

function isMode(value: unknown): value is ChekiViewMode {
  return value === 'artist' || value === 'record' || value === 'album';
}

function isSortOrder(value: unknown): value is ChekiSortOrder {
  return value === 'desc' || value === 'asc';
}

function isDensity(value: unknown): value is ChekiGridDensity {
  return value === 'large' || value === 'medium' || value === 'small';
}

function densityFromLegacyColumns(value: unknown): ChekiGridDensity | null {
  if (value === 3) return 'large';
  if (value === 4) return 'medium';
  if (value === 5) return 'small';
  return null;
}

function modeFromLegacyPreferences(value: Record<string, unknown>): ChekiViewMode {
  if ('mode' in value && isMode(value.mode)) return value.mode;
  if (value.mode === 'date') return 'record';
  if (value.organization === 'time' && value.display === 'stack') return 'record';
  if (value.organization === 'time') return 'album';
  return DEFAULT_CHEKI_VIEW_PREFERENCES.mode;
}

export function sanitizeChekiViewPreferences(value: unknown): ChekiViewPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_CHEKI_VIEW_PREFERENCES;

  const raw = value as Record<string, unknown>;
  const mode = modeFromLegacyPreferences(raw);
  const sortOrder = 'sortOrder' in raw && isSortOrder(raw.sortOrder)
    ? raw.sortOrder
    : DEFAULT_CHEKI_VIEW_PREFERENCES.sortOrder;
  const legacyDensity = 'columns' in value ? densityFromLegacyColumns(value.columns) : null;
  const density = 'density' in value && isDensity(value.density)
    ? value.density
    : legacyDensity ?? DEFAULT_CHEKI_VIEW_PREFERENCES.density;
  const showRecordThumbnails = typeof raw.showRecordThumbnails === 'boolean'
    ? raw.showRecordThumbnails
    : DEFAULT_CHEKI_VIEW_PREFERENCES.showRecordThumbnails;

  return { mode, sortOrder, density, showRecordThumbnails };
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

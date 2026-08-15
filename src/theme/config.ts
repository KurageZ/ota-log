export type AppThemeId = 'monoChrome' | 'classicViolet' | 'nightNeon';
export type AppAppearance = 'system' | 'light' | 'dark';
export type AppCalendarWeekStart = 'sunday' | 'monday';
export type ChekiDisplayMode = 'portrait' | 'original';

export interface CalendarDisplayOptions {
  showChekiPhotos: boolean;
  showEvents: boolean;
  showDateItems: boolean;
}

export const DEFAULT_THEME_ID: AppThemeId = 'monoChrome';
export const DEFAULT_APPEARANCE: AppAppearance = 'system';
export const DEFAULT_CALENDAR_WEEK_START: AppCalendarWeekStart = 'sunday';
export const DEFAULT_CHEKI_DISPLAY_MODE: ChekiDisplayMode = 'portrait';
export const DEFAULT_CALENDAR_DISPLAY: CalendarDisplayOptions = {
  showChekiPhotos: true,
  showEvents: true,
  showDateItems: true,
};

export const APP_APPEARANCE_LABELS: Record<AppAppearance, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};

export const APP_THEME_LABELS: Record<AppThemeId, string> = {
  monoChrome: '极简',
  classicViolet: '紫色',
  nightNeon: '粉色',
};

export const APP_CALENDAR_WEEK_START_LABELS: Record<AppCalendarWeekStart, string> = {
  sunday: '周日',
  monday: '周一',
};

export const CHEKI_DISPLAY_MODE_LABELS: Record<ChekiDisplayMode, string> = {
  portrait: '拍立得',
  original: '正方形网格',
};

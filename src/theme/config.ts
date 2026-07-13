export type AppThemeId = 'monoChrome' | 'classicViolet' | 'nightNeon';
export type AppAppearance = 'system' | 'light' | 'dark';
export type AppCalendarDefaultView = 'month' | 'timeline';

export const DEFAULT_THEME_ID: AppThemeId = 'monoChrome';
export const DEFAULT_APPEARANCE: AppAppearance = 'system';
export const DEFAULT_CALENDAR_DEFAULT_VIEW: AppCalendarDefaultView = 'month';

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

export const APP_CALENDAR_DEFAULT_VIEW_LABELS: Record<AppCalendarDefaultView, string> = {
  month: '日历',
  timeline: '时间表',
};

import type { WindowMode } from './windowMode';

export const CALENDAR_SPLIT_GAP = 24;
export const CALENDAR_MONTH_PANE_MAX_WIDTH = 680;

/**
 * 当前双栏专门解决 iPad 的横向空间利用；Android 平板仍保留
 * 单滚动容器，避免破坏现有的可折叠页头交互。
 */
export function shouldUseCalendarSplitLayout(mode: WindowMode, isIOS: boolean): boolean {
  return isIOS && mode === 'wide';
}

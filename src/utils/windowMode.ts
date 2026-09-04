import { useWindowDimensions } from 'react-native';

export type WindowMode = 'compact' | 'regular' | 'wide';

/** 小于该宽度视为 Compact，保持手机单列布局。 */
export const COMPACT_MAX_WIDTH = 680;
/** 达到该宽度视为 Wide，启用主从布局与多列仪表盘。 */
export const WIDE_MIN_WIDTH = 960;

/**
 * 根据窗口宽度而不是设备型号决定布局模式，保证 iPad Split View / Stage Manager
 * 下的每个窗口宽度都有对应的布局。
 */
export function getWindowMode(width: number): WindowMode {
  if (width < COMPACT_MAX_WIDTH) return 'compact';
  if (width < WIDE_MIN_WIDTH) return 'regular';
  return 'wide';
}

export function useWindowMode() {
  const { width } = useWindowDimensions();
  const mode = getWindowMode(width);
  return {
    mode,
    width,
    isCompact: mode === 'compact',
    isRegular: mode === 'regular',
    isWide: mode === 'wide',
  };
}

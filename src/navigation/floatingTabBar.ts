import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FLOATING_TAB_BAR_MIN_INSET = 6;
const FLOATING_TAB_BAR_CONTENT_GAP = 10;
const FLOATING_TAB_BAR_BASE_HEIGHT = 66;
const FLOATING_TAB_BAR_BOTTOM_OFFSET = process.env.EXPO_OS === 'android' ? 22 : 24;

export const FLOATING_TAB_BAR_HORIZONTAL_MARGIN = 12;

export function getFloatingTabBarMetrics(bottomInset: number) {
  const safeBottom = Math.max(bottomInset, FLOATING_TAB_BAR_MIN_INSET);
  const barHeight = FLOATING_TAB_BAR_BASE_HEIGHT + safeBottom;

  return {
    safeBottom,
    barHeight,
    bottomOffset: FLOATING_TAB_BAR_BOTTOM_OFFSET,
    contentBottomPadding: barHeight + FLOATING_TAB_BAR_BOTTOM_OFFSET + FLOATING_TAB_BAR_CONTENT_GAP,
  };
}

export function useFloatingTabBarSpacing() {
  const insets = useSafeAreaInsets();
  return getFloatingTabBarMetrics(insets.bottom);
}

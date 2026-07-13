const NATIVE_TAB_BAR_CONTENT_GAP = 24;

export const FLOATING_TAB_BAR_HORIZONTAL_MARGIN = 0;

export function getFloatingTabBarMetrics(_bottomInset: number) {
  return {
    safeBottom: 0,
    barHeight: 0,
    bottomOffset: 0,
    contentBottomPadding: NATIVE_TAB_BAR_CONTENT_GAP,
  };
}

export function useFloatingTabBarSpacing() {
  return getFloatingTabBarMetrics(0);
}

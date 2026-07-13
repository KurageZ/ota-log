// NativeTabs owns the bottom safe-area inset. This value is only visual breathing room
// after the final piece of content and must not include the native tab bar height.
const NATIVE_TAB_CONTENT_END_GAP = 24;

export const FLOATING_TAB_BAR_HORIZONTAL_MARGIN = 0;

export function getFloatingTabBarMetrics(_bottomInset: number) {
  return {
    safeBottom: 0,
    barHeight: 0,
    bottomOffset: 0,
    contentBottomPadding: NATIVE_TAB_CONTENT_END_GAP,
  };
}

export function useFloatingTabBarSpacing() {
  return getFloatingTabBarMetrics(0);
}

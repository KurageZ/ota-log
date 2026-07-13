import type { ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type ScrollOptions = {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  hideThreshold?: number;
  showThreshold?: number;
  topRevealOffset?: number;
};

const noop = () => {};

export function FloatingTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useFloatingTabBarVisibility() {
  return {
    isHidden: false,
    hideTabBar: noop,
    showTabBar: noop,
    setHidden: noop,
  };
}

export function useFloatingTabBarScroll({ onScroll }: ScrollOptions = {}) {
  if (!onScroll) return {};

  return {
    onScroll,
    scrollEventThrottle: 16 as const,
  };
}

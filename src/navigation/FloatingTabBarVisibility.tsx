import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type FloatingTabBarVisibilityContextValue = {
  isHidden: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
  setHidden: (hidden: boolean) => void;
};

const FloatingTabBarVisibilityContext = createContext<FloatingTabBarVisibilityContextValue | null>(null);

export function FloatingTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [isHidden, setIsHidden] = useState(false);

  const setHidden = useCallback((hidden: boolean) => {
    setIsHidden((current) => (current === hidden ? current : hidden));
  }, []);

  const hideTabBar = useCallback(() => {
    setHidden(true);
  }, [setHidden]);

  const showTabBar = useCallback(() => {
    setHidden(false);
  }, [setHidden]);

  const value = useMemo<FloatingTabBarVisibilityContextValue>(() => ({
    isHidden,
    hideTabBar,
    showTabBar,
    setHidden,
  }), [hideTabBar, isHidden, setHidden, showTabBar]);

  return (
    <FloatingTabBarVisibilityContext.Provider value={value}>
      {children}
    </FloatingTabBarVisibilityContext.Provider>
  );
}

export function useFloatingTabBarVisibility() {
  const value = useContext(FloatingTabBarVisibilityContext);
  if (!value) {
    throw new Error('useFloatingTabBarVisibility must be used within FloatingTabBarVisibilityProvider');
  }
  return value;
}

type ScrollOptions = {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  hideThreshold?: number;
  showThreshold?: number;
  topRevealOffset?: number;
};

export function useFloatingTabBarScroll({
  onScroll,
  hideThreshold = 18,
  showThreshold = 12,
  topRevealOffset = 24,
}: ScrollOptions = {}) {
  const { setHidden } = useFloatingTabBarVisibility();
  const lastOffsetY = useRef(0);
  const deltaBuffer = useRef(0);

  useEffect(() => {
    setHidden(false);
  }, [setHidden]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
    const deltaY = offsetY - lastOffsetY.current;

    if ((deltaBuffer.current > 0 && deltaY < 0) || (deltaBuffer.current < 0 && deltaY > 0)) {
      deltaBuffer.current = 0;
    }

    deltaBuffer.current += deltaY;

    if (offsetY <= topRevealOffset) {
      setHidden(false);
      deltaBuffer.current = 0;
    } else if (deltaBuffer.current >= hideThreshold) {
      setHidden(true);
      deltaBuffer.current = 0;
    } else if (deltaBuffer.current <= -showThreshold) {
      setHidden(false);
      deltaBuffer.current = 0;
    }

    lastOffsetY.current = offsetY;
    onScroll?.(event);
  }, [hideThreshold, onScroll, setHidden, showThreshold, topRevealOffset]);

  return {
    onScroll: handleScroll,
    scrollEventThrottle: 16 as const,
  };
}

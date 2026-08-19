import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the system "reduce motion" accessibility setting.
 * Used to gate decorative animations while keeping functional feedback intact.
 */
export function useReducedMotionEnabled(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

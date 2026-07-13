import { Platform } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

/**
 * Scroll screens should remain edge-to-edge on iOS and let the scroll view
 * adjust its content inset. Android keeps the existing bottom safe-area guard.
 */
export const SCROLL_SCREEN_SAFE_AREA_EDGES: Edge[] = Platform.OS === 'ios' ? [] : ['bottom'];

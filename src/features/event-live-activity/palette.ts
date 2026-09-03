import { getAppTheme } from '../../theme/appTheme';
import type { AppThemeId } from '../../theme/config';
import type { EventLiveActivityPalette } from './types';

function createPalette(themeId: AppThemeId, mode: 'light' | 'dark'): EventLiveActivityPalette {
  const colors = getAppTheme(themeId, mode);
  return {
    background: colors.card,
    accent: colors.accent,
    text: colors.text,
    textSecondary: colors.textSecondary,
  };
}

export function createEventLiveActivityPalettes(themeId: AppThemeId): {
  lightPalette: EventLiveActivityPalette;
  darkPalette: EventLiveActivityPalette;
} {
  return {
    lightPalette: createPalette(themeId, 'light'),
    darkPalette: createPalette(themeId, 'dark'),
  };
}

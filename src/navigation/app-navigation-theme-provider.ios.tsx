import { useMemo, type ReactNode } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useAppTheme } from '../theme/appTheme';

export function AppNavigationThemeProvider({ children }: { children: ReactNode }) {
  const { colors, isDark } = useAppTheme();
  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.accent,
        background: colors.screen,
        card: colors.header,
        text: colors.heading,
        border: colors.divider,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  return <ThemeProvider value={navigationTheme}>{children}</ThemeProvider>;
}

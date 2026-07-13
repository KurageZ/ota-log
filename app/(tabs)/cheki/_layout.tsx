import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useAppTheme } from '../../../src/theme/appTheme';

export default function ChekiLayout() {
  const { colors, isDark } = useAppTheme();
  const isIOS = Platform.OS === 'ios';

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.screen },
        headerTintColor: colors.heading,
        headerTitleStyle: { color: colors.heading },
        statusBarStyle: isDark ? 'light' : 'dark',
        statusBarAnimation: 'fade',
      }}
    >
      <Stack.Screen
        name="index"
        options={
          isIOS
            ? {
                title: '电子切册',
                headerLargeTitle: true,
                headerLargeTitleShadowVisible: false,
                headerShadowVisible: false,
              }
            : {
                title: '电子切册',
                headerShown: false,
              }
        }
      />
    </Stack>
  );
}

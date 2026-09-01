import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { DBProvider } from '../src/context/DBContext';
import { OnboardingGuideProvider } from '../src/components/OnboardingGuide';
import { useAppTheme } from '../src/theme/appTheme';
import { AppThemeProvider } from '../src/theme/themePreferences';
import { AppNavigationThemeProvider } from '../src/navigation/app-navigation-theme-provider';
import { ChekiPhotoWidgetSync } from '../src/widgets/ChekiPhotoWidgetSync';
import { NextEventWidgetSync } from '../src/widgets/NextEventWidgetSync';
import { CalendarWidgetSync } from '../src/widgets/CalendarWidgetSync';

const LUCIDE_FONT = require('@react-native-vector-icons/lucide/fonts/Lucide.ttf');

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Lucide: LUCIDE_FONT });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppThemeProvider>
          <BottomSheetModalProvider>
            <DBProvider>
              <ChekiPhotoWidgetSync />
              <NextEventWidgetSync />
              <CalendarWidgetSync />
              <OnboardingGuideProvider>
                <AppNavigationThemeProvider>
                  <RootNavigator />
                </AppNavigationThemeProvider>
              </OnboardingGuideProvider>
            </DBProvider>
          </BottomSheetModalProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { colors, isDark, isHydrated } = useAppTheme();

  if (!isHydrated) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.header },
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.heading,
        headerTitleStyle: { color: colors.heading },
        contentStyle: { backgroundColor: colors.screen },
        statusBarStyle: isDark ? 'light' : 'dark',
        statusBarAnimation: 'fade',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '首页' }} />
      <Stack.Screen name="about" options={{ title: '关于' }} />
      <Stack.Screen name="privacy" options={{ title: '隐私与数据' }} />
      <Stack.Screen name="events/index" options={{ title: '所有活动' }} />
      <Stack.Screen
        name="events/compose"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          title: '新建活动',
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen name="events/create" options={{ presentation: 'fullScreenModal', title: '新建活动' }} />
      <Stack.Screen name="events/[id]" options={{ title: '活动详情' }} />
      <Stack.Screen name="events/[id]/edit" options={{ presentation: 'modal', title: '编辑活动' }} />
      <Stack.Screen name="artists/index" options={{ title: '艺人管理' }} />
      <Stack.Screen name="artists/new" options={{ presentation: 'modal', title: '新建艺人' }} />
      <Stack.Screen name="artists/[id]/index" options={{ title: '艺人详情' }} />
      <Stack.Screen name="artists/[id]/memberships" options={{ title: '所属履历' }} />
      <Stack.Screen name="artists/[id]/edit" options={{ presentation: 'modal', title: '编辑艺人' }} />
      <Stack.Screen name="cheki/new" options={{ presentation: 'modal', title: '添加拍立得记录' }} />
      <Stack.Screen name="cheki/records/[id]/index" options={{ title: '拍立得记录' }} />
      <Stack.Screen name="cheki/records/[id]/edit" options={{ presentation: 'modal', title: '编辑拍立得记录' }} />
      <Stack.Screen name="cheki/[id]/edit" options={{ presentation: 'modal', title: '编辑拍立得' }} />
      <Stack.Screen name="cheki/manual/new" options={{ presentation: 'modal', title: '添加记录' }} />
      <Stack.Screen name="cheki/manual/[id]/edit" options={{ presentation: 'modal', title: '编辑记录' }} />
      <Stack.Screen name="date-items/index" options={{ title: '重要日期' }} />
      <Stack.Screen name="date-items/new" options={{ presentation: 'modal', title: '新建重要日期' }} />
      <Stack.Screen name="date-items/[id]" options={{ title: '' }} />
      <Stack.Screen name="date-items/[id]/edit" options={{ presentation: 'modal', title: '编辑重要日期' }} />
      <Stack.Screen name="settings/index" options={{ title: '设置' }} />
      <Stack.Screen name="settings/home" options={{ title: '首页自定义' }} />
      <Stack.Screen name="settings/stats" options={{ title: '统计自定义' }} />
      <Stack.Screen name="settings/profile" options={{ title: '个人资料' }} />
      <Stack.Screen name="settings/oshi" options={{ title: '单推设置' }} />
      <Stack.Screen name="settings/widget" options={{ title: '小组件设置' }} />
      <Stack.Screen name="settings/artist-type-conversion" options={{ title: '艺人类型转换' }} />
      <Stack.Screen name="weibo" options={{ title: '微博抓取' }} />
      <Stack.Screen name="tools/index" options={{ title: '工具箱' }} />
      <Stack.Screen name="tools/chekiroku-import" options={{ title: '外部数据导入' }} />
      <Stack.Screen
        name="tools/cheki-sticker-camera"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="tools/weibo-following" options={{ title: '微博关注导入' }} />
    </Stack>
  );
}

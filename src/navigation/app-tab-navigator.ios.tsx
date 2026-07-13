import { Lucide } from '@react-native-vector-icons/lucide';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppTheme } from '../theme/appTheme';
import { FloatingTabBarVisibilityProvider } from './FloatingTabBarVisibility';

export function AppTabNavigator() {
  const { colors } = useAppTheme();

  return (
    <FloatingTabBarVisibilityProvider>
      <NativeTabs
        iconColor={{ default: colors.textSecondary, selected: colors.accent }}
        labelStyle={{
          default: { color: colors.textSecondary },
          selected: { color: colors.accent },
        }}
        minimizeBehavior="onScrollDown"
        tintColor={colors.accent}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Lucide} name="home" />}
          />
          <NativeTabs.Trigger.Label>首页</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calendar">
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Lucide} name="calendar" />}
          />
          <NativeTabs.Trigger.Label>日历</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="cheki">
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Lucide} name="album" />}
          />
          <NativeTabs.Trigger.Label>切册</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="stats">
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Lucide} name="chart-column" />}
          />
          <NativeTabs.Trigger.Label>统计</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            src={<NativeTabs.Trigger.VectorIcon family={Lucide} name="user" />}
          />
          <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </FloatingTabBarVisibilityProvider>
  );
}

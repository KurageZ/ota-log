import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppTheme } from '../theme/appTheme';
import { createNativeTabIcon } from './native-tab-icon';

export function AppTabNavigator() {
  const { colors } = useAppTheme();

  return (
    <NativeTabs
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.accent },
      }}
      minimizeBehavior="onScrollDown"
      tintColor={colors.accent}
      // 五个主入口是同级的顶层导航，固定使用 Tab Bar。
      // iPad 的 adaptable sidebar 会浮在内容上方，不适合这种扁平信息架构。
      sidebarAdaptable={false}
    >
      <NativeTabs.Trigger name="(home)">
        {createNativeTabIcon('home')}
        <NativeTabs.Trigger.Label>首页</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        {createNativeTabIcon('calendar')}
        <NativeTabs.Trigger.Label>日历</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cheki">
        {createNativeTabIcon('cheki')}
        <NativeTabs.Trigger.Label>切册</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        {createNativeTabIcon('stats')}
        <NativeTabs.Trigger.Label>统计</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        {createNativeTabIcon('profile')}
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

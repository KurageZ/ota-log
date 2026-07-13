import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { CustomFloatingTabBar } from './CustomFloatingTabBar';
import { FloatingTabBarVisibilityProvider } from './FloatingTabBarVisibility';

function TabIcon({ name, color, focused, size = 20 }: { name: AppIconName; color: ColorValue; focused: boolean; size?: number }) {
  return <AppIcon name={name} variant={focused ? 'active' : 'inactive'} size={size} color={color} />;
}

export function AppTabNavigator() {
  return (
    <FloatingTabBarVisibilityProvider>
      <Tabs
        tabBar={(props) => <CustomFloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: '首页',
            tabBarIcon: ({ color, focused, size }) => (
              <TabIcon name="home" color={color} focused={focused} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: '日历',
            tabBarIcon: ({ color, focused, size }) => (
              <TabIcon name="calendar" color={color} focused={focused} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="cheki"
          options={{
            title: '切册',
            tabBarIcon: ({ color, focused, size }) => (
              <TabIcon name="cheki" color={color} focused={focused} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: '统计',
            tabBarIcon: ({ color, focused, size }) => (
              <TabIcon name="stats" color={color} focused={focused} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '我的',
            tabBarIcon: ({ color, focused, size }) => (
              <TabIcon name="profile" color={color} focused={focused} size={size} />
            ),
          }}
        />
      </Tabs>
    </FloatingTabBarVisibilityProvider>
  );
}

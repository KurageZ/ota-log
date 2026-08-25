import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../../src/components/AppIcon';
import { MenuCard, MenuItem } from '../../../src/components/SettingsMenu';
import { useDB } from '../../../src/context/DBContext';
import { useAppTheme } from '../../../src/theme/appTheme';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../../src/utils/safeArea';
import type { ChekiWidgetGroupSummary } from '../../../src/types/chekiWidgetGroups';

export default function WidgetSettingsScreen() {
  const { colors } = useAppTheme();
  const db = useDB();
  const [groups, setGroups] = useState<ChekiWidgetGroupSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => {
    let active = true;
    setGroups(null);
    setLoadError(null);
    void db.chekiWidgetGroups.listSummaries().then((nextGroups) => {
      if (active) setGroups(nextGroups);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : '请稍后再试');
    });
    return () => { active = false; };
  }, [db, reloadKey]);
  useFocusEffect(load);
  return <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
    <Stack.Screen options={{ title: '小组件设置' }} />
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 4 }}>桌面小组件的系统选择器按编号选择分组；这里的自定义名称只用于 App 内管理。</Text>
      {loadError ? (
        <View accessibilityRole="alert" style={{ minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 }}>
          <AppIcon name="alert" size={28} color={colors.danger} />
          <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '700' }}>无法载入小组件分组</Text>
          <Text selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>{loadError}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="重新载入小组件分组"
            onPress={() => setReloadKey((value) => value + 1)}
            style={{ minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>重新加载</Text>
          </TouchableOpacity>
        </View>
      ) : groups === null ? (
        <View style={{ minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>正在载入小组件分组…</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={{ minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 }}>
          <AppIcon name="widget" size={30} color={colors.textMuted} />
          <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '700' }}>暂无小组件分组</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>请重新进入此页面；固定分组会在数据库初始化时自动创建。</Text>
        </View>
      ) : (
        <MenuCard>
          {groups.map((group, index) => (
            <MenuItem
              key={group.slot}
              icon="widget"
              label={`分组 ${group.slot} · ${group.name}`}
              accessibilityLabel={`编辑分组 ${group.slot}，${group.name}`}
              subtitle={`${group.sourceType === 'manual' ? '手动选择' : group.sourceType === 'filter' ? '条件筛选' : '未配置'} · ${group.displayCount} 张`}
              tint={colors.settingsMenu.widget}
              onPress={() => router.push(`/settings/widget/${group.slot}`)}
              isLast={index === groups.length - 1}
            />
          ))}
        </MenuCard>
      )}
    </ScrollView>
  </SafeAreaView>;
}

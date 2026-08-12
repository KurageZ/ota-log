import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { Sortable, SortableItem, type SortableRenderItemProps } from 'react-native-reanimated-dnd';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { SectionLabel } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import {
  STATS_SECTION_LABELS,
  type StatsSectionConfig,
  type StatsSectionType,
  createDefaultStatsPreferences,
  getUnseenStatsSectionTypes,
  loadStatsPreferences,
  markStatsSectionsSeen,
  sanitizeStatsPreferences,
  saveStatsPreferences,
} from '../../src/utils/statsPreferences';
import {
  STATS_SECTION_SORTABLE_ITEM_HEIGHT,
  getStatsSortableHeight,
} from '../../src/utils/statsSettingsLayout';

const STATS_SECTION_ROW_MIN_HEIGHT = 60;
const STATS_SECTION_DISABLED_DIVIDER_ID = 'stats-section-disabled-divider';

type StatsSectionGroup = 'enabled' | 'disabled';
type StatsSettingsSortableItem =
  | { id: StatsSectionType; kind: 'section'; section: StatsSectionConfig }
  | { id: typeof STATS_SECTION_DISABLED_DIVIDER_ID; kind: 'disabledDivider'; disabledCount: number };

export default function StatsSettingsScreen() {
  const { colors } = useAppTheme();
  const [sections, setSections] = useState<StatsSectionConfig[]>([]);
  const [seenSectionTypes, setSeenSectionTypes] = useState<StatsSectionType[]>([]);
  const [newSectionTypes, setNewSectionTypes] = useState<StatsSectionType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const sortableItemsRef = useRef<StatsSettingsSortableItem[]>([]);
  const lastSavedSectionsRef = useRef<StatsSectionConfig[]>([]);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestSaveIdRef = useRef(0);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const preferences = await loadStatsPreferences();
      const unseenTypes = getUnseenStatsSectionTypes(preferences);
      const viewedPreferences = markStatsSectionsSeen(preferences, unseenTypes);
      const groupedSections = groupSections(preferences.sections);

      setSections(groupedSections);
      setSeenSectionTypes(viewedPreferences.seenSectionTypes);
      setNewSectionTypes(unseenTypes);
      lastSavedSectionsRef.current = groupedSections;

      if (unseenTypes.length > 0) {
        try {
          await saveStatsPreferences(viewedPreferences);
        } catch (error) {
          showOperationFailedAlert(
            '无法保存已查看状态。',
            '新内容提示可能会再次出现，请稍后重新打开统计自定义。',
            error,
          );
        }
      }
    } catch (error) {
      showOperationFailedAlert(
        '无法读取统计设置。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再打开。',
        error,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const enabledSections = useMemo(() => sections.filter((section) => section.visible), [sections]);
  const disabledSections = useMemo(() => sections.filter((section) => !section.visible), [sections]);
  const sortableItems = useMemo<StatsSettingsSortableItem[]>(() => [
    ...enabledSections.map(toSortableSectionItem),
    {
      id: STATS_SECTION_DISABLED_DIVIDER_ID,
      kind: 'disabledDivider',
      disabledCount: disabledSections.length,
    },
    ...disabledSections.map(toSortableSectionItem),
  ], [disabledSections, enabledSections]);
  const sortableHeight = getStatsSortableHeight(sortableItems.length);
  const newSectionTypeSet = useMemo(() => new Set(newSectionTypes), [newSectionTypes]);

  useEffect(() => {
    sortableItemsRef.current = sortableItems;
  }, [sortableItems]);

  const persistSections = useCallback(async (nextSections: StatsSectionConfig[]) => {
    const sanitized = sanitizeStatsPreferences({
      sections: nextSections,
      seenSectionTypes,
    });
    const groupedSections = groupSections(sanitized.sections);
    const saveId = ++latestSaveIdRef.current;
    setSections(groupedSections);

    const saveOperation = saveQueueRef.current.then(() => saveStatsPreferences({
        sections: groupedSections,
        seenSectionTypes: sanitized.seenSectionTypes,
      }));
    saveQueueRef.current = saveOperation.catch(() => undefined);

    try {
      await saveOperation;
      lastSavedSectionsRef.current = groupedSections;
    } catch (error) {
      if (saveId === latestSaveIdRef.current) {
        setSections(lastSavedSectionsRef.current);
      }
      showOperationFailedAlert(
        '无法保存统计设置。',
        '本次调整没有保存，请稍后再试一次。',
        error,
      );
    }
  }, [seenSectionTypes]);

  const handleDragStart = useCallback(() => {
    Vibration.vibrate(50);
  }, []);

  const handleSortableDrop = useCallback((id: string, _position: number, allPositions?: Record<string, number>) => {
    if (id === STATS_SECTION_DISABLED_DIVIDER_ID || !allPositions) return;

    const currentItems = sortableItemsRef.current;
    const getPosition = (item: StatsSettingsSortableItem) => (
      allPositions[item.id] ?? currentItems.findIndex((currentItem) => currentItem.id === item.id)
    );
    const sortedItems = [...currentItems].sort((a, b) => getPosition(a) - getPosition(b));
    const dividerIndex = sortedItems.findIndex((item) => item.kind === 'disabledDivider');
    if (dividerIndex < 0) return;

    const nextSections = sortedItems.flatMap((item, index) => {
      if (item.kind !== 'section') return [];
      const group: StatsSectionGroup = index < dividerIndex ? 'enabled' : 'disabled';
      return [{ ...item.section, visible: group === 'enabled' }];
    });

    void persistSections(nextSections);
  }, [persistSections]);

  const handleReset = useCallback(() => {
    Alert.alert('恢复默认', '统计内容会恢复默认顺序，并重新启用全部内容。确认继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复',
        style: 'destructive',
        onPress: () => {
          const defaults = createDefaultStatsPreferences();
          setSeenSectionTypes(defaults.seenSectionTypes);
          setNewSectionTypes([]);
          void persistSections(defaults.sections);
        },
      },
    ]);
  }, [persistSections]);

  const renderSectionRow = useCallback((section: StatsSectionConfig) => {
    const isNew = newSectionTypeSet.has(section.type);
    const titleColor = section.visible ? colors.text : colors.textMuted;

    return (
      <View
        style={{
          minHeight: STATS_SECTION_ROW_MIN_HEIGHT,
          borderRadius: 16,
          backgroundColor: section.visible ? colors.card : colors.cardAlt,
          borderWidth: 1,
          borderColor: colors.divider,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 1,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: STATS_SECTION_ROW_MIN_HEIGHT,
            paddingLeft: 16,
            paddingRight: 8,
            paddingVertical: 8,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: titleColor }}
            >
              {STATS_SECTION_LABELS[section.type]}
            </Text>
            {isNew ? (
              <View
                accessible={false}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  marginLeft: 8,
                  backgroundColor: colors.danger,
                }}
              />
            ) : null}
          </View>

          <SortableItem.Handle>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${STATS_SECTION_LABELS[section.type]}，${isNew ? '新增，' : ''}${section.visible ? '已启用' : '未启用'}，拖动排序`}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="menuDrag" size={24} color={colors.textMuted} />
            </View>
          </SortableItem.Handle>
        </View>
      </View>
    );
  }, [colors, newSectionTypeSet]);

  const renderSortableItem = useCallback((props: SortableRenderItemProps<StatsSettingsSortableItem>) => {
    const { item, id, ...sortableProps } = props;

    if (item.kind === 'disabledDivider') {
      return (
        <SortableItem
          key={id}
          id={id}
          data={item}
          {...sortableProps}
          style={{
            height: STATS_SECTION_SORTABLE_ITEM_HEIGHT,
            justifyContent: item.disabledCount === 0 ? 'center' : 'flex-end',
            paddingBottom: 8,
          }}
        >
          <SortableItem.Handle style={{ width: 0, height: 0, opacity: 0 }}>
            <View />
          </SortableItem.Handle>
          <SectionLabel label="未启用" />
          {item.disabledCount === 0 ? (
            <Text style={{ paddingLeft: 2, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textMuted }}>
              拖拽到这里隐藏内容
            </Text>
          ) : null}
        </SortableItem>
      );
    }

    return (
      <SortableItem
        key={id}
        id={id}
        data={item}
        {...sortableProps}
        onDragStart={handleDragStart}
        onDrop={handleSortableDrop}
        style={{ paddingBottom: 10 }}
      >
        {renderSectionRow(item.section)}
      </SortableItem>
    );
  }, [colors.textMuted, handleDragStart, handleSortableDrop, renderSectionRow]);

  const renderResetAction = useCallback(() => (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={handleReset}
      style={{
        minWidth: 52,
        minHeight: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        backgroundColor: colors.accentSoft,
      }}
      accessibilityLabel="恢复默认统计设置"
    >
      <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.accent }}>
        重置
      </Text>
    </TouchableOpacity>
  ), [colors.accent, colors.accentSoft, handleReset]);

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ headerRight: Platform.OS === 'ios' ? undefined : renderResetAction }} />
      <NativeTextToolbar
        right={{
          label: '重置',
          accessibilityLabel: '恢复默认统计设置',
          onPress: handleReset,
          tintColor: colors.danger,
        }}
      />
      {isLoading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.screen }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel label="已启用" />
          <Sortable
            data={sortableItems}
            renderItem={renderSortableItem}
            itemHeight={STATS_SECTION_SORTABLE_ITEM_HEIGHT}
            itemKeyExtractor={(item) => item.id}
            style={{ height: sortableHeight, backgroundColor: colors.screen }}
            contentContainerStyle={{ paddingBottom: 0 }}
            useFlatList={false}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function toSortableSectionItem(section: StatsSectionConfig): StatsSettingsSortableItem {
  return { id: section.type, kind: 'section', section };
}

function groupSections(sections: StatsSectionConfig[]): StatsSectionConfig[] {
  return [
    ...sections.filter((section) => section.visible),
    ...sections.filter((section) => !section.visible),
  ];
}

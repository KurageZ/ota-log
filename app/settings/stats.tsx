import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
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
import { hapticDragEnd, hapticDragReorder, hapticDragStart, hapticError } from '../../src/utils/haptics';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import {
  DEFAULT_STATS_PERIOD_PRESET,
  STATS_SECTION_LABELS,
  type StatsDefaultPeriodPreset,
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
  const [defaultPeriodPreset, setDefaultPeriodPreset] = useState<StatsDefaultPeriodPreset>(
    DEFAULT_STATS_PERIOD_PRESET,
  );
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
      setDefaultPeriodPreset(viewedPreferences.defaultPeriodPreset);
      setNewSectionTypes(unseenTypes);
      lastSavedSectionsRef.current = groupedSections;

      if (unseenTypes.length > 0) {
        try {
          await saveStatsPreferences(viewedPreferences);
        } catch (error) {
          showOperationFailedAlert(
            '无法更新新内容提示',
            '下次打开时，新内容标记可能再次出现。',
            error,
          );
        }
      }
    } catch (error) {
      showOperationFailedAlert(
        '无法载入统计设置',
        '请稍后再试。如果仍无法载入，请重新启动 App。',
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
      defaultPeriodPreset,
    });
    const groupedSections = groupSections(sanitized.sections);
    const saveId = ++latestSaveIdRef.current;
    setSections(groupedSections);

    const saveOperation = saveQueueRef.current.then(() => saveStatsPreferences({
        sections: groupedSections,
        seenSectionTypes: sanitized.seenSectionTypes,
        defaultPeriodPreset: sanitized.defaultPeriodPreset,
      }));
    saveQueueRef.current = saveOperation.catch(() => undefined);

    try {
      await saveOperation;
      lastSavedSectionsRef.current = groupedSections;
    } catch (error) {
      if (saveId === latestSaveIdRef.current) {
        setSections(lastSavedSectionsRef.current);
      }
      hapticError();
      showOperationFailedAlert(
        '无法保存统计设置',
        '本次更改未保存，请再试一次。',
        error,
      );
    }
  }, [defaultPeriodPreset, seenSectionTypes]);

  const dragDidMoveRef = useRef(false);

  const handleDragStart = useCallback(() => {
    dragDidMoveRef.current = false;
    hapticDragStart();
  }, []);

  const handleDragReorder = useCallback(() => {
    dragDidMoveRef.current = true;
    hapticDragReorder();
  }, []);

  const handleSortableDrop = useCallback((id: string, _position: number, allPositions?: Record<string, number>) => {
    const didMove = dragDidMoveRef.current;
    dragDidMoveRef.current = false;
    if (didMove) {
      hapticDragEnd();
    }
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
    Alert.alert('还原默认设置？', '将还原默认顺序，并显示所有统计内容。', [
      { text: '取消', style: 'cancel' },
      {
        text: '还原',
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
              accessibilityLabel={`${STATS_SECTION_LABELS[section.type]}，${isNew ? '新增，' : ''}${section.visible ? '已显示。拖动可重新排序或隐藏。' : '已隐藏。拖动可重新排序或显示。'}`}
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
          onMove={handleDragReorder}
          style={{
            height: STATS_SECTION_SORTABLE_ITEM_HEIGHT,
            justifyContent: item.disabledCount === 0 ? 'center' : 'flex-end',
            paddingBottom: 8,
          }}
        >
          <SortableItem.Handle style={{ width: 0, height: 0, opacity: 0 }}>
            <View />
          </SortableItem.Handle>
          <SectionLabel label="隐藏" />
          {item.disabledCount === 0 ? (
            <Text style={{ paddingLeft: 2, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textMuted }}>
              拖到此处隐藏
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
        onMove={handleDragReorder}
        onDrop={handleSortableDrop}
        style={{ paddingBottom: 10 }}
      >
        {renderSectionRow(item.section)}
      </SortableItem>
    );
  }, [colors.textMuted, handleDragReorder, handleDragStart, handleSortableDrop, renderSectionRow]);

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
      accessibilityLabel="还原默认统计设置"
    >
      <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.accent }}>
        还原
      </Text>
    </TouchableOpacity>
  ), [colors.accent, colors.accentSoft, handleReset]);

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ headerRight: Platform.OS === 'ios' ? undefined : renderResetAction }} />
      <NativeTextToolbar
        right={{
          label: '还原',
          accessibilityLabel: '还原默认统计设置',
          onPress: handleReset,
          tintColor: colors.accent,
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
          <SectionLabel label="显示" />
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../../../src/components/AppIcon';
import { ChekiDatePicker } from '../../../../src/components/ChekiDatePicker';
import { ChekiWidgetGroupPreviewGrid } from '../../../../src/components/ChekiWidgetGroupPreviewGrid';
import { ChekiWidgetGroupSortableGrid } from '../../../../src/components/ChekiWidgetGroupSortableGrid';
import { FilterSheet, type FilterSection } from '../../../../src/components/FilterSheet';
import { MenuCard, MenuItem, SectionLabel } from '../../../../src/components/SettingsMenu';
import { ModeChoiceButtons, type ModeChoiceOption } from '../../../../src/components/mode-choice-buttons';
import { NativeTextToolbar } from '../../../../src/components/native-text-toolbar';
import { useDB } from '../../../../src/context/DBContext';
import { CHEKI_SPECS, type ChekiSpec } from '../../../../src/domain/chekiSpec';
import { useAppTheme } from '../../../../src/theme/appTheme';
import type { ChekiWidgetFilterRules, ChekiWidgetGroupSource, ChekiWidgetSlot, ResolvedChekiWidgetItem } from '../../../../src/types/chekiWidgetGroups';
import { isChekiWidgetSlot } from '../../../../src/types/chekiWidgetGroups';
import type { Artist, Event } from '../../../../src/types/models';
import { clearChekiWidgetGroupDraft, getChekiWidgetGroupDraft, setChekiWidgetGroupDraft, subscribeChekiWidgetGroupDraft, type ChekiWidgetGroupDraft } from '../../../../src/utils/chekiWidgetGroupDraftStore';
import { countChekiWidgetFilterCategories, createEmptyChekiWidgetFilterRules, describeChekiWidgetFilterRules } from '../../../../src/utils/chekiWidgetGroupPresentation';
import { dismissChekiWidgetSortTutorial, hasDismissedChekiWidgetSortTutorial } from '../../../../src/utils/chekiWidgetGroupUiPreferences';
import type { DateFilter } from '../../../../src/utils/dateFilters';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../../../src/utils/safeArea';

type PhotoItem = { id: string; uri: string; spec: ChekiSpec };
type SourceType = ChekiWidgetGroupSource['type'];

const SOURCE_TYPE_OPTIONS: ReadonlyArray<ModeChoiceOption<SourceType>> = [
  { value: 'manual', label: '手动选择', icon: 'album' },
  { value: 'filter', label: '条件筛选', icon: 'filter' },
];

function cloneFilterRules(rules: ChekiWidgetFilterRules): ChekiWidgetFilterRules {
  return { ...rules, artistIds: [...rules.artistIds], eventIds: [...rules.eventIds], date: rules.date ? { ...rules.date } : null, specs: [...rules.specs] };
}

function sourceHasDefinition(source: ChekiWidgetGroupSource): boolean {
  return source.type === 'manual'
    ? source.itemIds.length > 0
    : countChekiWidgetFilterCategories(source.rules) > 0;
}

export default function ChekiWidgetGroupEditorScreen() {
  const { slot: rawSlot } = useLocalSearchParams<{ slot: string }>();
  const slot = Number(rawSlot) as ChekiWidgetSlot;
  const db = useDB();
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const initialSnapshotRef = useRef('');
  const initializedSlotRef = useRef<ChekiWidgetSlot | null>(null);
  const allowNavigationRef = useRef(false);

  const [draft, setDraft] = useState<ChekiWidgetGroupDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [filterPreviewItems, setFilterPreviewItems] = useState<ResolvedChekiWidgetItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterRulesDraft, setFilterRulesDraft] = useState<ChekiWidgetFilterRules | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState<DateFilter>(null);
  const [saving, setSaving] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [sortTutorialDismissed, setSortTutorialDismissed] = useState<boolean | null>(null);
  const previewSource = draft?.source.type === 'filter' ? draft.source : null;

  useFocusEffect(useCallback(() => {
    if (!isChekiWidgetSlot(slot)) return undefined;
    let active = true;
    void Promise.all([
      db.chekiWidgetGroups.getEditorState(slot),
      db.chekiWidgetGroups.listManualCandidates(),
      db.artists.findAll(),
      db.events.findAll(),
      db.userConfig.getConfig(),
    ]).then(([state, availableItems, availableArtists, availableEvents, userConfig]) => {
      if (!active) return;
      const existing = getChekiWidgetGroupDraft(slot);
      const next: ChekiWidgetGroupDraft = existing ?? { slot, name: state.name, source: state.source ?? { type: 'manual', itemIds: [] } };
      if (!existing) setChekiWidgetGroupDraft(next);
      if (initializedSlotRef.current !== slot) {
        initializedSlotRef.current = slot;
        initialSnapshotRef.current = JSON.stringify(next);
      }
      setDraft(next);
      setLoadError(null);
      setItems(availableItems);
      setArtists(availableArtists);
      setEvents(availableEvents);
      setOshiArtistId(userConfig.oshi_artist_id ?? null);
      if (!existing && state.source?.type === 'filter') setFilterPreviewItems(state.resolvedItems);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : '请稍后再试');
    });
    return () => { active = false; };
  }, [db, slot]));

  useEffect(() => {
    if (!isChekiWidgetSlot(slot)) return undefined;
    return subscribeChekiWidgetGroupDraft(slot, () => {
      const next = getChekiWidgetGroupDraft(slot);
      if (next) setDraft(next);
    });
  }, [slot]);

  useEffect(() => {
    let active = true;
    void hasDismissedChekiWidgetSortTutorial().then((dismissed) => { if (active) setSortTutorialDismissed(dismissed); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!previewSource || countChekiWidgetFilterCategories(previewSource.rules) === 0) {
      setFilterPreviewItems([]);
      setPreviewLoading(false);
      return undefined;
    }
    let active = true;
    setPreviewLoading(true);
    void db.chekiWidgetGroups.previewSource(slot, previewSource).then((nextItems) => {
      if (active) setFilterPreviewItems(nextItems);
    }).catch((error: unknown) => {
      if (active) {
        setFilterPreviewItems([]);
        Alert.alert('无法预览筛选结果', error instanceof Error ? error.message : '请稍后再试');
      }
    }).finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [db, previewSource, slot]);

  const selectedItems = useMemo(() => {
    if (draft?.source.type !== 'manual') return [];
    const byId = new Map(items.map((item) => [item.id, item]));
    return draft.source.itemIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [draft, items]);

  const updateDraft = useCallback((update: Partial<ChekiWidgetGroupDraft>) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...update };
      setChekiWidgetGroupDraft(next);
      return next;
    });
  }, []);

  const updateManualItemIds = useCallback((itemIds: string[]) => {
    setDraft((current) => {
      if (!current || current.source.type !== 'manual') return current;
      const next: ChekiWidgetGroupDraft = { ...current, source: { type: 'manual', itemIds } };
      setChekiWidgetGroupDraft(next);
      return next;
    });
  }, []);

  const isDirty = draft !== null && initialSnapshotRef.current !== JSON.stringify(draft);
  const leave = useCallback(() => {
    const performLeave = () => {
      allowNavigationRef.current = true;
      clearChekiWidgetGroupDraft(slot);
      router.back();
    };
    if (!isDirty) return performLeave();
    Alert.alert('放弃本次修改？', '尚未保存的分组设置将会丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: performLeave },
    ]);
  }, [isDirty, slot]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!isDirty || allowNavigationRef.current) return;
    event.preventDefault();
    Alert.alert('放弃本次修改？', '尚未保存的分组设置将会丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: () => {
        allowNavigationRef.current = true;
        clearChekiWidgetGroupDraft(slot);
        navigation.dispatch(event.data.action);
      } },
    ]);
  }), [isDirty, navigation, slot]);

  const save = async () => {
    const latestDraft = getChekiWidgetGroupDraft(slot) ?? draft;
    if (!latestDraft || saving) return;
    try {
      setSaving(true);
      await db.chekiWidgetGroups.save(slot, { name: latestDraft.name, source: latestDraft.source });
      allowNavigationRef.current = true;
      clearChekiWidgetGroupDraft(slot);
      router.back();
    } catch (error) {
      Alert.alert('无法保存', error instanceof Error ? error.message : '请稍后再试');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => Alert.alert('重置分组？', '将清除名称和内容来源。', [
    { text: '取消', style: 'cancel' },
    { text: '重置', style: 'destructive', onPress: async () => {
      await db.chekiWidgetGroups.reset(slot);
      allowNavigationRef.current = true;
      clearChekiWidgetGroupDraft(slot);
      router.back();
    } },
  ]);

  const dismissSortTutorial = useCallback(() => {
    if (sortTutorialDismissed) return;
    setSortTutorialDismissed(true);
    void dismissChekiWidgetSortTutorial();
  }, [sortTutorialDismissed]);

  if (!isChekiWidgetSlot(slot)) return null;
  if (!draft) {
    return <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: `分组 ${slot}` }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        {loadError ? <>
          <AppIcon name="alert" size={28} color={colors.danger} />
          <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '700' }}>无法载入分组</Text>
          <Text style={{ maxWidth: 280, color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>{loadError}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回小组件设置" onPress={() => router.back()} style={{ minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>返回</Text></TouchableOpacity>
        </> : <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>正在载入分组…</Text>
        </>}
      </View>
    </SafeAreaView>;
  }

  const manualSource = draft.source.type === 'manual' ? draft.source : null;
  const filterSource = draft.source.type === 'filter' ? draft.source : null;
  const filterSummary = filterSource ? describeChekiWidgetFilterRules(
    filterSource.rules,
    new Map(artists.map((artist) => [artist.id, artist.name])),
    new Map(events.map((event) => [event.id, event.title])),
  ) : '';
  const filterCategoryCount = filterSource ? countChekiWidgetFilterCategories(filterSource.rules) : 0;

  const applySourceType = (type: SourceType) => updateDraft({ source: type === 'manual'
    ? { type: 'manual', itemIds: [] }
    : { type: 'filter', rules: createEmptyChekiWidgetFilterRules() } });
  const requestSourceType = (type: SourceType) => {
    if (draft.source.type === type) return;
    if (!sourceHasDefinition(draft.source)) return applySourceType(type);
    Alert.alert('切换内容来源？', '当前选择或筛选条件会被清除。', [
      { text: '取消', style: 'cancel' },
      { text: '切换', style: 'destructive', onPress: () => applySourceType(type) },
    ]);
  };

  const openFilter = () => {
    if (!filterSource) return;
    setFilterRulesDraft(cloneFilterRules(filterSource.rules));
    setFilterVisible(true);
  };
  const updateFilterRulesDraft = (update: Partial<ChekiWidgetFilterRules>) => {
    setFilterRulesDraft((current) => current ? { ...current, ...update } : current);
  };
  const filterSections: FilterSection[] = filterRulesDraft ? [
    {
      key: 'date', title: '日期', value: null, onChange: () => {},
      chipGroups: [{
        key: 'date',
        options: [{ value: 'current_month', label: '本月' }, { value: 'current_year', label: '今年' }, { value: 'custom', label: '自定义' }],
        value: filterRulesDraft.date?.preset ?? null,
        showAllChip: true,
        onChange: (value) => {
          if (value === 'current_month' || value === 'current_year') updateFilterRulesDraft({ date: { preset: value } });
          else if (value === 'custom') {
            const date = filterRulesDraft.date;
            setDatePickerValue(date?.preset === 'custom' ? { mode: 'custom', startDate: date.startDate, endDate: date.endDate } : null);
            setFilterVisible(false);
            setDatePickerVisible(true);
          } else updateFilterRulesDraft({ date: null });
        },
      }],
    },
    {
      key: 'other', title: '其他条件', value: null, onChange: () => {},
      chipGroups: [
        { key: 'favorite', title: '状态', options: [{ value: 'favorite', label: '已收藏' }], values: filterRulesDraft.favoriteOnly ? ['favorite'] : [], multiple: true, showAllChip: true, onValuesChange: (values) => updateFilterRulesDraft({ favoriteOnly: values.includes('favorite') }) },
        { key: 'spec', title: '规格', options: CHEKI_SPECS.map((spec) => ({ value: spec.id, label: spec.label })), values: filterRulesDraft.specs, multiple: true, showAllChip: true, onValuesChange: (values) => updateFilterRulesDraft({ specs: values as ChekiSpec[] }) },
      ],
    },
    {
      key: 'artist', title: '艺人', value: null, values: filterRulesDraft.artistIds, multiple: true,
      onChange: (value) => updateFilterRulesDraft({ artistIds: value ? [value] : [] }),
      onValuesChange: (values) => updateFilterRulesDraft({ artistIds: values }),
      artistSearch: { artists, lookup: artists, oshiArtistId, parentNameMap: Object.fromEntries(artists.map((artist) => [artist.id, artist.name])), placeholder: '搜索艺人…', typePreference: 'person' },
    },
    {
      key: 'event', title: '活动', value: null, values: filterRulesDraft.eventIds, multiple: true,
      onChange: (value) => updateFilterRulesDraft({ eventIds: value ? [value] : [] }),
      onValuesChange: (values) => updateFilterRulesDraft({ eventIds: values }),
      options: events.map((event) => ({ value: event.id, label: event.title })),
    },
  ] : [];

  const resultState = filterCategoryCount === 0 ? 'unconfigured'
    : previewLoading ? 'loading'
      : filterPreviewItems.length === 0 ? 'empty' : 'content';

  return <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
    <Stack.Screen options={{ title: `分组 ${slot}` }} />
    <NativeTextToolbar
      left={{ label: '取消', onPress: leave, disabled: saving }}
      right={{ label: saving ? '保存中' : '保存', onPress: () => void save(), disabled: saving, variant: 'done' }}
    />
    <ChekiWidgetGroupPreviewGrid
      items={filterSource && resultState === 'content' ? filterPreviewItems : []}
      scrollEnabled={!sorting}
      header={<View style={{ gap: 22 }}>
        <View>
          <SectionLabel label="分组名称" />
          <TextInput accessibilityLabel="分组名称" value={draft.name} onChangeText={(name) => updateDraft({ name })} maxLength={20} placeholder="输入分组名称" placeholderTextColor={colors.placeholder} style={{ minHeight: 50, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, fontSize: 16 }} />
        </View>

        <View>
          <SectionLabel label="内容来源" />
          <ModeChoiceButtons colors={colors} options={SOURCE_TYPE_OPTIONS} value={draft.source.type} onChange={requestSourceType} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 2, marginTop: 8 }}>
            {manualSource
              ? '手动选择并调整要在小组件中轮播的拍立得，最多 48 张。'
              : '根据艺人、活动、收藏、日期和规格自动更新符合条件的图片，最多 48 张。'}
          </Text>
        </View>

        {manualSource ? <View style={{ gap: 14 }}>
          <View>
            <SectionLabel label="选择内容" />
            <MenuCard>
              <MenuItem icon="images" label="管理拍立得" subtitle="添加、移除要在小组件中轮播的照片" badge={`${manualSource.itemIds.length}/48`} onPress={() => router.push({ pathname: '/settings/widget/[slot]/select', params: { slot: String(slot) } })} isLast />
            </MenuCard>
          </View>
          <View>
            <SectionLabel label={`当前内容 · ${manualSource.itemIds.length}/48`} />
            {sortTutorialDismissed === false && selectedItems.length >= 2 ? <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: colors.infoSoft }}>
              <AppIcon name="menuDrag" size={19} color={colors.info} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 }}>长按照片拖动，即可调整小组件的轮播顺序。</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="知道了" onPress={dismissSortTutorial} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.info, fontSize: 13, fontWeight: '700' }}>知道了</Text></TouchableOpacity>
            </View> : null}
            <ChekiWidgetGroupSortableGrid itemIds={manualSource.itemIds} items={selectedItems} onChange={updateManualItemIds} onDragStateChange={(dragging) => { setSorting(dragging); if (dragging) dismissSortTutorial(); }} />
          </View>
        </View> : filterSource ? <View style={{ gap: 14 }}>
          <View>
            <SectionLabel label="筛选条件" />
            <MenuCard>
              <MenuItem icon="filter" label="编辑筛选条件" subtitle={filterSummary} badge={filterCategoryCount > 0 ? `${filterCategoryCount} 项` : undefined} onPress={openFilter} isLast />
            </MenuCard>
          </View>
          <View>
            <SectionLabel label={`当前内容 · ${filterPreviewItems.length}/48`} />
            {resultState === 'loading' ? <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10 }}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.textSecondary, fontSize: 13 }}>正在更新筛选结果…</Text></View>
              : resultState === 'unconfigured' ? <View style={{ minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: 8 }}><AppIcon name="filter" size={24} color={colors.textMuted} /><Text style={{ color: colors.textSecondary, fontSize: 13 }}>设置条件后即可预览当前结果</Text></View>
                : resultState === 'empty' ? <View style={{ minHeight: 104, alignItems: 'center', justifyContent: 'center', gap: 8 }}><AppIcon name="emptySearch" size={24} color={colors.textMuted} /><Text style={{ color: colors.textSecondary, fontSize: 13 }}>当前没有符合条件的拍立得</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="调整筛选条件" onPress={openFilter} style={{ minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>调整筛选条件</Text></TouchableOpacity></View>
                  : null}
          </View>
        </View> : null}
      </View>}
      footer={<TouchableOpacity accessibilityRole="button" accessibilityLabel="重置分组" onPress={reset} style={{ minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.danger, textAlign: 'center', fontWeight: '700' }}>重置分组</Text></TouchableOpacity>}
    />

    <FilterSheet
      visible={filterVisible}
      sections={filterSections}
      isDark={isDark}
      onReset={() => setFilterRulesDraft(createEmptyChekiWidgetFilterRules())}
      onClose={() => setFilterVisible(false)}
      onApply={() => { if (filterRulesDraft) updateDraft({ source: { type: 'filter', rules: cloneFilterRules(filterRulesDraft) } }); setFilterVisible(false); }}
    />
    <ChekiDatePicker
      visible={datePickerVisible}
      mode="custom"
      value={datePickerValue}
      onCancel={() => { setDatePickerVisible(false); requestAnimationFrame(() => setFilterVisible(true)); }}
      onClear={() => { updateFilterRulesDraft({ date: null }); setDatePickerVisible(false); requestAnimationFrame(() => setFilterVisible(true)); }}
      onConfirm={(value) => { if (value?.mode === 'custom') updateFilterRulesDraft({ date: { preset: 'custom', startDate: value.startDate, endDate: value.endDate } }); setDatePickerVisible(false); requestAnimationFrame(() => setFilterVisible(true)); }}
    />
  </SafeAreaView>;
}

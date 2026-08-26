import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHEKI_SPECS, type ChekiSpec } from '../domain/chekiSpec';
import { useDB } from '../context/DBContext';
import type { ChekiBrowseItem } from '../repositories/ChekiRecordRepository';
import { useAppTheme } from '../theme/appTheme';
import type { Artist, Event } from '../types/models';
import {
  EMPTY_CHEKI_ITEM_FILTERS,
  cloneChekiItemFilters,
  countChekiItemFilterCategories,
  matchesChekiItemFilters,
  type ChekiItemFilters,
} from '../utils/chekiFilters';
import {
  buildChekiItemSearchIndex,
  matchesChekiSearchIndex,
  tokenizeChekiSearchQuery,
} from '../utils/chekiSearch';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { getArtistSearchText } from '../utils/filter';
import { toggleBatchSelection } from '../utils/filterSelection';
import {
  appendChekiPickerSelection,
  removeChekiPickerSelection,
} from '../utils/chekiPickerSelection';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { AppIcon } from './AppIcon';
import {
  CHEKI_BARE_THUMBNAIL_RADIUS,
  CHEKI_GRID_GAP,
  ChekiGridThumbnail,
  useChekiAlbumGridLayout,
} from './ChekiAlbumThumbnail';
import { ChekiDatePicker, type ChekiDatePickerMode } from './ChekiDatePicker';
import { DateFilterHeader } from './DateFilterHeader';
import { FilterBatchChip } from './FilterBatchChip';
import { FilteredEmptyState } from './FilteredEmptyState';
import { FilterSheet, type FilterChipGroup, type FilterOption, type FilterSection } from './FilterSheet';
import { NativeTextToolbar } from './native-text-toolbar';
import { SearchFilterBar } from './SearchFilterBar';

export interface ChekiPickerItem {
  id: string;
  uri: string;
}

interface IndexedCandidate {
  item: ChekiBrowseItem;
  uri: string;
  searchIndex: string;
}

interface ChekiPickerScreenProps {
  initialSelectedIds: string[];
  maxSelection: number;
  minSelection?: number;
  title?: string;
  presentation?: 'stack' | 'embedded';
  showSelectionSummary?: boolean;
  showSelectAll?: boolean;
  onCancel: () => void;
  onConfirm: (items: ChekiPickerItem[]) => void | Promise<void>;
}

function canUseLiquidGlass(reduceTransparency: boolean) {
  if (Platform.OS !== 'ios' || reduceTransparency) return false;

  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

function HeaderTextAction({
  label,
  disabled,
  loading = false,
  onPress,
}: {
  label: string;
  disabled: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      activeOpacity={0.65}
      disabled={disabled}
      onPress={onPress}
      style={{ minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={{ color: colors.accent, fontSize: 16, fontWeight: label === '完成' ? '700' : '500' }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function EmbeddedGlassTextAction({
  label,
  disabled,
  loading = false,
  onPress,
  usesLiquidGlass,
}: {
  label: string;
  disabled: boolean;
  loading?: boolean;
  onPress: () => void;
  usesLiquidGlass: boolean;
}) {
  const { colors, isDark } = useAppTheme();
  const control = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 64,
        height: 44,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.66 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={{ color: colors.accent, fontSize: 15, fontWeight: label === '完成' ? '700' : '500' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );

  if (usesLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="clear"
        colorScheme={isDark ? 'dark' : 'light'}
        isInteractive
        style={{ minWidth: 64, height: 44, borderRadius: 22, overflow: 'hidden' }}
      >
        {control}
      </GlassView>
    );
  }

  return (
    <View
      style={{
        minWidth: 64,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: colors.card,
        boxShadow: isDark
          ? '0 2px 10px rgba(0,0,0,0.26)'
          : '0 2px 10px rgba(0,0,0,0.08)',
      }}
    >
      {control}
    </View>
  );
}

export function ChekiPickerScreen({
  initialSelectedIds,
  maxSelection,
  minSelection = 0,
  title = '选择拍立得',
  presentation = 'stack',
  showSelectionSummary = true,
  showSelectAll = false,
  onCancel,
  onConfirm,
}: ChekiPickerScreenProps) {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [browseItems, setBrowseItems] = useState<ChekiBrowseItem[]>([]);
  const [artistMap, setArtistMap] = useState<Map<string, Artist>>(new Map());
  const [eventMap, setEventMap] = useState<Map<string, Event>>(new Map());
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState(() => [...initialSelectedIds]);
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<ChekiItemFilters>(() => cloneChekiItemFilters(EMPTY_CHEKI_ITEM_FILTERS));
  const [filterDraft, setFilterDraft] = useState<ChekiItemFilters>(() => cloneChekiItemFilters(EMPTY_CHEKI_ITEM_FILTERS));
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<ChekiDatePickerMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (presentation !== 'embedded' || Platform.OS !== 'ios') return undefined;

    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (active) setReduceTransparency(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, [presentation]);

  const horizontalPadding = Math.max(16, (width - 720) / 2);
  const galleryContentWidth = Math.max(1, Math.min(width, 720) - 32);
  const layout = useChekiAlbumGridLayout({
    density: 'small',
    availableWidth: galleryContentWidth,
    availableHeight: height,
    displayMode: 'portrait',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      db.chekiRecords.findBrowseItems(),
      db.artists.findAll(),
      db.events.findAll(),
      db.userConfig.getConfig(),
    ]).then(([items, artists, events, config]) => {
      if (!active) return;
      const selectableIds = new Set(items.flatMap((item) => (
        item.images.some(({ side }) => side === 'front') ? [item.id] : []
      )));
      setBrowseItems(items);
      setArtistMap(new Map(artists.map((artist) => [artist.id, artist])));
      setEventMap(new Map(events.map((event) => [event.id, event])));
      setOshiArtistId(config.oshi_artist_id);
      setSelectedIds((current) => current.filter((id) => selectableIds.has(id)).slice(0, maxSelection));
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [db, maxSelection, reloadKey]);

  const debouncedKeyword = useDebouncedValue(keyword, 180);
  const searchTokens = useMemo(
    () => tokenizeChekiSearchQuery(debouncedKeyword),
    [debouncedKeyword],
  );
  const candidates = useMemo<IndexedCandidate[]>(() => browseItems.flatMap((item) => {
    const front = item.images.find(({ side }) => side === 'front');
    if (!front) return [];
    const artist = item.record.artist_id ? artistMap.get(item.record.artist_id) : null;
    const event = item.record.event_id ? eventMap.get(item.record.event_id) : null;
    return [{
      item,
      uri: front.photo_uri,
      searchIndex: buildChekiItemSearchIndex({
        date: item.record.date,
        recordNotes: item.record.notes,
        itemNotes: item.notes,
        artistText: artist ? getArtistSearchText(artist, artistMap) : null,
        eventTitle: event?.title ?? null,
      }),
    }];
  }), [artistMap, browseItems, eventMap]);
  const filteredCandidates = useMemo(
    () => candidates.filter(({ item, searchIndex }) => (
      matchesChekiItemFilters(item, filters)
      && matchesChekiSearchIndex(searchIndex, searchTokens)
    )),
    [candidates, filters, searchTokens],
  );
  const selectedIndexById = useMemo(
    () => new Map(selectedIds.map((id, index) => [id, index])),
    [selectedIds],
  );
  const activeFilterCount = useMemo(() => countChekiItemFilterCategories(filters), [filters]);
  const hasKeyword = keyword.trim().length > 0;
  const hasAnyFilter = hasKeyword || activeFilterCount > 0;
  const canConfirm = !loading
    && !loadError
    && !submitting
    && selectedIds.length >= minSelection;
  const allVisibleSelected = filteredCandidates.length > 0
    && filteredCandidates.every(({ item }) => selectedIndexById.has(item.id));
  const someVisibleSelected = filteredCandidates.some(({ item }) => selectedIndexById.has(item.id));
  const selectAllDisabled = filteredCandidates.length === 0
    || selectedIds.length >= maxSelection
    || allVisibleSelected;
  const selectAllLabel = selectedIds.length >= maxSelection
    ? '已达上限'
    : allVisibleSelected
      ? '已全选'
      : '全选';

  const distinctArtists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { item } of candidates) {
      const artistId = item.record.artist_id;
      if (artistId) counts.set(artistId, (counts.get(artistId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .flatMap(([id, count]) => {
        const artist = artistMap.get(id);
        return artist ? [{ artist, count }] : [];
      })
      .sort((left, right) => right.count - left.count || left.artist.name.localeCompare(right.artist.name))
      .map(({ artist }) => artist);
  }, [artistMap, candidates]);
  const artistNameMap = useMemo(
    () => Object.fromEntries([...artistMap.values()].map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [artistMap],
  );
  const favoriteArtistIds = useMemo(
    () => [...artistMap.values()].filter((artist) => artist.is_favorite === 1).map((artist) => artist.id),
    [artistMap],
  );
  const toggleArtistBatch = useCallback((batch: string[]) => {
    setFilterDraft((current) => ({
      ...current,
      artistIds: toggleBatchSelection(current.artistIds, batch),
    }));
  }, []);
  const filterSections = useMemo<FilterSection[]>(() => {
    const quickOptions: FilterOption[] = [
      { value: 'linked', label: '已关联活动' },
      { value: 'with_notes', label: '有备注' },
      { value: 'favorite', label: '已收藏' },
      { value: 'with_back', label: '有背签' },
    ];
    const otherGroups: FilterChipGroup[] = [
      {
        key: 'quick',
        multiple: true,
        values: [
          ...(filterDraft.hasLinkedEvent ? ['linked'] : []),
          ...(filterDraft.hasNotes ? ['with_notes'] : []),
          ...(filterDraft.isFavorite ? ['favorite'] : []),
          ...(filterDraft.hasBackImage ? ['with_back'] : []),
        ],
        onValuesChange: (values) => {
          const selected = new Set(values);
          setFilterDraft((current) => ({
            ...current,
            hasLinkedEvent: selected.has('linked'),
            hasNotes: selected.has('with_notes'),
            isFavorite: selected.has('favorite'),
            hasBackImage: selected.has('with_back'),
          }));
        },
        showAllChip: true,
        options: quickOptions,
      },
      {
        key: 'spec',
        title: '规格',
        multiple: true,
        values: filterDraft.specs,
        onValuesChange: (values) => setFilterDraft((current) => ({
          ...current,
          specs: values as ChekiSpec[],
        })),
        showAllChip: true,
        options: CHEKI_SPECS.map((spec) => ({ value: spec.id, label: spec.label })),
      },
    ];
    const oshiSelected = Boolean(oshiArtistId && filterDraft.artistIds.includes(oshiArtistId));
    const favoritesSelected = favoriteArtistIds.length > 0
      && favoriteArtistIds.every((id) => filterDraft.artistIds.includes(id));
    const artistSearchArtists = [...distinctArtists];
    const artistSearchArtistIds = new Set(artistSearchArtists.map((artist) => artist.id));
    for (const artistId of filterDraft.artistIds) {
      const artist = artistMap.get(artistId);
      if (artist && !artistSearchArtistIds.has(artistId)) artistSearchArtists.push(artist);
    }

    return [
      {
        key: 'other',
        title: '其他条件',
        value: null,
        onChange: () => {},
        options: [],
        chipGroups: otherGroups,
      },
      {
        key: 'artist',
        title: '艺人',
        value: null,
        values: filterDraft.artistIds,
        multiple: true,
        onChange: (value) => setFilterDraft((current) => ({ ...current, artistIds: value ? [value] : [] })),
        onValuesChange: (artistIds) => setFilterDraft((current) => ({ ...current, artistIds })),
        beforeContent: (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <FilterBatchChip
              label="单推"
              onPress={() => toggleArtistBatch(oshiArtistId ? [oshiArtistId] : [])}
              disabled={!oshiArtistId}
              selected={oshiSelected}
            />
            <FilterBatchChip
              label="收藏艺人"
              onPress={() => toggleArtistBatch(favoriteArtistIds)}
              disabled={favoriteArtistIds.length === 0}
              selected={favoritesSelected}
            />
          </View>
        ),
        artistSearch: {
          artists: artistSearchArtists,
          lookup: [...artistMap.values()],
          oshiArtistId,
          parentNameMap: artistNameMap,
          placeholder: '搜索艺人…',
          typePreference: 'person',
        },
      },
    ];
  }, [artistMap, artistNameMap, distinctArtists, favoriteArtistIds, filterDraft, oshiArtistId, toggleArtistBatch]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidateId) => candidateId !== id);
      if (current.length >= maxSelection) return current;
      return [...current, id];
    });
  }, [maxSelection]);
  const selectAllVisible = useCallback(() => {
    setSelectedIds((current) => appendChekiPickerSelection(
      current,
      filteredCandidates.map(({ item }) => item.id),
      maxSelection,
    ));
  }, [filteredCandidates, maxSelection]);
  const cancelAllVisible = useCallback(() => {
    setSelectedIds((current) => removeChekiPickerSelection(
      current,
      filteredCandidates.map(({ item }) => item.id),
    ));
  }, [filteredCandidates]);
  const confirm = useCallback(async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const candidateById = new Map(candidates.map((candidate) => [candidate.item.id, candidate]));
      const selected = selectedIds.flatMap((id) => {
        const candidate = candidateById.get(id);
        return candidate ? [{ id, uri: candidate.uri }] : [];
      });
      await onConfirm(selected);
    } finally {
      setSubmitting(false);
    }
  }, [canConfirm, candidates, onConfirm, selectedIds]);
  const openFilters = useCallback(() => {
    setFilterDraft(cloneChekiItemFilters(filters));
    setFilterVisible(true);
  }, [filters]);
  const clearCurrentSearchOrFilters = useCallback(() => {
    if (keyword.trim()) setKeyword('');
    else setFilters(cloneChekiItemFilters(EMPTY_CHEKI_ITEM_FILTERS));
  }, [keyword]);
  const usesLiquidGlass = canUseLiquidGlass(reduceTransparency);

  const androidHeaderOptions = Platform.OS === 'ios' ? {} : {
    headerLeft: () => (
      <HeaderTextAction label="取消" disabled={submitting} onPress={onCancel} />
    ),
    headerRight: () => (
      <HeaderTextAction
        label="完成"
        disabled={!canConfirm}
        loading={submitting}
        onPress={() => void confirm()}
      />
    ),
  };

  const listHeader = (
    <View style={{ paddingTop: 12, paddingBottom: 10 }}>
      <SearchFilterBar
        keyword={keyword}
        onKeywordChange={setKeyword}
        placeholder="搜索艺人、活动或备注等关键词"
        onOpenFilter={openFilters}
        activeCount={activeFilterCount}
        showActiveFilters={false}
        clearButtonBehavior="custom"
        filterExpanded={filterVisible}
        isDark={isDark}
      />
      {showSelectionSummary || showSelectAll ? (
        <View style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: showSelectAll ? 12 : 0,
          paddingRight: showSelectAll ? 4 : 0,
          borderRadius: showSelectAll ? 12 : 0,
          borderCurve: 'continuous',
          backgroundColor: showSelectAll ? colors.cardMuted : 'transparent',
        }}>
          {showSelectionSummary ? (
            <Text
              numberOfLines={1}
              ellipsizeMode="clip"
              style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}
            >
              已选 {selectedIds.length}/{maxSelection}{hasAnyFilter ? ` · 当前 ${filteredCandidates.length} 张` : ''}
            </Text>
          ) : <View style={{ flex: 1 }} />}
          {showSelectAll ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={hasAnyFilter ? '取消全选当前搜索或筛选结果' : '取消全选全部拍立得'}
              accessibilityState={{ disabled: !someVisibleSelected }}
              activeOpacity={0.7}
              disabled={!someVisibleSelected}
              onPress={cancelAllVisible}
              style={{
                minHeight: 44,
                paddingHorizontal: 8,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: someVisibleSelected ? 1 : 0.7,
              }}
            >
              <Text style={{ color: someVisibleSelected ? colors.textSecondary : colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                {hasAnyFilter ? '取消当前' : '取消全选'}
              </Text>
            </TouchableOpacity>
            <View style={{ width: 1, height: 18, backgroundColor: colors.divider }} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={hasAnyFilter ? '全选当前搜索或筛选结果' : '全选全部拍立得'}
              accessibilityState={{ disabled: selectAllDisabled }}
              activeOpacity={0.7}
              disabled={selectAllDisabled}
              onPress={selectAllVisible}
              style={{
                minHeight: 44,
                paddingHorizontal: 8,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: selectAllDisabled ? 0.7 : 1,
              }}
            >
              <Text style={{ color: selectAllDisabled ? colors.textMuted : colors.accent, fontSize: 13, fontWeight: '700' }}>
                {hasAnyFilter && selectAllLabel === '全选' ? '全选当前' : selectAllLabel}
              </Text>
            </TouchableOpacity>
          </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const routeChrome = presentation === 'stack' ? (
    <>
      <Stack.Screen
        options={{
          title,
          headerShown: true,
          ...androidHeaderOptions,
        }}
      />
      <NativeTextToolbar
        left={{ label: '取消', onPress: onCancel, disabled: submitting }}
        right={{ label: '完成', onPress: () => void confirm(), disabled: !canConfirm, variant: 'done' }}
      />
    </>
  ) : (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.screen }}>
      <View
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          gap: 8,
        }}
      >
        <View style={{ width: 72, alignItems: 'flex-start' }}>
          {Platform.OS === 'ios' ? (
            <EmbeddedGlassTextAction
              label="取消"
              disabled={submitting}
              onPress={onCancel}
              usesLiquidGlass={usesLiquidGlass}
            />
          ) : (
            <HeaderTextAction label="取消" disabled={submitting} onPress={onCancel} />
          )}
        </View>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: colors.heading, fontSize: 17, fontWeight: '700', textAlign: 'center' }}
        >
          {title}
        </Text>
        <View style={{ width: 72, alignItems: 'flex-end' }}>
          {Platform.OS === 'ios' ? (
            <EmbeddedGlassTextAction
              label="完成"
              disabled={!canConfirm}
              loading={submitting}
              onPress={() => void confirm()}
              usesLiquidGlass={usesLiquidGlass}
            />
          ) : (
            <HeaderTextAction
              label="完成"
              disabled={!canConfirm}
              loading={submitting}
              onPress={() => void confirm()}
            />
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      {routeChrome}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>正在读取拍立得…</Text>
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingBottom: insets.bottom + 28, gap: 12 }}>
          <AppIcon name="alert" size={34} color={colors.danger} />
          <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '800' }}>无法读取拍立得</Text>
          <Text selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
            {loadError}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.72}
            onPress={() => setReloadKey((value) => value + 1)}
            style={{ minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent }}
          >
            <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>重新加载</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={`cheki-picker-${layout.columns}`}
          contentInsetAdjustmentBehavior="automatic"
          data={filteredCandidates}
          keyExtractor={({ item }) => item.id}
          numColumns={layout.columns}
          columnWrapperStyle={{ gap: CHEKI_GRID_GAP }}
          contentContainerStyle={{
            flexGrow: filteredCandidates.length === 0 ? 1 : undefined,
            paddingHorizontal: horizontalPadding,
            paddingBottom: 24,
            gap: CHEKI_GRID_GAP,
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          ListEmptyComponent={hasAnyFilter ? (
            <FilteredEmptyState
              title="没有符合条件的拍立得"
              message="尝试调整搜索或筛选条件。"
              onClear={clearCurrentSearchOrFilters}
              clearLabel={hasKeyword ? '清除搜索' : '清除筛选'}
              isDark={isDark}
              paddingTop={56}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
              <AppIcon name="images" size={40} color={colors.textMuted} />
              <Text style={{ color: colors.heading, fontSize: 18, fontWeight: '800' }}>还没有正面照片</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
                请先在电子切册中为拍立得添加正面照片。
              </Text>
            </View>
          )}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          windowSize={7}
          renderItem={({ item: candidate }) => {
            const selectedIndex = selectedIndexById.get(candidate.item.id);
            const selected = selectedIndex != null;
            const disabled = !selected && selectedIds.length >= maxSelection;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={selected ? `已选第 ${selectedIndex + 1} 张拍立得` : '选择拍立得'}
                accessibilityState={{ selected, disabled }}
                activeOpacity={0.72}
                disabled={disabled}
                onPress={() => toggleSelection(candidate.item.id)}
                style={{
                  width: layout.itemWidth,
                  height: layout.itemHeight,
                  overflow: 'hidden',
                  borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
                  borderCurve: 'continuous',
                  opacity: disabled ? 0.32 : 1,
                }}
              >
                <ChekiGridThumbnail
                  uri={candidate.uri}
                  width={layout.itemWidth}
                  height={layout.itemHeight}
                  colors={colors}
                  variant="portrait"
                />
                {selected ? (
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderWidth: 3,
                      borderColor: colors.accent,
                      borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
                      borderCurve: 'continuous',
                    }}
                  />
                ) : null}
                {selected ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      width: 27,
                      height: 27,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.accent,
                      boxShadow: '0 2px 7px rgba(0, 0, 0, 0.24)',
                    }}
                  >
                    <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                      {selectedIndex + 1}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <FilterSheet
        visible={filterVisible}
        sections={filterSections}
        isDark={isDark}
        header={(
          <DateFilterHeader
            value={filterDraft.date}
            onSelectMode={(mode) => {
              setFilterVisible(false);
              setDatePickerMode(mode);
            }}
          />
        )}
        onReset={() => setFilterDraft(cloneChekiItemFilters(EMPTY_CHEKI_ITEM_FILTERS))}
        onClose={() => setFilterVisible(false)}
        onApply={() => {
          setFilters(cloneChekiItemFilters(filterDraft));
          setFilterVisible(false);
        }}
      />
      <ChekiDatePicker
        visible={datePickerMode != null}
        mode={datePickerMode ?? 'day'}
        value={filterDraft.date}
        onCancel={() => {
          setDatePickerMode(null);
          requestAnimationFrame(() => setFilterVisible(true));
        }}
        onClear={() => {
          setFilterDraft((current) => ({ ...current, date: null }));
          setDatePickerMode(null);
          requestAnimationFrame(() => setFilterVisible(true));
        }}
        onConfirm={(date) => {
          setFilterDraft((current) => ({ ...current, date }));
          setDatePickerMode(null);
          requestAnimationFrame(() => setFilterVisible(true));
        }}
      />
    </View>
  );
}

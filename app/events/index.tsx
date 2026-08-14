import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useDB } from '../../src/context/DBContext';
import type { Artist, Event, EventStatus } from '../../src/types/models';
import { EventCard } from '../../src/components/EventCard';
import { EventSectionHeader } from '../../src/components/EventSectionHeader';
import { getEventCardOshiBadge } from '../../src/utils/oshiMatch';
import { useAppTheme } from '../../src/theme/appTheme';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { STATUS_LABELS, STATUS_VALUES } from '../../src/utils/labels';
import { useDebouncedValue } from '../../src/utils/useDebouncedValue';
import { SearchFilterBar } from '../../src/components/SearchFilterBar';
import {
  FilterSheet,
  type FilterChipGroup,
  type FilterOption,
  type FilterSection,
} from '../../src/components/FilterSheet';
import { FilteredEmptyState } from '../../src/components/FilteredEmptyState';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeAddToolbar } from '../../src/components/native-add-toolbar';
import type { EventFilter } from '../../src/repositories/EventRepository';
import { buildEventMonthSections } from '../../src/utils/eventSections';
import { ChekiDatePicker, type ChekiDatePickerMode } from '../../src/components/ChekiDatePicker';
import { DateFilterHeader } from '../../src/components/DateFilterHeader';
import { FilterBatchChip } from '../../src/components/FilterBatchChip';
import {
  buildEventDeepLinkState,
  cloneEventListFilters,
  countEventFilterCategories,
  EMPTY_EVENT_LIST_FILTERS,
  type EventFilterRouteParams,
  type EventListFilters,
} from '../../src/utils/eventFilters';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import { toggleBatchSelection } from '../../src/utils/filterSelection';

const IS_IOS = process.env.EXPO_OS === 'ios';
const SCORE_OPTIONS = [5, 4, 3, 2, 1];

let sessionFilters = cloneEventListFilters(EMPTY_EVENT_LIST_FILTERS);
let sessionKeyword = '';

function toRepositoryFilter(keyword: string, filters: EventListFilters): EventFilter {
  return {
    keyword: keyword.trim() || undefined,
    startDate: filters.date?.startDate,
    endDate: filters.date?.endDate,
    statuses: filters.statuses,
    artistIds: filters.artistIds,
    artistScope: filters.artistScope ?? undefined,
    minScore: filters.minScore ?? undefined,
    hasNotes: filters.hasNotes,
    hasSetlist: filters.hasSetlist,
    hasTimetable: filters.hasTimetable,
    hasPhotos: filters.hasPhotos,
    hasCheki: filters.hasCheki,
  };
}

export default function EventsIndexScreen() {
  const db = useDB();
  const router = useRouter();
  const params = useLocalSearchParams() as EventFilterRouteParams;
  const { colors, isDark } = useAppTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectableArtistIds, setSelectableArtistIds] = useState<string[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [supportingDataHydrated, setSupportingDataHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeywordState] = useState(sessionKeyword);
  const [filters, setFiltersState] = useState<EventListFilters>(() => cloneEventListFilters(sessionFilters));
  const [draftFilters, setDraftFilters] = useState<EventListFilters>(() => cloneEventListFilters(sessionFilters));
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<ChekiDatePickerMode | null>(null);
  const consumedDeepLinkRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const debouncedKeyword = useDebouncedValue(keyword, 250);

  const setKeyword = useCallback((value: string) => {
    sessionKeyword = value;
    setKeywordState(value);
  }, []);
  const setAppliedFilters = useCallback((value: EventListFilters) => {
    const next = cloneEventListFilters(value);
    sessionFilters = cloneEventListFilters(next);
    setFiltersState(next);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([
      db.artists.findAll(),
      db.events.findDistinctArtistIds(),
      db.userConfig.getConfig(),
    ]).then(([allArtists, eventArtistIds, config]) => {
      if (!active) return;
      setArtists(allArtists);
      setSelectableArtistIds(eventArtistIds);
      setOshiArtistId(config.oshi_artist_id);
      setSupportingDataHydrated(true);
    });
    return () => { active = false; };
  }, [db]));

  const deepLinkSignature = JSON.stringify([
    params.keyword, params.city, params.venue, params.status,
    params.artist_id, params.year, params.month, params.startDate, params.endDate,
    params.min_score, params.scope,
  ]);
  useEffect(() => {
    if (!supportingDataHydrated || consumedDeepLinkRef.current === deepLinkSignature) return;
    const favoriteArtistIds = artists.filter((artist) => artist.is_favorite === 1).map((artist) => artist.id);
    const incoming = buildEventDeepLinkState(params, { favoriteArtistIds, oshiArtistId, selectableArtistIds });
    consumedDeepLinkRef.current = deepLinkSignature;
    if (!incoming.hasDeepLink) return;
    setAppliedFilters(incoming.filters);
    setDraftFilters(cloneEventListFilters(incoming.filters));
    setKeyword(incoming.keyword);
    router.setParams({
      keyword: '', city: '', venue: '', status: '', artist_id: '',
      year: '', month: '', startDate: '', endDate: '', min_score: '', scope: '',
    });
  }, [
    artists,
    deepLinkSignature,
    oshiArtistId,
    params,
    router,
    selectableArtistIds,
    setAppliedFilters,
    setKeyword,
    supportingDataHydrated,
  ]);

  const repositoryFilter = useMemo(
    () => toRepositoryFilter(debouncedKeyword, filters),
    [debouncedKeyword, filters],
  );
  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const nextEvents = await db.events.findFiltered(repositoryFilter);
    if (requestId === loadRequestIdRef.current) setEvents(nextEvents);
  }, [db, repositoryFilter]);
  useEffect(() => () => { loadRequestIdRef.current += 1; }, []);
  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const selectableArtistSet = useMemo(() => new Set(selectableArtistIds), [selectableArtistIds]);
  const artistMap = useMemo(() => new Map(artists.map((artist) => [artist.id, artist])), [artists]);
  const selectableArtists = useMemo(
    () => selectableArtistIds.flatMap((artistId) => {
      const artist = artistMap.get(artistId);
      return artist ? [artist] : [];
    }),
    [artistMap, selectableArtistIds],
  );
  const favoriteArtistIds = useMemo(
    () => selectableArtists.filter((artist) => artist.is_favorite === 1).map((artist) => artist.id),
    [selectableArtists],
  );
  const artistParentNameMap = useMemo(
    () => Object.fromEntries(artists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [artists],
  );
  const toggleArtistBatch = useCallback((batch: string[]) => {
    setDraftFilters((current) => {
      return {
        ...current,
        artistIds: toggleBatchSelection(current.artistIds, batch),
        artistScope: null,
      };
    });
  }, []);

  const otherChipGroups = useMemo<FilterChipGroup[]>(() => {
    const quickOptions: FilterOption[] = [
      { value: 'notes', label: '有备注' },
      { value: 'setlist', label: '有 Setlist' },
      { value: 'timetable', label: '有时间表' },
      { value: 'photos', label: '有资料图' },
      { value: 'cheki', label: '有拍立得' },
    ];
    return [
      {
        key: 'status',
        title: '状态',
        multiple: true,
        values: draftFilters.statuses,
        onValuesChange: (values) => setDraftFilters((current) => ({
          ...current,
          statuses: values.filter((value): value is EventStatus => STATUS_VALUES.includes(value as EventStatus)),
        })),
        showAllChip: true,
        options: STATUS_VALUES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
      },
      {
        key: 'score',
        title: '最低评分',
        value: draftFilters.minScore == null ? null : String(draftFilters.minScore),
        onChange: (value) => setDraftFilters((current) => ({ ...current, minScore: value ? Number(value) : null })),
        showAllChip: true,
        options: SCORE_OPTIONS.map((score) => ({ value: String(score), label: score === 5 ? '★5' : `★${score}+` })),
      },
      {
        key: 'more',
        title: '内容',
        multiple: true,
        values: [
          ...(draftFilters.hasNotes ? ['notes'] : []),
          ...(draftFilters.hasSetlist ? ['setlist'] : []),
          ...(draftFilters.hasTimetable ? ['timetable'] : []),
          ...(draftFilters.hasPhotos ? ['photos'] : []),
          ...(draftFilters.hasCheki ? ['cheki'] : []),
        ],
        onValuesChange: (values) => {
          const selected = new Set(values);
          setDraftFilters((current) => ({
            ...current,
            hasNotes: selected.has('notes'),
            hasSetlist: selected.has('setlist'),
            hasTimetable: selected.has('timetable'),
            hasPhotos: selected.has('photos'),
            hasCheki: selected.has('cheki'),
          }));
        },
        showAllChip: true,
        options: quickOptions,
      },
    ];
  }, [draftFilters]);

  const filterSections = useMemo<FilterSection[]>(() => {
    const oshiBatch = oshiArtistId && selectableArtistSet.has(oshiArtistId) ? [oshiArtistId] : [];
    const oshiSelected = oshiBatch.length > 0 && oshiBatch.every((artistId) => draftFilters.artistIds.includes(artistId));
    const favoritesSelected = favoriteArtistIds.length > 0
      && favoriteArtistIds.every((artistId) => draftFilters.artistIds.includes(artistId));
    return [
      {
        key: 'other',
        title: '其他条件',
        value: null,
        onChange: () => {},
        options: [],
        chipGroups: otherChipGroups,
      },
      {
        key: 'artist',
        title: '艺人',
        value: null,
        values: draftFilters.artistIds,
        multiple: true,
        onChange: (value) => setDraftFilters((current) => ({
          ...current,
          artistIds: value ? [value] : [],
          artistScope: null,
        })),
        onValuesChange: (artistIds) => setDraftFilters((current) => ({ ...current, artistIds, artistScope: null })),
        beforeContent: (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <FilterBatchChip
              label="单推"
              selected={oshiSelected}
              disabled={oshiBatch.length === 0}
              onPress={() => toggleArtistBatch(oshiBatch)}
            />
            <FilterBatchChip
              label="收藏艺人"
              selected={favoritesSelected}
              disabled={favoriteArtistIds.length === 0}
              onPress={() => toggleArtistBatch(favoriteArtistIds)}
            />
          </View>
        ),
        artistSearch: {
          artists: selectableArtists,
          lookup: artists,
          oshiArtistId,
          parentNameMap: artistParentNameMap,
          placeholder: '搜索艺人…',
          typePreference: 'group',
        },
      },
    ];
  }, [
    artistParentNameMap,
    artists,
    draftFilters.artistIds,
    favoriteArtistIds,
    oshiArtistId,
    otherChipGroups,
    selectableArtistSet,
    selectableArtists,
    toggleArtistBatch,
  ]);

  const filterHeader = (
    <DateFilterHeader
      value={draftFilters.date}
      onSelectMode={(mode) => {
        setFilterVisible(false);
        setDatePickerMode(mode);
      }}
    />
  );

  const activeFilterCount = countEventFilterCategories(filters);
  const hasAnyFilter = keyword.trim().length > 0 || activeFilterCount > 0;
  const sections = useMemo(() => buildEventMonthSections(events), [events]);
  const clearAll = useCallback(() => {
    setKeyword('');
    setAppliedFilters(EMPTY_EVENT_LIST_FILTERS);
    setDraftFilters(cloneEventListFilters(EMPTY_EVENT_LIST_FILTERS));
  }, [setAppliedFilters, setKeyword]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '所有活动',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.header },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.heading, fontWeight: '700' },
          headerRight: IS_IOS ? undefined : () => (
            <TouchableOpacity
              onPress={() => router.push('/events/compose')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ paddingRight: 4 }}
              accessibilityLabel="新建活动"
              accessibilityRole="button"
            >
              <AppIcon name="add" size={24} color={colors.accent} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SearchFilterBar
            keyword={keyword}
            onKeywordChange={setKeyword}
            placeholder="搜索活动、艺人、场次或内容"
            onOpenFilter={() => {
              setDraftFilters(cloneEventListFilters(filters));
              setFilterVisible(true);
            }}
            showActiveFilters={false}
            activeCount={activeFilterCount}
            isDark={isDark}
          />
          {events.length > 0 ? (
            <Text style={{ marginBottom: 10, fontSize: 12.5, color: colors.textSecondary }}>
              共 {events.length} 场活动
            </Text>
          ) : null}
        </View>

        <SectionList
          contentInsetAdjustmentBehavior="automatic"
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          renderSectionHeader={({ section }) => (
            <EventSectionHeader title={section.title} count={section.data.length} colors={colors} />
          )}
          renderItem={({ item }) => (
            <EventCard event={item} oshiBadge={getEventCardOshiBadge(item.status, null)} />
          )}
          ListEmptyComponent={!refreshing ? (
            hasAnyFilter ? (
              <FilteredEmptyState
                title="没有符合条件的活动"
                onClear={clearAll}
                clearLabel="清除全部"
                isDark={isDark}
              />
            ) : (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <AppIcon name="eventDate" size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 }}>还没有活动</Text>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>新建活动后会出现在这里</Text>
              </View>
            )
          ) : null}
        />

        <FilterSheet
          visible={filterVisible}
          sections={filterSections}
          isDark={isDark}
          header={filterHeader}
          onReset={() => setDraftFilters(cloneEventListFilters(EMPTY_EVENT_LIST_FILTERS))}
          onClose={() => setFilterVisible(false)}
          onApply={() => {
            setAppliedFilters(draftFilters);
            setFilterVisible(false);
          }}
        />
        <ChekiDatePicker
          visible={datePickerMode != null}
          mode={datePickerMode ?? 'day'}
          value={draftFilters.date}
          onCancel={() => {
            setDatePickerMode(null);
            requestAnimationFrame(() => setFilterVisible(true));
          }}
          onClear={() => {
            setDraftFilters((current) => ({ ...current, date: null }));
            setDatePickerMode(null);
            requestAnimationFrame(() => setFilterVisible(true));
          }}
          onConfirm={(date) => {
            setDraftFilters((current) => ({ ...current, date }));
            setDatePickerMode(null);
            requestAnimationFrame(() => setFilterVisible(true));
          }}
        />
      </SafeAreaView>
      {IS_IOS ? <NativeAddToolbar accessibilityLabel="新建活动" onPress={() => router.push('/events/compose')} /> : null}
    </>
  );
}

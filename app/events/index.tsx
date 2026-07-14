import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useDB } from '../../src/context/DBContext';
import { Artist, Event, EventStatus } from '../../src/types/models';
import { EventCard } from '../../src/components/EventCard';
import { EventSectionHeader } from '../../src/components/EventSectionHeader';
import { getEventCardOshiBadge } from '../../src/utils/oshiMatch';
import { useAppTheme, type ThemeColors } from '../../src/theme/appTheme';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { STATUS_LABELS, STATUS_VALUES } from '../../src/utils/labels';
import { useDebouncedValue } from '../../src/utils/useDebouncedValue';
import { SearchFilterBar } from '../../src/components/SearchFilterBar';
import { FilterSheet, FilterSection } from '../../src/components/FilterSheet';
import { FilteredEmptyState } from '../../src/components/FilteredEmptyState';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeAddToolbar } from '../../src/components/native-add-toolbar';
import type { EventFilter } from '../../src/repositories/EventRepository';
import { buildEventMonthSections } from '../../src/utils/eventSections';
import { getArtistSearchText, sortArtistsWithOshi } from '../../src/utils/filter';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const EVENT_FILTER_HISTORY_STORAGE_KEY = 'ota-log.events-filter-history.v1';
const IS_IOS = process.env.EXPO_OS === 'ios';

type PeriodHistoryPill = {
  id: string;
  kind: 'period';
  label: string;
  year: number;
  month?: number;
};

type ValueHistoryPill = {
  id: string;
  kind: 'city' | 'venue';
  label: string;
  value: string;
};

type ArtistHistoryPill = {
  id: string;
  kind: 'artist';
  label: string;
  artistId: string;
};

type StatusHistoryPill = {
  id: string;
  kind: 'status';
  label: string;
  status: EventStatus;
};

type ScoreHistoryPill = {
  id: string;
  kind: 'score';
  label: string;
  minScore: number;
};

type ScopeHistoryPill = {
  id: string;
  kind: 'scope';
  label: string;
  scope: 'favorite' | 'oshi';
};

type DetailHistoryPill =
  | PeriodHistoryPill
  | ValueHistoryPill
  | ArtistHistoryPill
  | StatusHistoryPill
  | ScoreHistoryPill
  | ScopeHistoryPill;

const SCORE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '5', label: '★5' },
  { value: '4', label: '★4+' },
  { value: '3', label: '★3+' },
];

const SCOPE_OPTIONS: Array<{ value: 'favorite' | 'oshi'; label: string }> = [
  { value: 'favorite', label: '收藏' },
  { value: 'oshi', label: '单推' },
];

function scoreLabel(minScore: number): string {
  return minScore >= 5 ? '★5' : `★${minScore}+`;
}

function scopeLabel(scope: 'favorite' | 'oshi'): string {
  return scope === 'oshi' ? '单推' : '收藏';
}

function parseArtistIdsParam(value: string | string[] | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(rawValues
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean))];
}

function serializeArtistIdsParam(values: string[]): string {
  return [...new Set(values)].join(',');
}

function parseStoredFilterHistory(rawValue: string | null): DetailHistoryPill[] {
  if (!rawValue) return [];

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): DetailHistoryPill[] => {
      if (!item || typeof item !== 'object') return [];
      if (!('id' in item) || !('kind' in item) || !('label' in item)) return [];
      if (typeof item.id !== 'string' || typeof item.kind !== 'string' || typeof item.label !== 'string') return [];

      if (item.kind === 'period' && 'year' in item && typeof item.year === 'number') {
        return [{
          id: item.id,
          kind: 'period',
          label: item.label,
          year: item.year,
          month: 'month' in item && typeof item.month === 'number' ? item.month : undefined,
        }];
      }

      if ((item.kind === 'city' || item.kind === 'venue') && 'value' in item && typeof item.value === 'string') {
        return [{
          id: item.id,
          kind: item.kind,
          label: item.label,
          value: item.value,
        }];
      }

      if (item.kind === 'artist' && 'artistId' in item && typeof item.artistId === 'string') {
        return [{
          id: item.id,
          kind: 'artist',
          label: item.label,
          artistId: item.artistId,
        }];
      }

      if (
        item.kind === 'status' &&
        'status' in item &&
        typeof item.status === 'string' &&
        (STATUS_VALUES as string[]).includes(item.status)
      ) {
        return [{
          id: item.id,
          kind: 'status',
          label: item.label,
          status: item.status as EventStatus,
        }];
      }

      if (item.kind === 'score' && 'minScore' in item && typeof item.minScore === 'number') {
        return [{
          id: item.id,
          kind: 'score',
          label: item.label,
          minScore: item.minScore,
        }];
      }

      if (
        item.kind === 'scope' &&
        'scope' in item &&
        (item.scope === 'favorite' || item.scope === 'oshi')
      ) {
        return [{
          id: item.id,
          kind: 'scope',
          label: item.label,
          scope: item.scope,
        }];
      }

      return [];
    });
  } catch {
    return [];
  }
}

function mergeHistoryPills(prev: DetailHistoryPill[], active: DetailHistoryPill[]): DetailHistoryPill[] {
  const deduped = new Map<string, DetailHistoryPill>();
  for (const pill of [...active, ...prev]) {
    if (!deduped.has(pill.id)) deduped.set(pill.id, pill);
  }
  return [...deduped.values()].slice(0, 12);
}

function DetailFilterPill({
  label,
  colors,
  removable = false,
  onPress,
}: {
  label: string;
  colors: ThemeColors;
  removable?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: removable ? colors.accentBorder : colors.inputBorder,
        backgroundColor: removable ? colors.accentSoft : colors.cardAlt,
        paddingLeft: 12,
        paddingRight: removable ? 10 : 12,
        paddingVertical: 7,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          maxWidth: 160,
          fontSize: 12.5,
          fontWeight: '700',
          color: removable ? colors.accentText : colors.textSecondary,
        }}
      >
        {label}
      </Text>
      {removable ? <AppIcon name="close" size={12} color={colors.accentText} /> : null}
    </TouchableOpacity>
  );
}

export default function EventsIndexScreen() {
  const db = useDB();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{
    city?: string;
    venue?: string;
    status?: string;
    artist_id?: string | string[];
    year?: string;
    month?: string;
    min_score?: string;
    scope?: string;
  }>();

  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [distinctYears, setDistinctYears] = useState<number[]>([]);
  const [distinctCities, setDistinctCities] = useState<string[]>([]);
  const [distinctVenues, setDistinctVenues] = useState<string[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [recentFilterHistory, setRecentFilterHistory] = useState<DetailHistoryPill[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);

  const debouncedKeyword = useDebouncedValue(keyword, 250);

  const yearNum = params.year ? Number(params.year) : undefined;
  const monthNum = params.month ? Number(params.month) : undefined;
  const statusParam = params.status as EventStatus | undefined;
  const minScoreNum = params.min_score ? Number(params.min_score) : undefined;
  const scopeParam = params.scope === 'favorite' || params.scope === 'oshi' ? params.scope : undefined;
  const selectedArtistIds = useMemo(() => parseArtistIdsParam(params.artist_id), [params.artist_id]);
  const artistMap = useMemo(() => new Map(artists.map((artist) => [artist.id, artist])), [artists]);
  const hasRepositoryFilter = Boolean(
    params.city || params.venue || params.status || selectedArtistIds.length > 0 ||
    yearNum || minScoreNum || scopeParam || debouncedKeyword.trim()
  );

  const loadData = useCallback(async () => {
    if (hasRepositoryFilter) {
      const filter: EventFilter = {
        keyword: debouncedKeyword.trim() || undefined,
        city: params.city || undefined,
        venue: params.venue || undefined,
        status: statusParam,
        artistIds: selectedArtistIds,
        year: yearNum,
        month: monthNum,
        minScore: minScoreNum,
        artistScope: scopeParam,
      };
      const filtered = await db.events.findFiltered(filter);
      setEvents(filtered);
    } else {
      const all = await db.events.findAll();
      setEvents(all);
    }
  }, [db, hasRepositoryFilter, debouncedKeyword, minScoreNum, monthNum, params.city, params.venue, scopeParam, selectedArtistIds, statusParam, yearNum]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  useFocusEffect(useCallback(() => {
    db.events.findDistinctYears().then(setDistinctYears);
    db.events.findDistinctCities().then(setDistinctCities);
    db.events.findDistinctVenues().then(setDistinctVenues);
    db.artists.findAll().then(setArtists);
    db.userConfig.getConfig().then((config) => setOshiArtistId(config.oshi_artist_id));
  }, [db]));

  useEffect(() => {
    let isActive = true;

    AsyncStorage.getItem(EVENT_FILTER_HISTORY_STORAGE_KEY)
      .then((rawValue) => {
        if (!isActive) return;
        setRecentFilterHistory(parseStoredFilterHistory(rawValue));
      })
      .finally(() => {
        if (isActive) setHistoryHydrated(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const activeDetailPills = useMemo<DetailHistoryPill[]>(() => {
    const pills: DetailHistoryPill[] = [];

    if (yearNum) {
      pills.push({
        id: `period:${yearNum}:${monthNum ?? 'all'}`,
        kind: 'period',
        label: monthNum ? `${yearNum}.${String(monthNum).padStart(2, '0')}` : `${yearNum}`,
        year: yearNum,
        month: monthNum,
      });
    }

    if (params.city) {
      pills.push({
        id: `city:${params.city}`,
        kind: 'city',
        label: params.city,
        value: params.city,
      });
    }

    if (params.venue) {
      pills.push({
        id: `venue:${params.venue}`,
        kind: 'venue',
        label: params.venue,
        value: params.venue,
      });
    }

    for (const artistId of selectedArtistIds) {
      const artist = artistMap.get(artistId);
      pills.push({
        id: `artist:${artistId}`,
        kind: 'artist',
        label: artist ? getArtistPrimaryName(artist) : '指定艺人',
        artistId,
      });
    }

    if (statusParam) {
      pills.push({
        id: `status:${statusParam}`,
        kind: 'status',
        label: STATUS_LABELS[statusParam],
        status: statusParam,
      });
    }

    if (minScoreNum) {
      pills.push({
        id: `score:${minScoreNum}`,
        kind: 'score',
        label: scoreLabel(minScoreNum),
        minScore: minScoreNum,
      });
    }

    if (scopeParam) {
      pills.push({
        id: `scope:${scopeParam}`,
        kind: 'scope',
        label: scopeLabel(scopeParam),
        scope: scopeParam,
      });
    }

    return pills;
  }, [artistMap, minScoreNum, monthNum, params.city, params.venue, scopeParam, selectedArtistIds, statusParam, yearNum]);

  useEffect(() => {
    if (!historyHydrated || activeDetailPills.length === 0) return;

    setRecentFilterHistory((prev) => {
      const next = mergeHistoryPills(prev, activeDetailPills);
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      void AsyncStorage.setItem(EVENT_FILTER_HISTORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [activeDetailPills, historyHydrated]);

  const recentHistoryPills = useMemo(() => {
    const activeIds = new Set(activeDetailPills.map((pill) => pill.id));
    return recentFilterHistory.filter((pill) => !activeIds.has(pill.id)).slice(0, 8);
  }, [activeDetailPills, recentFilterHistory]);
  const hasAnyFilter = Boolean(
    keyword.trim().length > 0 ||
    statusParam ||
    activeDetailPills.length > 0
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const displayedEvents = events;

  const sections = useMemo(() => buildEventMonthSections(displayedEvents), [displayedEvents]);

  const filterSections = useMemo<FilterSection[]>(() => {
    const result: FilterSection[] = [
      {
        key: 'year',
        title: '年份',
        value: yearNum ? String(yearNum) : null,
        onChange: (value) => {
          router.setParams({ year: value ?? '', month: '' });
        },
        options: distinctYears.map((year) => ({ value: String(year), label: `${year}` })),
      },
    ];

    if (yearNum) {
      result.push({
        key: 'month',
        title: '月份',
        value: monthNum ? String(monthNum) : null,
        onChange: (value) => {
          router.setParams({ month: value ?? '' });
        },
        options: Array.from({ length: 12 }, (_, index) => ({
          value: String(index + 1),
          label: `${index + 1}月`,
        })),
      });
    }

    result.push({
      key: 'status',
      title: '状态',
      value: statusParam ?? null,
      onChange: (value) => router.setParams({ status: value ?? '' }),
      options: STATUS_VALUES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    });

    result.push({
      key: 'score',
      title: '评分',
      value: minScoreNum ? String(minScoreNum) : null,
      onChange: (value) => router.setParams({ min_score: value ?? '' }),
      options: SCORE_OPTIONS,
    });

    result.push({
      key: 'scope',
      title: '单推 / 收藏',
      value: scopeParam ?? null,
      onChange: (value) => router.setParams({ scope: value ?? '' }),
      options: SCOPE_OPTIONS,
    });

    result.push({
      key: 'artist',
      title: '艺人',
      value: null,
      values: selectedArtistIds,
      multiple: true,
      onChange: (value) => router.setParams({ artist_id: value ?? '' }),
      onValuesChange: (values) => router.setParams({ artist_id: serializeArtistIdsParam(values) }),
      allLabel: '全部艺人',
      search: { placeholder: '搜索艺人…' },
      options: sortArtistsWithOshi(artists, oshiArtistId).map((artist) => {
        const label = getArtistPrimaryName(artist);
        return {
          value: artist.id,
          label,
          searchText: getArtistSearchText(artist, artistMap),
          subtitle: label !== artist.name ? artist.name : undefined,
          artist,
          parentName: artist.parent_id ? artistMap.get(artist.parent_id)?.short_name || artistMap.get(artist.parent_id)?.name : undefined,
          isOshi: artist.id === oshiArtistId,
        };
      }),
    });

    result.push({
      key: 'city',
      title: '城市',
      value: params.city || null,
      onChange: (value) => router.setParams({ city: value ?? '' }),
      input: { placeholder: '输入城市，或选择下方建议' },
      options: distinctCities.map((city) => ({ value: city, label: city })),
    });

    result.push({
      key: 'venue',
      title: '场地',
      value: params.venue || null,
      onChange: (value) => router.setParams({ venue: value ?? '' }),
      input: { placeholder: '输入场地，或选择下方建议' },
      options: distinctVenues.map((venue) => ({ value: venue, label: venue })),
    });

    return result;
  }, [
    distinctCities,
    distinctVenues,
    distinctYears,
    artists,
    oshiArtistId,
    minScoreNum,
    monthNum,
    params.city,
    params.venue,
    artistMap,
    router,
    scopeParam,
    selectedArtistIds,
    statusParam,
    yearNum,
  ]);

  const applyHistoryPill = useCallback((pill: DetailHistoryPill) => {
    if (pill.kind === 'period') {
      router.setParams({
        year: String(pill.year),
        month: pill.month != null ? String(pill.month) : '',
      });
      return;
    }

    if (pill.kind === 'city') {
      router.setParams({ city: pill.value });
      return;
    }

    if (pill.kind === 'venue') {
      router.setParams({ venue: pill.value });
      return;
    }

    if (pill.kind === 'artist') {
      router.setParams({ artist_id: serializeArtistIdsParam([...selectedArtistIds, pill.artistId]) });
      return;
    }

    if (pill.kind === 'status') {
      router.setParams({ status: pill.status });
      return;
    }

    if (pill.kind === 'score') {
      router.setParams({ min_score: String(pill.minScore) });
      return;
    }

    if (pill.kind === 'scope') {
      router.setParams({ scope: pill.scope });
    }
  }, [router, selectedArtistIds]);

  const clearDetailPill = useCallback((pill: DetailHistoryPill) => {
    if (pill.kind === 'period') {
      router.setParams({ year: '', month: '' });
      return;
    }

    if (pill.kind === 'city') {
      router.setParams({ city: '' });
      return;
    }

    if (pill.kind === 'venue') {
      router.setParams({ venue: '' });
      return;
    }

    if (pill.kind === 'status') {
      router.setParams({ status: '' });
      return;
    }

    if (pill.kind === 'score') {
      router.setParams({ min_score: '' });
      return;
    }

    if (pill.kind === 'scope') {
      router.setParams({ scope: '' });
      return;
    }

    if (pill.kind === 'artist') {
      router.setParams({
        artist_id: serializeArtistIdsParam(selectedArtistIds.filter((artistId) => artistId !== pill.artistId)),
      });
    }
  }, [router, selectedArtistIds]);

  const clearFilter = useCallback(() => {
    setKeyword('');
    router.setParams({
      city: '', venue: '', status: '', artist_id: '', year: '', month: '', min_score: '', scope: '',
    });
  }, [router]);

  const activeSearchFilters = useMemo(
    () => activeDetailPills.map((pill) => ({
      id: pill.id,
      label: pill.label,
      onPress: () => clearDetailPill(pill),
    })),
    [activeDetailPills, clearDetailPill],
  );

  const filterSheetHeader = useMemo(() => (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 10 }}>
        最近用过
      </Text>
      {recentHistoryPills.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {recentHistoryPills.map((pill) => (
            <DetailFilterPill
              key={pill.id}
              label={pill.label}
              colors={colors}
              onPress={() => applyHistoryPill(pill)}
            />
          ))}
        </ScrollView>
      ) : (
        <Text style={{ fontSize: 12.5, color: colors.textMuted }}>
          使用筛选后会保留快捷入口
        </Text>
      )}
    </View>
  ), [applyHistoryPill, colors, recentHistoryPills]);

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
            placeholder="输入关键词搜索"
            onOpenFilter={() => setFilterVisible(true)}
            activeFilters={activeSearchFilters}
            activeCount={activeDetailPills.length}
            isDark={isDark}
          />
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
            <View>
              <EventCard event={item} oshiBadge={getEventCardOshiBadge(item.status, null)} />
            </View>
          )}
          ListEmptyComponent={
            !refreshing ? (
              hasAnyFilter ? (
                <FilteredEmptyState
                  title="没有符合条件的活动"
                  onClear={clearFilter}
                  isDark={isDark}
                />
              ) : (
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <AppIcon name="eventDate" size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                    还没有活动
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted }}>
                    新建活动后会出现在这里
                  </Text>
                </View>
              )
            ) : null
          }
        />

        <FilterSheet
          visible={filterVisible}
          sections={filterSections}
          isDark={isDark}
          header={filterSheetHeader}
          onReset={clearFilter}
          onClose={() => setFilterVisible(false)}
        />
      </SafeAreaView>
      {IS_IOS ? (
        <NativeAddToolbar
          accessibilityLabel="新建活动"
          onPress={() => router.push('/events/compose')}
        />
      ) : null}
    </>
  );
}

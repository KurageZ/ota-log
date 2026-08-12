import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import SegmentedControl from '@expo/ui/community/segmented-control';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../../../src/components/AndroidCollapsibleTabHeader';
import { EventCard } from '../../../src/components/EventCard';
import { getEventCardOshiBadge } from '../../../src/utils/oshiMatch';
import { OshiAvatar } from '../../../src/components/Oshi';
import { ArtistRankingList } from '../../../src/components/ArtistRankingList';
import { ChekiArtistShareChart } from '../../../src/components/ChekiArtistShareChart';
import { AppIcon } from '../../../src/components/AppIcon';
import {
  StatsRangePicker,
  type StatsRangePickerMode,
} from '../../../src/components/StatsRangePicker';
import { useDB } from '../../../src/context/DBContext';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { Artist, Event, UserConfig } from '../../../src/types/models';
import type { ChekiArtistRankingItem } from '../../../src/repositories/ChekiRepository';
import type { EventArtistRankingItem } from '../../../src/repositories/EventRepository';
import { useAppTheme } from '../../../src/theme/appTheme';
import { useFloatingTabBarSpacing } from '../../../src/navigation/floatingTabBar';
import { useFloatingTabBarScroll } from '../../../src/navigation/FloatingTabBarVisibility';
import { showOperationFailedAlert } from '../../../src/utils/failureAlert';
import {
  type StatsSectionConfig,
  type StatsSectionType,
  loadStatsPreferences,
} from '../../../src/utils/statsPreferences';
import { createStatsLoadPlan } from '../../../src/utils/statsLoadPlan';
import {
  buildStatsTrendBuckets,
  createPresetStatsRange,
  formatStatsDateRange,
  formatStatsPeriodLabel,
  getTrendLabelIndices,
  parseStatsRangeParams,
  shiftStatsDateRange,
  type StatsDateRange,
  type StatsPeriodPreset,
} from '../../../src/utils/statsDateRange';
import { statsRangeSession } from '../../../src/utils/statsRangeSession';

const EVENT_RANKING_LIMIT = 10;
const PERIOD_PRESETS: Array<{ preset: StatsPeriodPreset; label: string }> = [
  { preset: 'week', label: '周' },
  { preset: 'month', label: '月' },
  { preset: 'year', label: '年' },
  { preset: 'custom', label: '自定义' },
];

interface LabelCount {
  name: string;
  count: number;
}

interface SpendEntry {
  event: Event;
  ticketTotal: number;
  chekiTotal: number;
  totalSpend: number;
}

interface StatsState {
  statusCounts: {
    completed: number;
    planned: number;
    wishlist: number;
  };
  monthlyEventCounts: number[];
  topCity: LabelCount | null;
  topVenue: LabelCount | null;
  perfectEvents: Event[];
  userConfig: UserConfig | null;
  oshiArtist: Artist | null;
  oshiCompletedCount: number;
  recentOshiEvent: Event | null;
  chekiCount: number;
  chekiArtistCount: number;
  oshiChekiCount: number;
  monthlyOshiActivityCounts: number[];
  eventTicketTotal: number;
  chekiPriceTotal: number;
  averageEventSpend: number;
  topSpendEvents: SpendEntry[];
  rootArtistEventRanking: EventArtistRankingItem[];
  chekiArtistRanking: ChekiArtistRankingItem[];
  monthlyChekiCounts: number[];
}

function createEmptyStatsState(): StatsState {
  return {
    statusCounts: { completed: 0, planned: 0, wishlist: 0 },
    monthlyEventCounts: Array(12).fill(0),
    topCity: null,
    topVenue: null,
    perfectEvents: [],
    userConfig: null,
    oshiArtist: null,
    oshiCompletedCount: 0,
    recentOshiEvent: null,
    chekiCount: 0,
    chekiArtistCount: 0,
    oshiChekiCount: 0,
    monthlyOshiActivityCounts: Array(12).fill(0),
    eventTicketTotal: 0,
    chekiPriceTotal: 0,
    averageEventSpend: 0,
    topSpendEvents: [],
    rootArtistEventRanking: [],
    chekiArtistRanking: [],
    monthlyChekiCounts: Array(12).fill(0),
  };
}

function SectionHeader({
  title,
  colors,
  trailing,
}: {
  title: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  trailing?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
        <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '700', color: colors.text }}>{title}</Text>
      </View>
      {trailing}
    </View>
  );
}

function StatBox({
  label,
  value,
  sub,
  colors,
  compact = false,
  onPress,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  compact?: boolean;
  onPress?: () => void;
}) {
  const Container: typeof View | typeof TouchableOpacity = onPress ? TouchableOpacity : View;
  return (
    <Container
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: compact ? 10 : 14,
        paddingHorizontal: 6,
        backgroundColor: colors.card,
        borderRadius: 16,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: compact ? 24 : 28, lineHeight: compact ? 26 : 32, fontWeight: '900', color: colors.heading }}>
        {value}
      </Text>
      {sub ? (
        <Text
          style={{ fontSize: compact ? 11 : 11, lineHeight: compact ? 15 : 16, color: colors.textSecondary, marginTop: compact ? 2 : 1, fontWeight: compact ? '600' : '400' }}
          numberOfLines={compact ? 1 : 2}
        >
          {sub}
        </Text>
      ) : null}
      {!compact ? (
        <Text style={{ fontSize: compact ? 10 : 11, color: colors.textMuted, marginTop: compact ? 2 : 3 }}>
          {label}
        </Text>
      ) : null}
    </Container>
  );
}

function SurfaceCard({
  children,
  colors,
  style,
}: {
  children: ReactNode;
  colors: ReturnType<typeof useAppTheme>['colors'];
  style?: object;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 16,
        marginBottom: 24,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

function TrendBarChart({
  counts,
  labels,
  colors,
  activeColor,
}: {
  counts: number[];
  labels: string[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  activeColor?: string;
}) {
  const maxCount = Math.max(...counts, 1);
  const barColor = activeColor ?? colors.accent;
  const visibleLabelIndices = getTrendLabelIndices(labels.length);
  const dense = counts.length > 12;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: dense ? 68 : 88, gap: dense ? 1 : 4 }}>
        {counts.map((count, index) => {
          const pct = count / maxCount;
          return (
            <View key={index} style={{ flex: 1, alignItems: 'center', minWidth: 6 }}>
              {!dense ? (
                <Text style={{ fontSize: 10, fontWeight: '700', color: count > 0 ? colors.textSecondary : colors.textMuted, marginBottom: 6 }}>
                  {count > 0 ? count : ''}
                </Text>
              ) : null}
              <View
                style={{
                  width: dense ? '62%' : '100%',
                  maxWidth: dense ? 12 : undefined,
                  height: count > 0 ? Math.max(dense ? 4 : 6, pct * 60) : dense ? 2 : 6,
                  borderRadius: count > 0 ? (dense ? 3 : 4) : 1,
                  backgroundColor: count > 0 ? barColor : colors.inputBorder,
                  opacity: count > 0 || !dense ? 1 : 0.45,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8, gap: dense ? 1 : 4 }}>
        {labels.map((label, index) => (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 8,
                fontWeight: '500',
                color: colors.textMuted,
              }}
            >
              {visibleLabelIndices.has(index) ? label.replace('月', '') : ''}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function EmptyCard({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <SurfaceCard colors={colors}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>{body}</Text>
    </SurfaceCard>
  );
}

function OshiCardTitle({
  artist,
}: {
  artist: Artist;
}) {
  const { colors } = useAppTheme();
  const avatarSource = resolveAvatarSource(artist.avatar_uri);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <OshiAvatar source={avatarSource} size={34} isOshi />
      <View
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: colors.heading,
          }}
          numberOfLines={1}
        >
          {artist.short_name?.trim() || artist.name}
        </Text>
      </View>
    </View>
  );
}

function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(0)}`;
}

function sumCounts(counts: number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

function aggregateTrendCounts(
  rows: Array<{ date: string; count: number }>,
  buckets: ReturnType<typeof buildStatsTrendBuckets>,
): number[] {
  return buckets.map((bucket) => rows.reduce(
    (total, row) => row.date >= bucket.startDate && row.date <= bucket.endDate ? total + row.count : total,
    0,
  ));
}

export default function StatsScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const isAndroid = Platform.OS === 'android';
  const androidHeader = useAndroidCollapsibleTabHeader();
  const iosTabBarScroll = useFloatingTabBarScroll();
  const router = useRouter();
  const params = useLocalSearchParams<{
    preset?: string;
    startDate?: string;
    endDate?: string;
    year?: string;
    month?: string;
  }>();
  const routePeriod = useMemo(
    () => parseStatsRangeParams(params),
    [params.endDate, params.month, params.preset, params.startDate, params.year]
  );
  const [period, setPeriod] = useState<StatsDateRange>(
    () => routePeriod ?? statsRangeSession.getCurrent() ?? createPresetStatsRange('month')
  );
  const [pickerMode, setPickerMode] = useState<StatsRangePickerMode | null>(null);
  const [stats, setStats] = useState<StatsState | null>(null);
  const [statsSections, setStatsSections] = useState<StatsSectionConfig[] | null>(null);
  const loadRequestIdRef = useRef(0);

  const startDateArg = period.startDate ?? undefined;
  const endDateArg = period.endDate ?? undefined;
  const trendBuckets = useMemo(() => buildStatsTrendBuckets(period), [period]);
  const routePeriodPending = routePeriod != null && (
    period.preset !== routePeriod.preset
    || period.startDate !== routePeriod.startDate
    || period.endDate !== routePeriod.endDate
  );

  const tabBarScroll = isAndroid ? androidHeader.scrollProps : iosTabBarScroll;

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    try {
      const preferences = await loadStatsPreferences();
      const {
        needsActivity,
        needsOshi,
        needsSpending,
        needsPerfectEvents,
        needsCheki,
        needsStatusCounts,
        needsChekiCount,
      } = createStatsLoadPlan(preferences.sections);
      const empty = createEmptyStatsState();

      const [
        statusCounts,
        monthlyEventCounts,
        topCity,
        topVenue,
        perfectEvents,
        userConfig,
        chekiCount,
        chekiArtistCount,
        monthlyChekiCounts,
        chekiArtistRanking,
        chekiPriceTotal,
        eventTicketTotal,
        averageEventSpend,
        topSpendEvents,
        rootArtistEventRanking,
      ] = await Promise.all([
        needsStatusCounts
          ? db.events.getYearStatusCounts(undefined, undefined, startDateArg, endDateArg)
          : Promise.resolve(empty.statusCounts),
        needsActivity && startDateArg && endDateArg
          ? db.events.getDailyCountsByRange(startDateArg, endDateArg).then((rows) => aggregateTrendCounts(rows, trendBuckets))
          : Promise.resolve(empty.monthlyEventCounts),
        needsActivity ? db.events.findTopCityByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(null),
        needsActivity ? db.events.findTopVenueByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(null),
        needsPerfectEvents ? db.events.findPerfectEventsByYear(undefined, undefined, 5, startDateArg, endDateArg) : Promise.resolve([]),
        needsOshi || needsCheki ? db.userConfig.getConfig() : Promise.resolve(null),
        needsChekiCount ? db.cheki.countByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsCheki ? db.cheki.countDistinctArtistsByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsCheki && startDateArg && endDateArg
          ? db.cheki.getDailyCountsByRange(startDateArg, endDateArg).then((rows) => aggregateTrendCounts(rows, trendBuckets))
          : Promise.resolve(empty.monthlyChekiCounts),
        needsCheki ? db.cheki.groupByArtistYear(undefined, undefined, undefined, startDateArg, endDateArg) : Promise.resolve([]),
        needsSpending ? db.cheki.sumPriceByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsSpending ? db.events.sumCompletedTicketPriceByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsSpending ? db.events.getAverageCompletedSpendByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsSpending ? db.events.findTopSpendCompletedByYear(undefined, undefined, 5, startDateArg, endDateArg) : Promise.resolve([]),
        needsActivity
          ? db.events.groupRootArtistsByCompletedEvents(undefined, undefined, EVENT_RANKING_LIMIT, startDateArg, endDateArg)
          : Promise.resolve([]),
      ]);

      const [
        oshiArtist,
        oshiCompletedCount,
        recentOshiEvent,
        oshiChekiCount,
        monthlyOshiEventCounts,
        monthlyOshiChekiCounts,
      ] = needsOshi && userConfig?.oshi_artist_id
          ? await Promise.all([
            db.artists.findById(userConfig.oshi_artist_id),
            db.events.countCompletedByArtistYear(undefined, userConfig.oshi_artist_id, undefined, startDateArg, endDateArg),
            db.events.findRecentCompletedByArtistYear(undefined, userConfig.oshi_artist_id, undefined, startDateArg, endDateArg),
            db.cheki.countByArtistYear(undefined, userConfig.oshi_artist_id, undefined, startDateArg, endDateArg),
            !startDateArg || !endDateArg
              ? Promise.resolve(Array(12).fill(0))
              : db.events.getDailyCompletedCountsByArtistRange(startDateArg, endDateArg, userConfig.oshi_artist_id)
                .then((rows) => aggregateTrendCounts(rows, trendBuckets)),
            !startDateArg || !endDateArg
              ? Promise.resolve(Array(12).fill(0))
              : db.cheki.getDailyCountsByArtistRange(startDateArg, endDateArg, userConfig.oshi_artist_id)
                .then((rows) => aggregateTrendCounts(rows, trendBuckets)),
          ])
          : [null, 0, null, 0, Array(12).fill(0), Array(12).fill(0)];

      const monthlyOshiActivityCounts = monthlyOshiEventCounts.map(
        (count, index) => count + (monthlyOshiChekiCounts[index] ?? 0),
      );

      if (requestId !== loadRequestIdRef.current) return;
      setStatsSections(preferences.sections);
      setStats({
        statusCounts,
        monthlyEventCounts,
        topCity,
        topVenue,
        perfectEvents,
        userConfig,
        oshiArtist,
        oshiCompletedCount,
        recentOshiEvent,
        chekiCount,
        chekiArtistCount,
        oshiChekiCount,
        monthlyOshiActivityCounts,
        eventTicketTotal,
        chekiPriceTotal,
        averageEventSpend,
        topSpendEvents,
        rootArtistEventRanking,
        chekiArtistRanking,
        monthlyChekiCounts,
      });
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      setStatsSections((current) => current ?? []);
      setStats(createEmptyStatsState());
      showOperationFailedAlert(
        '无法读取统计数据。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再打开。',
        error,
      );
    }
  }, [db, endDateArg, startDateArg, trendBuckets]);

  useEffect(() => {
    if (!routePeriod) return;
    statsRangeSession.rememberCustom(routePeriod);

    setPeriod((current) => (
      current.preset === routePeriod.preset
        && current.startDate === routePeriod.startDate
        && current.endDate === routePeriod.endDate
        ? current
        : routePeriod
    ));
  }, [routePeriod]);

  useFocusEffect(useCallback(() => {
    if (routePeriodPending) return;
    loadData();
  }, [loadData, routePeriodPending]));

  const renderAndroidAdjustButton = useCallback(() => (
    <TouchableOpacity
      onPress={() => router.push('/settings/stats')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="调整统计内容"
      style={{
        minWidth: 52,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accent }}>调整</Text>
    </TouchableOpacity>
  ), [colors.accent, router]);

  const periodParams = useCallback((): Record<string, string> => {
    if (!period.startDate || !period.endDate) return { preset: 'all' };
    return { preset: period.preset, startDate: period.startDate, endDate: period.endDate };
  }, [period]);

  const goToEvents = useCallback((extra: Record<string, string>) => {
    router.push({ pathname: '/events', params: { ...periodParams(), ...extra } });
  }, [router, periodParams]);

  const goToCheki = useCallback((extra: Record<string, string> = {}) => {
    router.push({ pathname: '/cheki', params: { ...periodParams(), ...extra } });
  }, [router, periodParams]);

  const applyPeriod = useCallback((next: StatsDateRange) => {
    statsRangeSession.rememberApplied(next);
    setPeriod(next);
    router.setParams({
      preset: next.preset,
      startDate: next.startDate ?? '',
      endDate: next.endDate ?? '',
      year: '',
      month: '',
    });
  }, [router]);

  if (!stats || !statsSections) {
    return <View style={{ flex: 1, backgroundColor: colors.screen }} />;
  }

  const {
    statusCounts,
    monthlyEventCounts,
    topCity,
    topVenue,
    perfectEvents,
    userConfig,
    oshiArtist,
    oshiCompletedCount,
    recentOshiEvent,
    chekiCount,
    chekiArtistCount,
    oshiChekiCount,
    monthlyOshiActivityCounts,
    eventTicketTotal,
    chekiPriceTotal,
    averageEventSpend,
    topSpendEvents,
    rootArtistEventRanking,
    chekiArtistRanking,
    monthlyChekiCounts,
  } = stats;

  const eventTotal = statusCounts.completed + statusCounts.planned + statusCounts.wishlist;
  const totalSpend = eventTicketTotal + chekiPriceTotal;
  const oshiEventRatio = statusCounts.completed > 0
    ? Math.round((oshiCompletedCount / statusCounts.completed) * 100)
    : 0;
  const oshiChekiRatio = chekiCount > 0
    ? Math.round((oshiChekiCount / chekiCount) * 100)
    : 0;
  const oshiActivityTotal = sumCounts(monthlyOshiActivityCounts);
  const periodLabel = period.preset === 'all' ? '全部时间' : formatStatsDateRange(period);
  const periodNoun = period.preset === 'all' ? '全部时间' : '这段时间';
  const oshiArtistId = userConfig?.oshi_artist_id ?? null;
  const chekiArtistItems = chekiArtistRanking.map((item) => ({
    id: item.artistId,
    name: item.name,
    avatarUri: item.avatarUri,
    value: item.count,
    isOshi: item.artistId != null && item.artistId === oshiArtistId,
  }));
  const visibleSections = statsSections.filter((section) => section.visible);
  const hasAnyVisibleData = visibleSections.some((section) => {
    if (section.type === 'activity') return eventTotal > 0;
    if (section.type === 'oshi') return oshiCompletedCount > 0 || oshiChekiCount > 0;
    if (section.type === 'spending') return totalSpend > 0 || topSpendEvents.length > 0;
    if (section.type === 'perfectEvents') return perfectEvents.length > 0;
    return chekiCount > 0;
  });
  const navigablePreset = period.preset === 'week' || period.preset === 'month' || period.preset === 'year'
    ? period.preset
    : null;
  const canNavigatePeriod = navigablePreset != null;
  const navigatorLabel = formatStatsPeriodLabel(period);

  const periodControls = (
    <View
      style={{
        marginBottom: 24,
        gap: 8,
      }}
    >
      <SegmentedControl
        values={PERIOD_PRESETS.map(({ label }) => label)}
        selectedIndex={PERIOD_PRESETS.findIndex(({ preset }) => (
          preset === (period.preset === 'all' ? 'custom' : period.preset)
        ))}
        appearance={isDark ? 'dark' : 'light'}
        onChange={({ nativeEvent }) => {
          const selected = PERIOD_PRESETS[nativeEvent.selectedSegmentIndex];
          if (!selected) return;
          if (selected.preset === 'custom') {
            const recentCustomRange = statsRangeSession.getCustom();
            if (recentCustomRange) {
              applyPeriod(recentCustomRange);
              return;
            }
            setPickerMode('custom');
            return;
          }
          applyPeriod(createPresetStatsRange(selected.preset));
        }}
        style={{ height: 32 }}
      />
      <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity
          activeOpacity={0.65}
          disabled={!canNavigatePeriod}
          accessibilityRole="button"
          accessibilityLabel="上一个周期"
          accessibilityState={{ disabled: !canNavigatePeriod }}
          onPress={() => applyPeriod(shiftStatsDateRange(period, -1))}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.cardAlt,
            opacity: canNavigatePeriod ? 1 : 0.4,
          }}
        >
          <AppIcon name="chevron" variant="back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel={`${canNavigatePeriod ? '选择统计周期' : '自定义统计日期'}，当前${navigatorLabel}`}
          onPress={() => setPickerMode(navigablePreset ?? 'custom')}
          style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <Text
            style={{
              fontSize: 15,
              lineHeight: 20,
              fontWeight: '700',
              color: colors.text,
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          >
            {navigatorLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.65}
          disabled={!canNavigatePeriod}
          accessibilityRole="button"
          accessibilityLabel="下一个周期"
          accessibilityState={{ disabled: !canNavigatePeriod }}
          onPress={() => applyPeriod(shiftStatsDateRange(period, 1))}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.cardAlt,
            opacity: canNavigatePeriod ? 1 : 0.4,
          }}
        >
          <AppIcon name="chevron" variant="forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStatsSection = (sectionType: StatsSectionType) => {
    if (sectionType === 'activity') {
      return (
        <>
          <SectionHeader title="活动统计" colors={colors} />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBox label="已完成" value={statusCounts.completed} colors={colors} onPress={() => goToEvents({ status: 'completed' })} />
            <StatBox label="已计划" value={statusCounts.planned} colors={colors} onPress={() => goToEvents({ status: 'planned' })} />
            <StatBox label="心愿单" value={statusCounts.wishlist} colors={colors} onPress={() => goToEvents({ status: 'wishlist' })} />
          </View>
          <SurfaceCard colors={colors}>
            {trendBuckets.length > 0 ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                  数量趋势
                </Text>
                <TrendBarChart counts={monthlyEventCounts} labels={trendBuckets.map((bucket) => bucket.label)} colors={colors} />
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: trendBuckets.length > 0 ? 18 : 0 }}>
              <TouchableOpacity
                activeOpacity={topCity ? 0.7 : 1}
                disabled={!topCity}
                onPress={topCity ? () => goToEvents({ city: topCity.name }) : undefined}
                style={{ flex: 1, borderRadius: 14, padding: 14, backgroundColor: colors.accentSoft }}
              >
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>最常去城市</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.heading }}>
                  {topCity ? topCity.name : '—'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                  {topCity ? `${topCity.count} 场` : '暂无数据'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={topVenue ? 0.7 : 1}
                disabled={!topVenue}
                onPress={topVenue ? () => goToEvents({ venue: topVenue.name }) : undefined}
                style={{ flex: 1, borderRadius: 14, padding: 14, backgroundColor: colors.infoSoft }}
              >
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>最常去场地</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.heading }} numberOfLines={1}>
                  {topVenue ? topVenue.name : '—'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                  {topVenue ? `${topVenue.count} 场` : '暂无数据'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                排行（仅团体）
              </Text>
              {rootArtistEventRanking.length > 0 ? (
                <ArtistRankingList
                  items={rootArtistEventRanking.map((item) => ({
                    id: item.artistId,
                    name: item.name,
                    avatarUri: item.avatarUri,
                    value: item.count,
                  }))}
                  colors={colors}
                  suffix="场"
                  onPressItem={(item) => {
                    if (item.id) goToEvents({ artist_id: item.id, status: 'completed' });
                  }}
                  getAccessibilityLabel={(item) => `查看${item.name}参与的已完成活动`}
                />
              ) : (
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                  记录完成活动并关联没有所属团体的艺人后，这里会显示前十排行。
                </Text>
              )}
            </View>
          </SurfaceCard>
        </>
      );
    }

    if (sectionType === 'oshi') {
      return (
        <>
          <SectionHeader title="单推" colors={colors} />
          {oshiArtistId ? (
            <SurfaceCard colors={colors}>
              {oshiArtist ? <OshiCardTitle artist={oshiArtist} /> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <StatBox
                  label="相关活动"
                  value={oshiCompletedCount}
                  sub={statusCounts.completed > 0 ? `相关活动 · 占比 ${oshiEventRatio}%` : '相关活动 · 暂无数据'}
                  colors={colors}
                  compact
                  onPress={() => goToEvents({ artist_id: oshiArtistId, status: 'completed' })}
                />
                <StatBox
                  label="单推拍立得"
                  value={oshiChekiCount}
                  sub={chekiCount > 0 ? `拍立得 · 占比 ${oshiChekiRatio}%` : '拍立得 · 暂无数据'}
                  colors={colors}
                  compact
                  onPress={() => goToCheki({ artist_id: oshiArtistId })}
                />
              </View>
              <TouchableOpacity
                activeOpacity={recentOshiEvent ? 0.7 : 1}
                disabled={!recentOshiEvent}
                onPress={recentOshiEvent ? () => router.push(`/events/${recentOshiEvent.id}`) : undefined}
                accessibilityRole={recentOshiEvent ? 'button' : undefined}
                accessibilityLabel={recentOshiEvent ? `查看活动详情：${recentOshiEvent.title}` : undefined}
                style={{
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: trendBuckets.length > 0 ? 14 : 0,
                  backgroundColor: colors.accentSoft,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, marginBottom: 6 }}>
                  最近一次活动
                </Text>
                {recentOshiEvent ? (
                  <>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                      {recentOshiEvent.title}
                    </Text>
                    <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 4 }}>
                      {recentOshiEvent.event_date}
                      {recentOshiEvent.city || recentOshiEvent.venue
                        ? ` · ${[recentOshiEvent.city, recentOshiEvent.venue].filter(Boolean).join(' / ')}`
                        : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
                    {periodNoun}还没有相关活动
                  </Text>
                )}
              </TouchableOpacity>
              {trendBuckets.length > 0 ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      活跃趋势
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      活动次数 + 拍立得数量
                    </Text>
                  </View>
                  <TrendBarChart counts={monthlyOshiActivityCounts} labels={trendBuckets.map((bucket) => bucket.label)} colors={colors} />
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
                    区间活跃值 {oshiActivityTotal}
                  </Text>
                </View>
              ) : null}
            </SurfaceCard>
          ) : (
            <EmptyCard
              title="还没有设置单推"
              body='先去 「我的」 页设置单推吧'
              colors={colors}
            />
          )}
        </>
      );
    }

    if (sectionType === 'spending') {
      return (
        <>
          <SectionHeader title="支出统计" colors={colors} />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBox label="全部总花费" value={totalSpend > 0 ? formatCurrency(totalSpend) : '—'} colors={colors} />
            <StatBox
              label="平均单场活动花费"
              value={averageEventSpend > 0 ? formatCurrency(averageEventSpend) : '—'}
              colors={colors}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBox label="门票总花费" value={eventTicketTotal > 0 ? formatCurrency(eventTicketTotal) : '—'} colors={colors} />
            <StatBox label="拍立得总花费" value={chekiPriceTotal > 0 ? formatCurrency(chekiPriceTotal) : '—'} colors={colors} />
          </View>
          <SurfaceCard colors={colors}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
              花费最高的 5 场活动
            </Text>
            {topSpendEvents.length > 0 ? (
              topSpendEvents.map((entry) => (
                <TouchableOpacity
                  key={entry.event.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/events/${entry.event.id}`)}
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.divider,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }} numberOfLines={1}>
                    {entry.event.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 3 }}>
                        {entry.event.event_date}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        门票 {formatCurrency(entry.ticketTotal)} + 特典 {formatCurrency(entry.chekiTotal)}
                      </Text>
                    </View>
                    <View style={{ width: 96, alignItems: 'flex-end', justifyContent: 'center', minHeight: 35 }}>
                      <Text
                        style={{ fontSize: 18, lineHeight: 20, fontWeight: '900', color: colors.text, textAlign: 'right' }}
                        numberOfLines={2}
                      >
                        {formatCurrency(entry.totalSpend)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                {periodNoun}还没有产生可统计的活动花费。
              </Text>
            )}
          </SurfaceCard>
        </>
      );
    }

    if (sectionType === 'perfectEvents') {
      return (
        <>
          <SectionHeader title="满分活动" colors={colors} />
          {perfectEvents.length > 0 ? (
            <View style={{ marginBottom: 12 }}>
              {perfectEvents.map((event) => (
                <EventCard key={event.id} event={event} oshiBadge={getEventCardOshiBadge(event.status, null)} />
              ))}
            </View>
          ) : (
            <EmptyCard
              title={`${periodLabel}还没有满分活动`}
              body="多多参加一些活动吧。"
              colors={colors}
            />
          )}
        </>
      );
    }

    return (
      <>
        <SectionHeader
          title="拍立得"
          colors={colors}
          trailing={chekiCount > 0 ? (
            <TouchableOpacity onPress={() => goToCheki()} hitSlop={6}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>查看拍立得 ›</Text>
            </TouchableOpacity>
          ) : undefined}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatBox label="总张数" value={chekiCount} colors={colors} onPress={chekiCount > 0 ? () => goToCheki() : undefined} />
          <StatBox label="总人数" value={chekiArtistCount} colors={colors} onPress={chekiCount > 0 ? () => goToCheki() : undefined} />
        </View>
        {trendBuckets.length > 0 ? (
          <SurfaceCard colors={colors}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
              数量趋势
            </Text>
            <TrendBarChart counts={monthlyChekiCounts} labels={trendBuckets.map((bucket) => bucket.label)} colors={colors} activeColor={colors.accent} />
          </SurfaceCard>
        ) : null}
        {trendBuckets.length > 0 ? <View style={{ height: 0, marginTop: -12 }} /> : null}
        {chekiArtistRanking.length > 0 ? (
          <>
            <SurfaceCard colors={colors}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                艺人占比
              </Text>
              <ChekiArtistShareChart
                items={chekiArtistItems}
                total={chekiCount}
                colors={colors}
                isDark={isDark}
              />
            </SurfaceCard>
            <SurfaceCard colors={colors}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                排行
              </Text>
              <ArtistRankingList
                items={chekiArtistItems}
                colors={colors}
                suffix="张"
                percentageTotal={chekiCount}
                onPressItem={(item) => {
                  if (item.id) goToCheki({ artist_id: item.id });
                }}
                getAccessibilityLabel={(item) => `查看${item.name}的拍立得记录`}
              />
            </SurfaceCard>
          </>
        ) : (
          <EmptyCard
            title={`${periodLabel}还没有排行`}
            body="先去添加一些拍立得吧"
            colors={colors}
          />
        )}
      </>
    );
  };

  const statsContent = visibleSections.length === 0 ? (
    <>
      {periodControls}
      <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 48 }}>
      <AppIcon name="stats" size={36} color={colors.textMuted} style={{ marginBottom: 14 }} />
      <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.text, marginBottom: 7 }}>
        暂无展示内容
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginBottom: 18 }}>
        你可以在统计自定义中重新启用活动、支出、拍立得等内容。
      </Text>
      <TouchableOpacity
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel="前往统计自定义"
        onPress={() => router.push('/settings/stats')}
        style={{
          minHeight: 44,
          justifyContent: 'center',
          borderRadius: 12,
          paddingHorizontal: 18,
          backgroundColor: colors.accent,
        }}
      >
        <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.onAccent }}>
          去自定义
        </Text>
      </TouchableOpacity>
      </View>
    </>
  ) : (
    <>
      {periodControls}
      {visibleSections.map((section) => (
        <Fragment key={section.type}>{renderStatsSection(section.type)}</Fragment>
      ))}
      {!hasAnyVisibleData ? (
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <AppIcon name="stats" size={36} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
            {period.preset === 'all' ? '暂无统计数据' : `${periodLabel} 暂无统计数据`}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>记录更多数据后，这里会慢慢变成你的统计回顾。</Text>
        </View>
      ) : null}
    </>
  );

  const periodPicker = (
    <StatsRangePicker
      visible={pickerMode != null}
      mode={pickerMode ?? 'custom'}
      period={period}
      initialCustomStartDate={statsRangeSession.getCustom()?.startDate ?? (period.preset === 'custom' ? period.startDate : null)}
      initialCustomEndDate={statsRangeSession.getCustom()?.endDate ?? (period.preset === 'custom' ? period.endDate : null)}
      onClose={() => setPickerMode(null)}
      onSelect={(next) => {
        applyPeriod(next);
        setPickerMode(null);
      }}
    />
  );

  if (!isAndroid) {
    return (
      <>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.screen }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: contentBottomPadding }}
          {...tabBarScroll}
        >
          {statsContent}
        </ScrollView>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="调整统计内容"
            tintColor={colors.accent}
            onPress={() => router.push('/settings/stats')}
          >
            调整
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        {periodPicker}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <AndroidCompactTabHeader
        title="统计"
        right={(
          renderAndroidAdjustButton()
        )}
        compactHeaderStyle={androidHeader.compactHeaderStyle}
        overlayHeight={androidHeader.overlayHeight}
        overlayPaddingTop={androidHeader.overlayPaddingTop}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        scrollIndicatorInsets={{ bottom: contentBottomPadding }}
        contentContainerStyle={{ padding: 16, paddingTop: androidHeader.contentTopPadding, paddingBottom: contentBottomPadding }}
        {...tabBarScroll}
      >
        <AndroidLargeTabTitle
          title="统计"
          right={(
            renderAndroidAdjustButton()
          )}
          largeTitleStyle={androidHeader.largeTitleStyle}
        />

        {statsContent}
      </ScrollView>
      {periodPicker}
    </View>
  );
}

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import SegmentedControl from '@expo/ui/community/segmented-control';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../../../src/components/AndroidCollapsibleTabHeader';
import { OshiAvatar } from '../../../src/components/Oshi';
import { ArtistRankingList } from '../../../src/components/ArtistRankingList';
import { ExpandableList } from '../../../src/components/ExpandableList';
import { ChekiArtistShareChart } from '../../../src/components/ChekiArtistShareChart';
import { ActivityHeatmap } from '../../../src/components/ActivityHeatmap';
import { AppIcon } from '../../../src/components/AppIcon';
import {
  StatsRangePicker,
  type StatsRangePickerMode,
} from '../../../src/components/StatsRangePicker';
import { useDB } from '../../../src/context/DBContext';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { Artist, Event, UserConfig } from '../../../src/types/models';
import type { ChekiArtistRankingItem } from '../../../src/repositories/ChekiRepository';
import type {
  EventArtistRankingItem,
  EventDailyCount,
  EventGroupRatingItem,
  EventRatingSummary,
} from '../../../src/repositories/EventRepository';
import { useAppTheme } from '../../../src/theme/appTheme';
import { getLocalDayDifference } from '../../../src/utils/dateItems';
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
  formatStatsPeriodLabel,
  getTrendLabelIndices,
  getTrendValueLabelIndices,
  parseStatsRangeParams,
  shiftStatsDateRange,
  type StatsDateRange,
  type StatsPeriodPreset,
} from '../../../src/utils/statsDateRange';
import { statsRangeSession } from '../../../src/utils/statsRangeSession';
import { buildActivityHeatmapValues, type DailyCount } from '../../../src/utils/activityHeatmap';

const RANKING_PREVIEW_LIMIT = 10;
const PERFECT_EVENT_PREVIEW_LIMIT = 5;
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
  completedDailyEventCounts: EventDailyCount[];
  dailyHeatmapChekiCounts: DailyCount[];
  topCity: LabelCount | null;
  topVenue: LabelCount | null;
  perfectEvents: Event[];
  ratingSummary: EventRatingSummary;
  topRatedGroups: EventGroupRatingItem[];
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
    completedDailyEventCounts: [],
    dailyHeatmapChekiCounts: [],
    topCity: null,
    topVenue: null,
    perfectEvents: [],
    ratingSummary: { averageScore: null, ratedCount: 0, distribution: Array(5).fill(0) },
    topRatedGroups: [],
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
  backgroundColor,
  onPress,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  compact?: boolean;
  backgroundColor?: string;
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
        backgroundColor: backgroundColor ?? colors.card,
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
        marginBottom: 12,
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
  prioritizeDataLabels = false,
  showAllLabels = false,
  showBarValues = false,
}: {
  counts: number[];
  labels: string[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  activeColor?: string;
  prioritizeDataLabels?: boolean;
  showAllLabels?: boolean;
  showBarValues?: boolean;
}) {
  const maxCount = Math.max(...counts, 1);
  const barColor = activeColor ?? colors.accent;
  const visibleLabelIndices = getTrendLabelIndices(labels.length, counts, {
    prioritizeData: prioritizeDataLabels,
    showAll: showAllLabels,
  });
  const dense = counts.length > 12;
  const visibleValueIndices = getTrendValueLabelIndices(counts, dense ? 2 : 1);
  const axisLabelWidth = dense ? 18 : 20;
  const chartHeight = dense && showBarValues ? 88 : dense ? 68 : 88;

  const getAxisLabel = (label: string) => {
    if (prioritizeDataLabels && label.includes('/')) {
      return label.slice(label.lastIndexOf('/') + 1);
    }
    return label.replace('月', '');
  };

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, gap: dense ? 1 : 4 }}>
        {counts.map((count, index) => {
          const pct = count / maxCount;
          return (
            <View key={index} style={{ flex: 1, alignItems: 'center', minWidth: 6 }}>
              {(!dense || showBarValues) ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: dense ? 9 : 10,
                    lineHeight: 12,
                    fontWeight: '700',
                    color: count > 0 ? colors.textSecondary : colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  {count > 0 && visibleValueIndices.has(index) ? count : ''}
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
          <View key={index} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="clip"
              style={{
                width: axisLabelWidth,
                fontSize: 8,
                fontWeight: '500',
                color: colors.textMuted,
                lineHeight: 12,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {visibleLabelIndices.has(index) ? getAxisLabel(label) : ''}
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
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
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

function formatRating(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatRecentEventAge(date: string): string {
  const difference = getLocalDayDifference(date);
  if (difference > 0) return `还有 ${difference} 天`;
  if (difference === 0) return '今天';
  return `${Math.abs(difference)} 天前`;
}

function SpendRankingList({
  items,
  colors,
  onPressItem,
}: {
  items: readonly SpendEntry[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  onPressItem: (entry: SpendEntry) => void;
}) {
  return (
    <View>
      {items.map((entry, index) => {
        const isLast = index === items.length - 1;
        return (
          <TouchableOpacity
            key={entry.event.id}
            activeOpacity={0.7}
            onPress={() => onPressItem(entry)}
            accessibilityRole="button"
            accessibilityLabel={`查看活动详情：${entry.event.title}，花费 ${formatCurrency(entry.totalSpend)}`}
            style={{
              minHeight: 60,
              paddingVertical: 9,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: colors.divider,
              justifyContent: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                  {entry.event.title}
                </Text>
                <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, color: colors.textSecondary }}>
                  {entry.event.event_date} · 门票 {formatCurrency(entry.ticketTotal)} + 特典 {formatCurrency(entry.chekiTotal)}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{ fontSize: 13, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] }}
              >
                {formatCurrency(entry.totalSpend)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PerfectEventList({
  items,
  colors,
  onPressItem,
}: {
  items: readonly Event[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  onPressItem: (event: Event) => void;
}) {
  return (
    <View>
      {items.map((event, index) => {
        const location = [event.city, event.venue].filter(Boolean).join(' / ');
        const isLast = index === items.length - 1;
        return (
          <TouchableOpacity
            key={event.id}
            activeOpacity={0.7}
            onPress={() => onPressItem(event)}
            accessibilityRole="button"
            accessibilityLabel={`查看活动详情：${event.title}，评分 5 分`}
            style={{
              minHeight: 60,
              paddingVertical: 9,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: colors.divider,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                {event.title}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 5, fontSize: 12, color: colors.textSecondary }}>
                {event.event_date}{location ? ` · ${location}` : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] }}>
              5 分
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function GroupRatingList({
  items,
  colors,
  onPressItem,
}: {
  items: readonly EventGroupRatingItem[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  onPressItem: (item: EventGroupRatingItem) => void;
}) {
  return (
    <View>
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.artistId}
          activeOpacity={0.7}
          onPress={() => onPressItem(item)}
          accessibilityRole="button"
          accessibilityLabel={`查看${item.name}参与的已完成活动，综合分 ${item.rankingScore}，平均评分 ${formatRating(item.averageScore)}，${item.ratedCount} 场已评分`}
          style={{
            minHeight: 56,
            paddingVertical: 9,
            borderBottomWidth: index === items.length - 1 ? 0 : 1,
            borderBottomColor: colors.divider,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <OshiAvatar source={resolveAvatarSource(item.avatarUri)} size={38} isOshi={false} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
              {item.name}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 11, color: colors.textSecondary }}>
              平均 {formatRating(item.averageScore)} 分 · {item.ratedCount} 场已评分
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] }}>
              {item.rankingScore}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 10, color: colors.textMuted }}>综合分</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
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
  const [preferredPickerMode, setPreferredPickerMode] = useState<StatsRangePickerMode | null>(null);
  const [stats, setStats] = useState<StatsState | null>(null);
  const [statsSections, setStatsSections] = useState<StatsSectionConfig[] | null>(null);
  const loadRequestIdRef = useRef(0);

  const startDateArg = period.startDate ?? undefined;
  const endDateArg = period.endDate ?? undefined;
  const heatmapYear = period.preset === 'year' && period.startDate
    ? Number(period.startDate.slice(0, 4))
    : null;
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
        needsActivityHeatmap,
        needsOshi,
        needsSpending,
        needsPerfectEvents,
        needsCheki,
        needsStatusCounts,
        needsChekiCount,
      } = createStatsLoadPlan(preferences.sections);
      const empty = createEmptyStatsState();
      const dailyChekiCountsPromise = (
        (needsCheki || (needsActivityHeatmap && heatmapYear != null))
        && startDateArg
        && endDateArg
      )
        ? db.cheki.getDailyCountsByRange(startDateArg, endDateArg)
        : Promise.resolve(empty.dailyHeatmapChekiCounts);

      const [
        statusCounts,
        monthlyEventCounts,
        completedDailyEventCounts,
        dailyHeatmapChekiCounts,
        topCity,
        topVenue,
        perfectEvents,
        ratingSummary,
        topRatedGroups,
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
        needsActivityHeatmap && heatmapYear != null
          ? db.events.getCompletedDailyCountsByYear(heatmapYear)
          : Promise.resolve(empty.completedDailyEventCounts),
        needsActivityHeatmap && heatmapYear != null && startDateArg && endDateArg
          ? dailyChekiCountsPromise
          : Promise.resolve(empty.dailyHeatmapChekiCounts),
        needsActivity ? db.events.findTopCityByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(null),
        needsActivity ? db.events.findTopVenueByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(null),
        needsPerfectEvents ? db.events.findPerfectEventsByYear(undefined, undefined, null, startDateArg, endDateArg) : Promise.resolve([]),
        needsPerfectEvents
          ? db.events.getRatingSummaryByYear(undefined, undefined, startDateArg, endDateArg)
          : Promise.resolve(empty.ratingSummary),
        needsPerfectEvents
          ? db.events.findTopRatedRootArtistsByYear(undefined, undefined, 5, startDateArg, endDateArg)
          : Promise.resolve(empty.topRatedGroups),
        needsOshi || needsCheki ? db.userConfig.getConfig() : Promise.resolve(null),
        needsChekiCount ? db.cheki.countByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsCheki ? db.cheki.countDistinctArtistsByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsCheki && startDateArg && endDateArg
          ? dailyChekiCountsPromise.then((rows) => aggregateTrendCounts(rows, trendBuckets))
          : Promise.resolve(empty.monthlyChekiCounts),
        needsCheki ? db.cheki.groupByArtistYear(undefined, undefined, undefined, startDateArg, endDateArg) : Promise.resolve([]),
        needsSpending ? db.cheki.sumPriceByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsSpending ? db.events.sumCompletedTicketPriceByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsSpending ? db.events.getAverageCompletedSpendByYear(undefined, undefined, startDateArg, endDateArg) : Promise.resolve(0),
        needsSpending ? db.events.findTopSpendCompletedByYear(undefined, undefined, 5, startDateArg, endDateArg) : Promise.resolve([]),
        needsActivity
          ? db.events.groupRootArtistsByCompletedEvents(undefined, undefined, undefined, startDateArg, endDateArg)
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
        completedDailyEventCounts,
        dailyHeatmapChekiCounts,
        topCity,
        topVenue,
        perfectEvents,
        ratingSummary,
        topRatedGroups,
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
        '无法载入统计数据',
        '请稍后再试。如果仍无法载入，请重新启动 App。',
        error,
      );
    }
  }, [db, endDateArg, heatmapYear, startDateArg, trendBuckets]);

  useEffect(() => {
    if (!routePeriod) return;
    statsRangeSession.rememberCustom(routePeriod);
    setPreferredPickerMode(routePeriod.preset === 'all' ? 'custom' : routePeriod.preset);

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
      accessibilityLabel="编辑统计内容"
      style={{
        minWidth: 52,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accent }}>编辑</Text>
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
    setPreferredPickerMode(next.preset === 'all' ? 'custom' : next.preset);
    router.setParams({
      preset: next.preset,
      startDate: next.startDate ?? '',
      endDate: next.endDate ?? '',
      year: '',
      month: '',
    });
  }, [router]);

  const openPicker = useCallback((mode: StatsRangePickerMode) => {
    setPreferredPickerMode(mode);
    setPickerMode(mode);
  }, []);

  if (!stats || !statsSections) {
    return <View style={{ flex: 1, backgroundColor: colors.screen }} />;
  }

  const {
    statusCounts,
    monthlyEventCounts,
    completedDailyEventCounts,
    dailyHeatmapChekiCounts,
    topCity,
    topVenue,
    perfectEvents,
    ratingSummary,
    topRatedGroups,
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
  const periodNoun = '所选时间';
  const rankingResetKey = `${period.preset}:${period.startDate ?? ''}:${period.endDate ?? ''}`;
  const oshiArtistId = userConfig?.oshi_artist_id ?? null;
  const activityHeatmapValues = buildActivityHeatmapValues(
    completedDailyEventCounts,
    dailyHeatmapChekiCounts,
  );
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
    if (section.type === 'activityHeatmap') return true;
    if (section.type === 'oshi') return oshiCompletedCount > 0 || oshiChekiCount > 0;
    if (section.type === 'spending') return totalSpend > 0 || topSpendEvents.length > 0;
    if (section.type === 'perfectEvents') return ratingSummary.ratedCount > 0;
    return chekiCount > 0;
  });
  const navigablePreset = period.preset === 'week' || period.preset === 'month' || period.preset === 'year'
    ? period.preset
    : null;
  const canNavigatePeriod = navigablePreset != null;
  const navigatorLabel = formatStatsPeriodLabel(period);
  const previousPeriodLabel = navigablePreset === 'week'
    ? '上一周'
    : navigablePreset === 'month'
      ? '上个月'
      : '上一年';
  const nextPeriodLabel = navigablePreset === 'week'
    ? '下一周'
    : navigablePreset === 'month'
      ? '下个月'
      : '下一年';

  const periodControls = (
    <View
      style={{ gap: 8 }}
    >
      <SegmentedControl
        values={PERIOD_PRESETS.map(({ label }) => label)}
        selectedIndex={PERIOD_PRESETS.findIndex(({ preset }) => (
          preset === (preferredPickerMode ?? (period.preset === 'all' ? 'custom' : period.preset))
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
            openPicker('custom');
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
          accessibilityLabel={previousPeriodLabel}
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
          onPress={() => openPicker(preferredPickerMode ?? navigablePreset ?? 'custom')}
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
          accessibilityLabel={nextPeriodLabel}
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
          <SectionHeader title="活动" colors={colors} />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBox label="已完成" value={statusCounts.completed} colors={colors} onPress={() => goToEvents({ status: 'completed' })} />
            <StatBox label="计划中" value={statusCounts.planned} colors={colors} onPress={() => goToEvents({ status: 'planned' })} />
            <StatBox label="心愿单" value={statusCounts.wishlist} colors={colors} onPress={() => goToEvents({ status: 'wishlist' })} />
          </View>
          <SurfaceCard colors={colors} style={{ paddingBottom: rootArtistEventRanking.length > 0 ? 0 : 16 }}>
            {trendBuckets.length > 0 ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                  活动趋势
                </Text>
                <TrendBarChart
                  counts={monthlyEventCounts}
                  labels={trendBuckets.map((bucket) => bucket.label)}
                  colors={colors}
                  showBarValues={period.preset === 'month'}
                  prioritizeDataLabels={period.preset === 'month'}
                  showAllLabels={period.preset === 'year'}
                />
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
                  {topCity ? `${topCity.count} 场` : '无数据'}
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
                  {topVenue ? `${topVenue.count} 场` : '无数据'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                艺人排行
              </Text>
              {rootArtistEventRanking.length > 0 ? (
                <ExpandableList
                  items={rootArtistEventRanking.map((item) => ({
                    id: item.artistId,
                    name: item.name,
                    avatarUri: item.avatarUri,
                    value: item.count,
                  }))}
                  initialVisibleCount={RANKING_PREVIEW_LIMIT}
                  resetKey={rankingResetKey}
                  expandLabel={(hiddenCount) => `展开其余 ${hiddenCount} 位`}
                  collapseLabel={() => '收起排行'}
                  renderItems={(items) => (
                    <ArtistRankingList
                      items={items}
                      colors={colors}
                      suffix="场"
                      onPressItem={(item) => {
                        if (item.id) goToEvents({ artist_id: item.id, status: 'completed' });
                      }}
                      getAccessibilityLabel={(item) => `查看${item.name}参与的已完成活动`}
                    />
                  )}
                />
              ) : (
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                  无数据
                </Text>
              )}
            </View>
          </SurfaceCard>
        </>
      );
    }

    if (sectionType === 'activityHeatmap') {
      return (
        <>
          <SectionHeader title="活跃度" colors={colors} />
          {heatmapYear == null ? (
            <EmptyCard
              title="选择“年”查看活跃度"
              body="仅支持年度视图"
              colors={colors}
            />
          ) : (
            <SurfaceCard colors={colors}>
              <ActivityHeatmap year={heatmapYear} values={activityHeatmapValues} colors={colors} />
            </SurfaceCard>
          )}
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
                  sub={statusCounts.completed > 0 ? `活动 · 占比 ${oshiEventRatio}%` : '暂无已完成活动'}
                  colors={colors}
                  compact
                  backgroundColor={colors.accentSoft}
                  onPress={() => goToEvents({ artist_id: oshiArtistId, status: 'completed' })}
                />
                <StatBox
                  label="单推拍立得"
                  value={oshiChekiCount}
                  sub={chekiCount > 0 ? `拍立得 · 占比 ${oshiChekiRatio}%` : '暂无拍立得'}
                  colors={colors}
                  compact
                  backgroundColor={colors.accentSoft}
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
                  {recentOshiEvent ? (
                    <Text style={{ fontWeight: '900' }}> · {formatRecentEventAge(recentOshiEvent.event_date)}</Text>
                  ) : null}
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
                    {periodNoun}范围内没有相关活动
                  </Text>
                )}
              </TouchableOpacity>
              {trendBuckets.length > 0 ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      活跃度
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      活动与拍立得
                    </Text>
                  </View>
                  <TrendBarChart
                    counts={monthlyOshiActivityCounts}
                    labels={trendBuckets.map((bucket) => bucket.label)}
                    colors={colors}
                    showBarValues={period.preset === 'month'}
                    prioritizeDataLabels={period.preset === 'month'}
                    showAllLabels={period.preset === 'year'}
                  />
                </View>
              ) : null}
            </SurfaceCard>
          ) : (
            <EmptyCard
              title="未设置单推"
              body='在“我的”中设置单推后，即可查看相关活动和拍立得。'
              colors={colors}
            />
          )}
        </>
      );
    }

    if (sectionType === 'spending') {
      return (
        <>
          <SectionHeader title="支出" colors={colors} />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBox label="总支出" value={totalSpend > 0 ? formatCurrency(totalSpend) : '—'} colors={colors} />
            <StatBox
              label="场均支出"
              value={averageEventSpend > 0 ? formatCurrency(averageEventSpend) : '—'}
              colors={colors}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <StatBox label="门票" value={eventTicketTotal > 0 ? formatCurrency(eventTicketTotal) : '—'} colors={colors} />
            <StatBox label="拍立得" value={chekiPriceTotal > 0 ? formatCurrency(chekiPriceTotal) : '—'} colors={colors} />
          </View>
          <SurfaceCard colors={colors} style={{ paddingBottom: topSpendEvents.length > 0 ? 0 : 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
              支出最高的活动
            </Text>
            {topSpendEvents.length > 0 ? (
              <SpendRankingList
                items={topSpendEvents}
                colors={colors}
                onPressItem={(entry) => router.push(`/events/${entry.event.id}`)}
              />
            ) : (
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                {periodNoun}内没有可统计的支出。
              </Text>
            )}
          </SurfaceCard>
        </>
      );
    }

    if (sectionType === 'perfectEvents') {
      return (
        <>
          <SectionHeader title="活动评分" colors={colors} />
          {ratingSummary.ratedCount > 0 ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <StatBox
                  label="平均评分"
                  value={ratingSummary.averageScore == null ? '—' : formatRating(ratingSummary.averageScore)}
                  colors={colors}
                />
                <StatBox label="已评分活动" value={ratingSummary.ratedCount} colors={colors} />
              </View>
              <SurfaceCard colors={colors} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                  评分分布
                </Text>
                <TrendBarChart
                  counts={ratingSummary.distribution}
                  labels={['1 星', '2 星', '3 星', '4 星', '5 星']}
                  colors={colors}
                  showBarValues
                  showAllLabels
                />
              </SurfaceCard>
              <SurfaceCard
                colors={colors}
                style={{ marginBottom: 12, paddingBottom: topRatedGroups.length > 0 ? 0 : 16 }}
              >
                <View style={{ marginBottom: topRatedGroups.length > 0 ? 5 : 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    团体评分排行
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.textSecondary }}>
                    综合分基于平均评分与场次计算。
                  </Text>
                </View>
                {topRatedGroups.length > 0 ? (
                  <GroupRatingList
                    items={topRatedGroups}
                    colors={colors}
                    onPressItem={(item) => goToEvents({ artist_id: item.artistId, status: 'completed' })}
                  />
                ) : (
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                    已评分活动关联团体后，这里会显示排行。
                  </Text>
                )}
              </SurfaceCard>
              <SurfaceCard
                colors={colors}
                style={{ paddingBottom: perfectEvents.length > 0 ? 0 : 16 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                  满分活动
                </Text>
                {perfectEvents.length > 0 ? (
                  <ExpandableList
                    items={perfectEvents}
                    initialVisibleCount={PERFECT_EVENT_PREVIEW_LIMIT}
                    resetKey={rankingResetKey}
                    expandLabel={(hiddenCount) => `展开其余 ${hiddenCount} 场`}
                    collapseLabel={() => '收起活动'}
                    renderItems={(items) => (
                      <PerfectEventList
                        items={items}
                        colors={colors}
                        onPressItem={(event) => router.push(`/events/${event.id}`)}
                      />
                    )}
                  />
                ) : (
                  <Text style={{ marginTop: 9, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                    所选时间内没有满分活动。
                  </Text>
                )}
              </SurfaceCard>
            </>
          ) : (
            <EmptyCard
              title="暂无活动评分"
              body="为活动评分后，此处会显示评分回顾。"
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
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>查看全部</Text>
            </TouchableOpacity>
          ) : undefined}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatBox label="拍立得" value={chekiCount} colors={colors} onPress={chekiCount > 0 ? () => goToCheki() : undefined} />
          <StatBox label="艺人数" value={chekiArtistCount} colors={colors} onPress={chekiCount > 0 ? () => goToCheki() : undefined} />
        </View>
        {trendBuckets.length > 0 ? (
          <SurfaceCard colors={colors} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
              分布
            </Text>
            <TrendBarChart
              counts={monthlyChekiCounts}
              labels={trendBuckets.map((bucket) => bucket.label)}
              colors={colors}
              activeColor={colors.accent}
              showBarValues={period.preset === 'month'}
              prioritizeDataLabels={period.preset === 'month'}
              showAllLabels={period.preset === 'year'}
            />
          </SurfaceCard>
        ) : null}
        {chekiArtistRanking.length > 0 ? (
          <>
            <SurfaceCard colors={colors} style={{ marginBottom: 12 }}>
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
            <SurfaceCard colors={colors} style={{ paddingBottom: 0 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                艺人排行
              </Text>
              <ExpandableList
                items={chekiArtistItems}
                initialVisibleCount={RANKING_PREVIEW_LIMIT}
                resetKey={rankingResetKey}
                expandLabel={(hiddenCount) => `展开其余 ${hiddenCount} 位`}
                collapseLabel={() => '收起排行'}
                renderItems={(items) => (
                  <ArtistRankingList
                    items={items}
                    colors={colors}
                    suffix="张"
                    percentageTotal={chekiCount}
                    onPressItem={(item) => {
                      if (item.id) goToCheki({ artist_id: item.id });
                    }}
                    getAccessibilityLabel={(item) => `查看${item.name}的拍立得记录`}
                  />
                )}
              />
            </SurfaceCard>
          </>
        ) : (
          <EmptyCard
            title="暂无拍立得排行"
            body="添加拍立得并关联艺人后，此处会显示排行。"
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
        未显示任何内容
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginBottom: 18 }}>
        在“统计自定义”中选择要显示的内容。
      </Text>
      <TouchableOpacity
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel="编辑统计内容"
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
          去编辑
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
            暂无统计数据
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
            accessibilityLabel="编辑统计内容"
            tintColor={colors.accent}
            onPress={() => router.push('/settings/stats')}
          >
            编辑
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

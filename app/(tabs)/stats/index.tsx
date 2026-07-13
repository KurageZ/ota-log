import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../../../src/components/AndroidCollapsibleTabHeader';
import { EventCard } from '../../../src/components/EventCard';
import { getEventCardOshiBadge } from '../../../src/utils/oshiMatch';
import { OshiAvatar } from '../../../src/components/Oshi';
import { ArtistRankingList } from '../../../src/components/ArtistRankingList';
import { AppIcon } from '../../../src/components/AppIcon';
import { BottomSheetDialog } from '../../../src/components/BottomSheetDialog';
import { useDB } from '../../../src/context/DBContext';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { Artist, Event, UserConfig } from '../../../src/types/models';
import type { ChekiArtistRankingItem } from '../../../src/repositories/ChekiRepository';
import type { EventArtistRankingItem } from '../../../src/repositories/EventRepository';
import { useAppTheme } from '../../../src/theme/appTheme';
import { useFloatingTabBarSpacing } from '../../../src/navigation/floatingTabBar';
import { useFloatingTabBarScroll } from '../../../src/navigation/FloatingTabBarVisibility';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const EVENT_RANKING_LIMIT = 10;

interface Period {
  year: number | null;
  month: number | null;
}

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
  userConfig: UserConfig;
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

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseRoutePeriod(
  yearParam: string | string[] | undefined,
  monthParam: string | string[] | undefined,
): Period | null {
  const yearValue = getSingleParam(yearParam);
  if (!yearValue) return null;

  const year = Number(yearValue);
  if (!Number.isInteger(year) || year < 1900) return null;

  const monthValue = getSingleParam(monthParam);
  if (!monthValue) return { year, month: null };

  const month = Number(monthValue);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { year, month: null };

  return { year, month };
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

function MonthlyBarChart({
  counts,
  colors,
  activeColor,
  highlightIndex,
}: {
  counts: number[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  activeColor?: string;
  highlightIndex?: number;
}) {
  const maxCount = Math.max(...counts, 1);
  const barColor = activeColor ?? colors.accent;
  const hasHighlight = highlightIndex != null;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 88, gap: 4 }}>
        {counts.map((count, index) => {
          const pct = count / maxCount;
          const dimmed = hasHighlight && index !== highlightIndex;
          return (
            <View key={index} style={{ flex: 1, alignItems: 'center', opacity: dimmed ? 0.32 : 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: count > 0 ? colors.textSecondary : colors.textMuted, marginBottom: 6 }}>
                {count}
              </Text>
              <View
                style={{
                  width: '100%',
                  height: Math.max(6, pct * 60),
                  borderRadius: 4,
                  backgroundColor: count > 0 ? barColor : colors.inputBorder,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 8, gap: 4 }}>
        {MONTHS.map((month, index) => (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 8,
                fontWeight: hasHighlight && index === highlightIndex ? '900' : '400',
                color: hasHighlight && index === highlightIndex ? colors.accent : colors.textMuted,
              }}
            >
              {month.replace('月', '')}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function PeriodPickerModal({
  visible,
  period,
  colors,
  onClose,
  onSelect,
}: {
  visible: boolean;
  period: Period;
  colors: ReturnType<typeof useAppTheme>['colors'];
  onClose: () => void;
  onSelect: (next: Period) => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [draftYear, setDraftYear] = useState(period.year ?? currentYear);

  useEffect(() => {
    if (visible) {
      setDraftYear(period.year ?? currentYear);
    }
  }, [visible, period.year]);

  const isAllTimeSelected = period.year == null;
  const isWholeYearSelected = period.year === draftYear && period.month == null;

  return (
    <BottomSheetDialog
      visible={visible}
      title="选择时间"
      onClose={onClose}
      maxHeightRatio={0.58}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}
    >
      <TouchableOpacity
        onPress={() => onSelect({ year: null, month: null })}
        style={{
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          marginBottom: 14,
          backgroundColor: isAllTimeSelected ? colors.accent : colors.card,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '800', color: isAllTimeSelected ? colors.onAccent : colors.text }}>
          所有时间
        </Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => setDraftYear((v) => v - 1)}
          style={{ padding: 8, borderRadius: 10, backgroundColor: colors.card }}
        >
          <Text style={{ fontSize: 18, color: colors.accent, fontWeight: '700' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.heading, minWidth: 72, textAlign: 'center' }}>
          {draftYear}
        </Text>
        <TouchableOpacity
          onPress={() => setDraftYear((v) => v + 1)}
          disabled={draftYear >= currentYear}
          style={{ padding: 8, borderRadius: 10, backgroundColor: colors.card, opacity: draftYear >= currentYear ? 0.4 : 1 }}
        >
          <Text style={{ fontSize: 18, color: colors.accent, fontWeight: '700' }}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => onSelect({ year: draftYear, month: null })}
        style={{
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          marginBottom: 14,
          backgroundColor: isWholeYearSelected ? colors.accent : colors.card,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '800', color: isWholeYearSelected ? colors.onAccent : colors.text }}>
          全年
        </Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MONTHS.map((label, index) => {
          const month = index + 1;
          const disabled = draftYear > currentYear || (draftYear === currentYear && month > currentMonth);
          const selected = period.year === draftYear && period.month === month;
          return (
            <TouchableOpacity
              key={month}
              disabled={disabled}
              onPress={() => onSelect({ year: draftYear, month })}
              style={{
                width: '22%',
                flexGrow: 1,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: selected ? colors.accent : colors.card,
                opacity: disabled ? 0.32 : 1,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: selected ? colors.onAccent : colors.text }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheetDialog>
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

export default function StatsScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const isAndroid = Platform.OS === 'android';
  const androidHeader = useAndroidCollapsibleTabHeader();
  const iosTabBarScroll = useFloatingTabBarScroll();
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const currentYear = new Date().getFullYear();
  const routePeriod = useMemo(
    () => parseRoutePeriod(params.year, params.month),
    [params.year, params.month]
  );
  const [period, setPeriod] = useState<Period>(
    () => routePeriod ?? { year: currentYear, month: null }
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [stats, setStats] = useState<StatsState | null>(null);

  const { year, month } = period;
  const yearArg = year ?? undefined;
  const monthArg = month ?? undefined;
  const routePeriodPending = routePeriod != null && (
    period.year !== routePeriod.year || period.month !== routePeriod.month
  );

  const tabBarScroll = isAndroid ? androidHeader.scrollProps : iosTabBarScroll;

  const loadData = useCallback(async () => {
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
      db.events.getYearStatusCounts(yearArg, monthArg),
      year == null ? Promise.resolve(Array(12).fill(0)) : db.events.getMonthlyCountsByYear(year),
      db.events.findTopCityByYear(yearArg, monthArg),
      db.events.findTopVenueByYear(yearArg, monthArg),
      db.events.findPerfectEventsByYear(yearArg, monthArg),
      db.userConfig.getConfig(),
      db.cheki.countByYear(yearArg, monthArg),
      db.cheki.countDistinctArtistsByYear(yearArg, monthArg),
      year == null ? Promise.resolve(Array(12).fill(0)) : db.cheki.getMonthlyCountsByYear(year),
      db.cheki.groupByArtistYear(yearArg, monthArg),
      db.cheki.sumPriceByYear(yearArg, monthArg),
      db.events.sumCompletedTicketPriceByYear(yearArg, monthArg),
      db.events.getAverageCompletedSpendByYear(yearArg, monthArg),
      db.events.findTopSpendCompletedByYear(yearArg, monthArg),
      db.events.groupRootArtistsByCompletedEvents(yearArg, monthArg, EVENT_RANKING_LIMIT),
    ]);

    const [
      oshiArtist,
      oshiCompletedCount,
      recentOshiEvent,
      oshiChekiCount,
      monthlyOshiEventCounts,
      monthlyOshiChekiCounts,
    ] = userConfig.oshi_artist_id
        ? await Promise.all([
          db.artists.findById(userConfig.oshi_artist_id),
          db.events.countCompletedByArtistYear(yearArg, userConfig.oshi_artist_id, monthArg),
          db.events.findRecentCompletedByArtistYear(yearArg, userConfig.oshi_artist_id, monthArg),
          db.cheki.countByArtistYear(yearArg, userConfig.oshi_artist_id, monthArg),
          year == null
            ? Promise.resolve(Array(12).fill(0))
            : db.events.getMonthlyCompletedCountsByArtistYear(year, userConfig.oshi_artist_id),
          year == null
            ? Promise.resolve(Array(12).fill(0))
            : db.cheki.getMonthlyCountsByArtistYear(year, userConfig.oshi_artist_id),
        ])
        : [null, 0, null, 0, Array(12).fill(0), Array(12).fill(0)];

    const monthlyOshiActivityCounts = monthlyOshiEventCounts.map(
      (count, index) => count + (monthlyOshiChekiCounts[index] ?? 0)
    );

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
  }, [db, year, yearArg, monthArg]);

  useEffect(() => {
    if (!routePeriod) return;

    setPeriod((current) => (
      current.year === routePeriod.year && current.month === routePeriod.month
        ? current
        : routePeriod
    ));
  }, [routePeriod]);

  useFocusEffect(useCallback(() => {
    if (routePeriodPending) return;
    loadData();
  }, [loadData, routePeriodPending]));

  const periodButtonLabel = year == null
    ? '所有时间'
    : month != null
      ? `${year}.${String(month).padStart(2, '0')}`
      : `${year}`;

  const renderPeriodButton = useCallback(() => (
    <TouchableOpacity
      onPress={() => setPickerVisible(true)}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: colors.accent,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.onAccent }}>{periodButtonLabel}</Text>
      <Text style={{ fontSize: 9, color: colors.onAccent }}>▼</Text>
    </TouchableOpacity>
  ), [periodButtonLabel, colors]);

  const periodParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {};
    if (year != null) params.year = String(year);
    if (month != null) params.month = String(month);
    return params;
  }, [year, month]);

  const goToEvents = useCallback((extra: Record<string, string>) => {
    router.push({ pathname: '/events', params: { ...periodParams(), ...extra } });
  }, [router, periodParams]);

  const goToCheki = useCallback((extra: Record<string, string> = {}) => {
    router.push({ pathname: '/cheki', params: { ...periodParams(), ...extra } });
  }, [router, periodParams]);

  const highlightIndex = month != null ? month - 1 : undefined;

  if (!stats) {
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
  const hasAnyData = eventTotal > 0 || chekiCount > 0;
  const periodLabel = year == null ? '所有时间' : month != null ? `${year} 年 ${month} 月` : `${year} 年度`;
  const periodNoun = year == null ? '所有时间' : month != null ? '这个月' : '这一年';

  const statsContent = (
    <>
      <SectionHeader title="活动统计" colors={colors} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatBox label="已完成" value={statusCounts.completed} colors={colors} onPress={() => goToEvents({ status: 'completed' })} />
        <StatBox label="已计划" value={statusCounts.planned} colors={colors} onPress={() => goToEvents({ status: 'planned' })} />
        <StatBox label="心愿单" value={statusCounts.wishlist} colors={colors} onPress={() => goToEvents({ status: 'wishlist' })} />
      </View>
      <SurfaceCard colors={colors}>
        {year != null ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
              月度数量分布
            </Text>
            <MonthlyBarChart counts={monthlyEventCounts} colors={colors} highlightIndex={highlightIndex} />
          </>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: year != null ? 18 : 0 }}>
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

      <SectionHeader title="单推" colors={colors} />
      {userConfig.oshi_artist_id ? (
        <SurfaceCard colors={colors}>
          {oshiArtist ? <OshiCardTitle artist={oshiArtist} /> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <StatBox
              label="相关活动"
              value={oshiCompletedCount}
              sub={statusCounts.completed > 0 ? `相关活动 · 占比 ${oshiEventRatio}%` : '相关活动 · 暂无数据'}
              colors={colors}
              compact
              onPress={userConfig.oshi_artist_id
                ? () => goToEvents({ artist_id: userConfig.oshi_artist_id as string, status: 'completed' })
                : undefined}
            />
            <StatBox
              label="单推拍立得"
              value={oshiChekiCount}
              sub={chekiCount > 0 ? `拍立得 · 占比 ${oshiChekiRatio}%` : '拍立得 · 暂无数据'}
              colors={colors}
              compact
              onPress={userConfig.oshi_artist_id
                ? () => goToCheki({ artist_id: userConfig.oshi_artist_id as string })
                : undefined}
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
              marginBottom: year != null ? 14 : 0,
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
          {year != null ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                  月度活跃
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  活动次数 + 拍立得数量
                </Text>
              </View>
              <MonthlyBarChart counts={monthlyOshiActivityCounts} colors={colors} highlightIndex={highlightIndex} />
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
                全年活跃值 {oshiActivityTotal}
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
      {year != null ? (
        <SurfaceCard colors={colors}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
            月度分布
          </Text>
          <MonthlyBarChart counts={monthlyChekiCounts} colors={colors} activeColor={colors.accent} highlightIndex={highlightIndex} />
        </SurfaceCard>
      ) : null}
      {year != null ? <View style={{ height: 0, marginTop: -12 }} /> : null}
      {chekiArtistRanking.length > 0 ? (
        <SurfaceCard colors={colors}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
            排行
          </Text>
          <ArtistRankingList
            items={chekiArtistRanking.map((item) => ({
              id: item.artistId,
              name: item.name,
              avatarUri: item.avatarUri,
              value: item.count,
            }))}
            colors={colors}
            suffix="张"
            onPressItem={(item) => {
              if (item.id) goToCheki({ artist_id: item.id });
            }}
            getAccessibilityLabel={(item) => `查看${item.name}的拍立得记录`}
          />
        </SurfaceCard>
      ) : (
        <EmptyCard
          title={`${periodLabel}还没有排行`}
          body="先去添加一些拍立得吧"
          colors={colors}
        />
      )}

      {!hasAnyData ? (
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <AppIcon name="stats" size={36} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
            {year == null ? '暂无统计数据' : `${periodLabel}暂无统计数据`}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>记录更多数据后，这里会慢慢变成你的统计回顾。</Text>
        </View>
      ) : null}
    </>
  );

  const periodPicker = (
    <PeriodPickerModal
      visible={pickerVisible}
      period={period}
      colors={colors}
      onClose={() => setPickerVisible(false)}
      onSelect={(next) => {
        setPeriod(next);
        router.setParams({
          year: next.year == null ? '' : String(next.year),
          month: next.month == null ? '' : String(next.month),
        });
        setPickerVisible(false);
      }}
    />
  );

  if (!isAndroid) {
    return (
      <>
        <Stack.Screen options={{ headerRight: renderPeriodButton }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.screen }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          scrollIndicatorInsets={{ bottom: contentBottomPadding }}
          contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: contentBottomPadding }}
          {...tabBarScroll}
        >
          {statsContent}
        </ScrollView>
        {periodPicker}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <AndroidCompactTabHeader
        title="统计"
        right={renderPeriodButton()}
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
          right={renderPeriodButton()}
          largeTitleStyle={androidHeader.largeTitleStyle}
        />

        {statsContent}
      </ScrollView>
      {periodPicker}
    </View>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, NativeScrollEvent, NativeSyntheticEvent, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useDB } from '../../src/context/DBContext';
import { Cheki, Event, UserConfig } from '../../src/types/models';
import type { HeroBannerItem } from '../../src/components/HeroBanner';
import { HomeUpcomingHero } from '../../src/components/HomeUpcomingHero';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../../src/components/AndroidCollapsibleTabHeader';
import { HomeTimelineEventCard } from '../../src/components/HomeTimelineEventCard';
import { HomeCompletedEventCard } from '../../src/components/HomeCompletedEventCard';
import {
  HomeChekiOverviewCard,
  HomeChekiPreview,
  HomeFeaturedArtistsCard,
  HomeFeaturedArtistData,
  HomeImportantDatesCard,
  HomeMonthOverviewCard,
  HomeMonthOverviewData,
} from '../../src/components/HomeDashboardCards';
import type { HydratedDateItem } from '../../src/repositories/DateItemRepository';
import { AppIcon } from '../../src/components/AppIcon';
import { EventCardOshiBadge, getEventCardOshiBadge, getOshiMatchSource } from '../../src/utils/oshiMatch';
import { buildHomeTimelineGroups } from '../../src/utils/homeTimeline';
import { useAppTheme } from '../../src/theme/appTheme';
import { useFloatingTabBarSpacing } from '../../src/navigation/floatingTabBar';
import { useFloatingTabBarScroll } from '../../src/navigation/FloatingTabBarVisibility';
import { withAlpha } from '../../src/utils/color';
import {
  DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT,
  HomeCardConfig,
  HomePinnedInfoConfig,
  RECENT_COMPLETED_DISPLAY_ALL,
  createDefaultHomeCards,
  createDefaultHomePinnedInfo,
  getHomeCardKey,
  loadHomePreferences,
} from '../../src/utils/homePreferences';
import {
  HomePinnedArtistHero,
  HomePinnedMonthSummaryHero,
  HomePinnedNextEventEmptyHero,
} from '../../src/components/HomePinnedInfoHero';
import { toISODate } from '../../src/utils/date';

type UpcomingItem = {
  event: Event;
  oshiBadge: EventCardOshiBadge;
};

function HomeModuleHeader({
  title,
  count,
  actionLabel,
  onActionPress,
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
      <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '700', color: colors.heading }}>{title}</Text>
      {count != null && (
        <View style={{ marginLeft: 6, borderRadius: 99, backgroundColor: colors.accentSoft, paddingHorizontal: 7, paddingVertical: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent }}>{count}</Text>
        </View>
      )}
      {actionLabel && onActionPress && (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.6}
          style={{ marginLeft: 'auto', minHeight: 35, justifyContent: 'center' }}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TimelineGroupHeader({
  title,
  rangeLabel,
}: {
  title: string;
  rangeLabel: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: colors.accent }} />
      <Text style={{ fontSize: 12.5, lineHeight: 15, fontWeight: '800', color: colors.accent }}>{title}</Text>
      {rangeLabel ? (
        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '500', color: colors.textMuted }}>
          {rangeLabel}
        </Text>
      ) : null}
      <View style={{ flex: 1, height: 1, backgroundColor: colors.accentSoft }} />
    </View>
  );
}

async function buildHeroItem(
  db: ReturnType<typeof useDB>,
  nextEvent: Event | null,
  config: UserConfig,
): Promise<HeroBannerItem | null> {
  if (!nextEvent) return null;

  if (!config.oshi_artist_id) {
    return {
      event: nextEvent,
      isOshiMatch: false,
      oshiArtist: null,
      matchSource: null,
    };
  }

  const [eventArtists, oshiArtist] = await Promise.all([
    db.events.getArtists(nextEvent.id),
    db.artists.findById(config.oshi_artist_id),
  ]);

  const matchSource = getOshiMatchSource(eventArtists, config.oshi_artist_id, oshiArtist);

  return {
    event: nextEvent,
    isOshiMatch: matchSource != null,
    oshiArtist,
    matchSource,
  };
}

async function buildFeaturedArtistData(
  db: ReturnType<typeof useDB>,
  config: UserConfig,
  artistId: string,
  currentYear: number,
): Promise<HomeFeaturedArtistData | null> {
  const artist = await db.artists.findById(artistId);
  if (!artist) {
    return null;
  }
  const isOshi = artist.id === config.oshi_artist_id;

  const [recentEvent, nextEvent, yearEventCount, chekiCount] = await Promise.all([
    db.events.findRecentCompletedByArtistYear(undefined, artist.id),
    db.events.findNextPlannedByArtistId(artist.id),
    db.events.countCompletedByArtistYear(currentYear, artist.id),
    db.cheki.countByArtistYear(undefined, artist.id),
  ]);

  return {
    artist,
    isOshi,
    recentEvent,
    nextEvent,
    yearEventCount,
    chekiCount,
  };
}

async function buildChekiPreviews(
  db: ReturnType<typeof useDB>,
  chekis: Cheki[],
): Promise<HomeChekiPreview[]> {
  const artistEntries = await Promise.all(
    chekis.map(async (cheki) => {
      if (!cheki.artist_id) return [cheki.id, null] as const;
      const artist = await db.artists.findById(cheki.artist_id);
      return [cheki.id, artist?.short_name || artist?.name || null] as const;
    }),
  );
  const artistNameMap = new Map(artistEntries);

  return chekis.map((cheki) => ({
    cheki,
    artistName: artistNameMap.get(cheki.id) ?? null,
  }));
}

function HomeCardsEmptyState({ onCustomizePress }: { onCustomizePress: () => void }) {
  const { colors, isDark } = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={onCustomizePress}
      style={{
        borderRadius: 18,
        padding: 18,
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.divider,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.1 : 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accentSoft,
          marginBottom: 12,
        }}
      >
        <AppIcon name="homeCustomize" size={22} color={colors.accent} />
      </View>
      <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.heading }}>
        首页还没有可显示的卡片
      </Text>
      <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 18, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>
        你可以在首页自定义中重新启用未来活动、拍立得等卡片。
      </Text>
      <View
        style={{
          marginTop: 14,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: colors.accent,
        }}
      >
        <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '800', color: colors.onAccent }}>
          去自定义
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const isAndroid = Platform.OS === 'android';
  const RootView = isAndroid ? View : SafeAreaView;
  const androidHeader = useAndroidCollapsibleTabHeader();
  const titleScrollY = useSharedValue(0);
  const [pinnedInfo, setPinnedInfo] = useState<HomePinnedInfoConfig>(() => createDefaultHomePinnedInfo());
  const [heroItem, setHeroItem] = useState<HeroBannerItem | null>(null);
  const [homeCards, setHomeCards] = useState<HomeCardConfig[]>(() => createDefaultHomeCards());
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [recent, setRecent] = useState<Event[]>([]);
  const [pinnedArtistData, setPinnedArtistData] = useState<HomeFeaturedArtistData | null>(null);
  const [featuredArtistData, setFeaturedArtistData] = useState<HomeFeaturedArtistData[]>([]);
  const [importantDateItems, setImportantDateItems] = useState<HydratedDateItem[]>([]);
  const [monthOverview, setMonthOverview] = useState<HomeMonthOverviewData>({
    eventCount: 0,
    plannedCount: 0,
    chekiArtistCount: 0,
    chekiCount: 0,
  });
  const [chekiOverview, setChekiOverview] = useState<{
    totalCount: number;
    monthCount: number;
    previews: HomeChekiPreview[];
  }>({ totalCount: 0, monthCount: 0, previews: [] });
  const [refreshing, setRefreshing] = useState(false);

  const handleTitleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      titleScrollY.value = Math.max(event.nativeEvent.contentOffset.y, 0);
    },
    [titleScrollY],
  );

  const tabBarScroll = useFloatingTabBarScroll({
    onScroll: handleTitleScroll,
    topRevealOffset: 24,
  });
  const scrollProps = isAndroid ? androidHeader.scrollProps : tabBarScroll;

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleScrollY.value, [0, 24, 72], [1, 0.72, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(titleScrollY.value, [0, 72], [0, -18], Extrapolation.CLAMP),
      },
    ],
  }));

  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleScrollY.value, [0, 28, 88], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(titleScrollY.value, [0, 88], [-10, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const loadData = useCallback(async () => {
    const now = new Date();
    const today = toISODate(now);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [config, allArtists, allDateItems] = await Promise.all([
      db.userConfig.getConfig(),
      db.artists.findAll(),
      db.dateItems.findAll(today),
    ]);

    const preferences = await loadHomePreferences({
      oshiArtistId: config.oshi_artist_id,
      validArtistIds: new Set(allArtists.map((artist) => artist.id)),
      validDateItemIds: new Set(allDateItems.map((item) => item.item.id)),
    });
    const { cards } = preferences;
    const recentCompletedCard = cards.find((card) => card.type === 'recentCompleted');
    const recentDisplayLimit = recentCompletedCard?.type === 'recentCompleted'
      ? recentCompletedCard.displayLimit
      : DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT;
    const recentQueryLimit = recentDisplayLimit === RECENT_COMPLETED_DISPLAY_ALL ? null : recentDisplayLimit;

    const [
      nextEvent,
      upcomingList,
      recentList,
      monthStatusCounts,
      monthChekiCount,
      monthChekiArtistCount,
      chekiTotalCount,
      recentCheki,
    ] = await Promise.all([
      db.events.findNextPlanned(),
      db.events.findUpcoming(),
      db.events.findRecent(recentQueryLimit),
      db.events.getYearStatusCounts(currentYear, currentMonth),
      db.cheki.countByYear(currentYear, currentMonth),
      db.cheki.countDistinctArtistsByYear(currentYear, currentMonth),
      db.cheki.countByYear(),
      db.cheki.findRecent(3),
    ]);
    const featuredCard = cards.find((card): card is Extract<HomeCardConfig, { type: 'featuredArtist' }> => (
      card.type === 'featuredArtist'
    ));
    const importantDatesCard = cards.find((card): card is Extract<HomeCardConfig, { type: 'importantDates' }> => (
      card.type === 'importantDates'
    ));
    const pinnedArtistId = preferences.pinnedInfo.type === 'featuredArtist'
      ? preferences.pinnedInfo.artistId
      : null;
    const dateItemMap = new Map(allDateItems.map((item) => [item.item.id, item]));
    const selectedImportantDateItems = (importantDatesCard?.dateItemIds ?? [])
      .map((dateItemId) => dateItemMap.get(dateItemId))
      .filter((item): item is HydratedDateItem => Boolean(item));

    const [hero, pinnedArtist, featuredItems, chekiPreviews] = await Promise.all([
      buildHeroItem(db, nextEvent, config),
      pinnedArtistId ? buildFeaturedArtistData(db, config, pinnedArtistId, currentYear) : Promise.resolve(null),
      Promise.all((featuredCard?.artistIds ?? []).map((artistId) => (
        buildFeaturedArtistData(db, config, artistId, currentYear)
      ))),
      buildChekiPreviews(db, recentCheki),
    ]);

    const visibleUpcoming = preferences.pinnedInfo.type === 'nextEvent'
      ? upcomingList.filter((e) => e.id !== nextEvent?.id)
      : upcomingList;
    let upcomingItems: UpcomingItem[] = visibleUpcoming.map((event) => ({
      event,
      oshiBadge: getEventCardOshiBadge(event.status, null),
    }));

    if (hero?.oshiArtist) {
      const upcomingArtists = await Promise.all(
        visibleUpcoming.map((event) => db.events.getArtists(event.id)),
      );
      upcomingItems = visibleUpcoming.map((event, index) => {
        const matchSource = getOshiMatchSource(
          upcomingArtists[index],
          hero.oshiArtist!.id,
          hero.oshiArtist,
        );

        return {
          event,
          oshiBadge: getEventCardOshiBadge(
            event.status,
            matchSource ? (hero.oshiArtist?.short_name || hero.oshiArtist?.name || null) : null,
          ),
        };
      });
    }

    setHeroItem(hero);
    setPinnedInfo(preferences.pinnedInfo);
    setHomeCards(cards);
    setUpcoming(upcomingItems);
    setRecent(recentList);
    setPinnedArtistData(pinnedArtist);
    setFeaturedArtistData(featuredItems.filter((item): item is HomeFeaturedArtistData => item !== null));
    setImportantDateItems(selectedImportantDateItems);
    setMonthOverview({
      eventCount: monthStatusCounts.completed,
      plannedCount: monthStatusCounts.planned,
      chekiArtistCount: monthChekiArtistCount,
      chekiCount: monthChekiCount,
    });
    setChekiOverview({
      totalCount: chekiTotalCount,
      monthCount: monthChekiCount,
      previews: chekiPreviews,
    });
  }, [db]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const router = useRouter();
  const timelineGroups = useMemo(() => buildHomeTimelineGroups(upcoming), [upcoming]);
  const handleFeaturedArtistPress = useCallback((data: HomeFeaturedArtistData | null) => {
    if (data?.artist) {
      router.push(`/artists/${data.artist.id}`);
      return;
    }

    router.push('/settings/home');
  }, [router]);
  const handleMonthOverviewPress = useCallback(() => {
    const now = new Date();

    router.push({
      pathname: '/stats',
      params: {
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
      },
    });
  }, [router]);

  const renderPinnedInfo = useCallback(() => {
    if (pinnedInfo.type === 'featuredArtist') {
      return (
        <HomePinnedArtistHero
          data={pinnedArtistData}
          onPress={handleFeaturedArtistPress}
          onSetupPress={() => router.push('/settings/home')}
        />
      );
    }

    if (pinnedInfo.type === 'monthSummary') {
      return (
        <HomePinnedMonthSummaryHero
          data={monthOverview}
          onPress={handleMonthOverviewPress}
        />
      );
    }

    return heroItem ? (
      <HomeUpcomingHero item={heroItem} />
    ) : (
      <HomePinnedNextEventEmptyHero onCreatePress={() => router.push('/events/compose')} />
    );
  }, [
    handleFeaturedArtistPress,
    handleMonthOverviewPress,
    heroItem,
    monthOverview,
    pinnedArtistData,
    pinnedInfo,
    router,
  ]);

  const renderCreateEventIcon = useCallback(() => (
    <TouchableOpacity
      activeOpacity={0.65}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      onPress={() => router.push('/events/compose')}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent,
      }}
      accessibilityLabel="新建活动"
      accessibilityRole="button"
    >
      <AppIcon name="add" size={22} color={colors.onAccent} />
    </TouchableOpacity>
  ), [colors.accent, colors.onAccent, router]);

  const renderHomeCard = useCallback((card: HomeCardConfig) => {
    if (card.type === 'futureActivity') {
      if (!card.visible) return null;
      if (timelineGroups.length === 0) return null;

      return (
        <View key={getHomeCardKey(card)} style={{ marginBottom: 22 }}>
          <HomeModuleHeader title="未来活动" />
          {timelineGroups.map((group, index) => (
            <View key={group.key} style={{ marginTop: index === 0 ? 0 : 12 }}>
              <TimelineGroupHeader title={group.title} rangeLabel={group.rangeLabel} />
              {group.items.map((item, itemIndex) => (
                <HomeTimelineEventCard
                  key={item.event.id}
                  event={item.event}
                  oshiBadge={item.oshiBadge}
                  dayLabel={item.dayLabel}
                  monthLabel={item.monthLabel}
                  showConnector={itemIndex < group.items.length - 1}
                />
              ))}
            </View>
          ))}
        </View>
      );
    }

    if (card.type === 'recentCompleted') {
      if (!card.visible || recent.length === 0) return null;
      return (
        <View key={getHomeCardKey(card)} style={{ marginBottom: 24 }}>
          <HomeModuleHeader
            title="最近完成"
            count={recent.length}
            actionLabel="查看全部"
            onActionPress={() => router.push({ pathname: '/events', params: { status: 'completed' } })}
          />
          {recent.map((event) => (
            <HomeCompletedEventCard
              key={event.id}
              event={event}
            />
          ))}
        </View>
      );
    }

    if (card.type === 'featuredArtist') {
      if (!card.visible) return null;
      const featuredArtistCount = featuredArtistData.length;

      return (
        <View key={getHomeCardKey(card)}>
          <HomeModuleHeader
            title="关注艺人"
            count={featuredArtistCount > 0 ? featuredArtistCount : undefined}
            actionLabel={featuredArtistCount > 0 ? undefined : '选择'}
            onActionPress={featuredArtistCount > 0 ? undefined : () => router.push('/settings/home')}
          />
          <HomeFeaturedArtistsCard
            items={featuredArtistData}
            onPressArtist={handleFeaturedArtistPress}
            onSetupPress={() => router.push('/settings/home')}
            emptyTitle="选择关注艺人"
            emptyDescription="最多选择五位艺人，展示下一场活动和记录摘要。"
          />
        </View>
      );
    }

    if (card.type === 'importantDates') {
      if (!card.visible) return null;
      const selectedCount = importantDateItems.length;

      return (
        <View key={getHomeCardKey(card)}>
          <HomeModuleHeader
            title="重要日期"
            count={selectedCount > 0 ? selectedCount : undefined}
            actionLabel={selectedCount > 0 ? undefined : '选择'}
            onActionPress={selectedCount > 0 ? undefined : () => router.push('/settings/home')}
          />
          <HomeImportantDatesCard
            items={importantDateItems}
            onPressItem={(item) => router.push(`/date-items/${item.item.id}`)}
            onSetupPress={() => router.push('/settings/home')}
          />
        </View>
      );
    }

    if (card.type === 'monthOverview') {
      if (!card.visible) return null;
      return (
        <View key={getHomeCardKey(card)}>
          <HomeModuleHeader
            title="本月概览"
            actionLabel="统计"
            onActionPress={handleMonthOverviewPress}
          />
          <HomeMonthOverviewCard
            data={monthOverview}
            onPress={handleMonthOverviewPress}
          />
        </View>
      );
    }

    if (card.type === 'chekiOverview') {
      if (!card.visible) return null;
      return (
        <View key={getHomeCardKey(card)}>
          <HomeModuleHeader title="拍立得" count={chekiOverview.totalCount} />
          <HomeChekiOverviewCard
            totalCount={chekiOverview.totalCount}
            monthCount={chekiOverview.monthCount}
            previews={chekiOverview.previews}
            onPress={() => router.push('/cheki')}
          />
        </View>
      );
    }

    return null;
  }, [
    chekiOverview.monthCount,
    chekiOverview.previews,
    chekiOverview.totalCount,
    featuredArtistData,
    handleFeaturedArtistPress,
    handleMonthOverviewPress,
    importantDateItems,
    monthOverview,
    recent,
    router,
    timelineGroups,
  ]);
  const renderedHomeCards = homeCards.map(renderHomeCard);
  const hasRenderedHomeCards = renderedHomeCards.some(Boolean);

  return (
    <RootView style={{ flex: 1, backgroundColor: colors.screen }}>
      {isAndroid ? (
        <AndroidCompactTabHeader
          title="首页"
          right={renderCreateEventIcon()}
          compactHeaderStyle={androidHeader.compactHeaderStyle}
          overlayHeight={androidHeader.overlayHeight}
          overlayPaddingTop={androidHeader.overlayPaddingTop}
        />
      ) : (
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 50,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: withAlpha(colors.screen, isDark ? 0.94 : 0.9),
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
              zIndex: 10,
            },
            compactHeaderStyle,
          ]}
        >
          <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.heading }}>
            首页
          </Text>
          {renderCreateEventIcon()}
        </Animated.View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: isAndroid ? androidHeader.contentTopPadding : 18,
          paddingBottom: contentBottomPadding,
        }}
        contentInsetAdjustmentBehavior="automatic"
        scrollIndicatorInsets={{ bottom: contentBottomPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {isAndroid ? (
          <AndroidLargeTabTitle
            title="首页"
            right={renderCreateEventIcon()}
            largeTitleStyle={androidHeader.largeTitleStyle}
          />
        ) : (
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              },
              largeTitleStyle,
            ]}
          >
            <Text style={{ fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, color: colors.heading }}>
              首页
            </Text>
            {renderCreateEventIcon()}
          </Animated.View>
        )}

        {renderPinnedInfo()}

        {hasRenderedHomeCards ? renderedHomeCards : (
          <HomeCardsEmptyState onCustomizePress={() => router.push('/settings/home')} />
        )}
      </ScrollView>
    </RootView>
  );
}

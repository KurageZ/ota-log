import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useDB } from '../../../src/context/DBContext';
import { Cheki, Event, UserConfig } from '../../../src/types/models';
import type { HeroBannerItem } from '../../../src/components/HeroBanner';
import { HomeUpcomingHero } from '../../../src/components/HomeUpcomingHero';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../../../src/components/AndroidCollapsibleTabHeader';
import { HomeTimelineEventCard } from '../../../src/components/HomeTimelineEventCard';
import {
  EventRow,
  EventRowMetaText,
} from '../../../src/components/EventRow';
import { EventRatingStars } from '../../../src/components/EventPrimitives';
import {
  HomeChekiOverviewCard,
  HomeChekiPreview,
  HomeFeaturedArtistsCard,
  HomeFeaturedArtistData,
  HomeImportantDatesCard,
  HomeMonthOverviewCard,
  HomeMonthOverviewData,
} from '../../../src/components/HomeDashboardCards';
import type { HydratedDateItem } from '../../../src/repositories/DateItemRepository';
import { AppIcon, getAppIconSFSymbol } from '../../../src/components/AppIcon';
import { NativeAddToolbar } from '../../../src/components/native-add-toolbar';
import { EventCardOshiBadge, getEventCardOshiBadge, getOshiMatchSource } from '../../../src/utils/oshiMatch';
import { buildHomeTimelineGroups } from '../../../src/utils/homeTimeline';
import { useAppTheme } from '../../../src/theme/appTheme';
import { useFloatingTabBarSpacing } from '../../../src/navigation/floatingTabBar';
import { useFloatingTabBarScroll } from '../../../src/navigation/FloatingTabBarVisibility';
import {
  DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT,
  HomeCardConfig,
  HomePinnedInfoConfig,
  RECENT_COMPLETED_DISPLAY_ALL,
  createDefaultHomeCards,
  createDefaultHomePinnedInfo,
  getHomeCardKey,
  loadHomePreferences,
} from '../../../src/utils/homePreferences';
import {
  HomePinnedArtistHero,
  HomePinnedMonthSummaryHero,
  HomePinnedNextEventEmptyHero,
} from '../../../src/components/HomePinnedInfoHero';
import { toISODate } from '../../../src/utils/date';
import { synchronizeCurrentEvent } from '../../../src/utils/currentEvent';
import { createHomeMonthStatsRoute } from '../../../src/utils/homeNavigation';

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

  const [eventArtists, oshiArtist, isAttributed] = await Promise.all([
    db.events.getArtists(nextEvent.id),
    db.artists.findById(config.oshi_artist_id),
    db.events.isArtistAttributedToEvent(nextEvent.id, config.oshi_artist_id),
  ]);

  const matchSource = getOshiMatchSource(eventArtists, config.oshi_artist_id, oshiArtist, isAttributed);

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
  const androidHeader = useAndroidCollapsibleTabHeader();
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

  const tabBarScroll = useFloatingTabBarScroll();
  const scrollProps = isAndroid ? androidHeader.scrollProps : tabBarScroll;

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

    const nextEvent = await synchronizeCurrentEvent(db.events, now);
    const [
      upcomingList,
      recentList,
      monthStatusCounts,
      monthChekiCount,
      monthChekiArtistCount,
      chekiTotalCount,
      recentCheki,
    ] = await Promise.all([
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
      const upcomingMatches = await Promise.all(
        visibleUpcoming.map(async (event) => ({
          artists: await db.events.getArtists(event.id),
          attributed: await db.events.isArtistAttributedToEvent(event.id, hero.oshiArtist!.id),
        })),
      );
      upcomingItems = visibleUpcoming.map((event, index) => {
        const matchSource = getOshiMatchSource(
          upcomingMatches[index].artists,
          hero.oshiArtist!.id,
          hero.oshiArtist,
          upcomingMatches[index].attributed,
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

  useEffect(() => {
    const unsubscribe = db.events.subscribeToChanges(() => {
      void loadData();
    });
    return unsubscribe;
  }, [db.events, loadData]);

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
    router.push(createHomeMonthStatsRoute());
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
      style={{ paddingRight: 4 }}
      accessibilityLabel="新建活动"
      accessibilityRole="button"
    >
      <AppIcon name="add" size={24} color={colors.accent} />
    </TouchableOpacity>
  ), [colors.accent, router]);

  const renderHeaderRight = useCallback(() => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <TouchableOpacity
        accessibilityLabel="编辑首页内容"
        accessibilityRole="button"
        onPress={() => router.push('/settings/home')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <AppIcon name="viewSettings" size={22} color={colors.accent} />
      </TouchableOpacity>
      {renderCreateEventIcon()}
    </View>
  ), [colors.accent, renderCreateEventIcon, router]);

  const renderSettingsButton = useCallback(() => (
    <Stack.Toolbar.Button
      accessibilityLabel="编辑首页内容"
      icon={getAppIconSFSymbol('viewSettings')}
      onPress={() => router.push('/settings/home')}
    />
  ), [router]);

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
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.divider,
              paddingHorizontal: 16,
              overflow: 'hidden',
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: isDark ? 0.1 : 0.05,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            {recent.map((event, index) => {
              const dateLabel = event.event_date
                ? (() => {
                    const [, month, day] = event.event_date.split('-').map(Number);
                    return month > 0 && day > 0 ? `${month}月${day}日` : event.event_date;
                  })()
                : '';
              const locationText = [event.city, event.venue].filter(Boolean).join(' · ');
              return (
                <EventRow
                  key={event.id}
                  title={event.title}
                  subtitle={
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {dateLabel ? <EventRowMetaText>{dateLabel}</EventRowMetaText> : null}
                        {dateLabel && locationText ? <EventRowMetaText>·</EventRowMetaText> : null}
                        {locationText ? <EventRowMetaText>{locationText}</EventRowMetaText> : null}
                      </View>
                      {event.review_score != null ? (
                        <EventRatingStars score={event.review_score} size="sm" />
                      ) : null}
                    </View>
                  }
                  onPress={() => router.push(`/events/${event.id}`)}
                  isLast={index === recent.length - 1}
                  accessibilityLabel={`查看活动详情：${event.title}`}
                />
              );
            })}
          </View>
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
    colors,
    isDark,
  ]);
  const renderedHomeCards = homeCards.map(renderHomeCard);
  const hasRenderedHomeCards = renderedHomeCards.some(Boolean);
  const scrollContent = (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.screen }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: isAndroid ? androidHeader.contentTopPadding : 6,
        paddingBottom: contentBottomPadding,
      }}
      contentInsetAdjustmentBehavior="automatic"
      scrollIndicatorInsets={isAndroid ? { bottom: contentBottomPadding } : undefined}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {isAndroid ? (
        <AndroidLargeTabTitle
          title="首页"
          right={renderHeaderRight()}
          largeTitleStyle={androidHeader.largeTitleStyle}
        />
      ) : null}

      {renderPinnedInfo()}

      {hasRenderedHomeCards ? renderedHomeCards : (
        <HomeCardsEmptyState onCustomizePress={() => router.push('/settings/home')} />
      )}
    </ScrollView>
  );

  if (!isAndroid) {
    return (
      <>
        <Stack.Screen />
        {scrollContent}
        <NativeAddToolbar
          accessibilityLabel="新建活动"
          onPress={() => router.push('/events/compose')}
          leading={renderSettingsButton()}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <AndroidCompactTabHeader
        title="首页"
        right={renderHeaderRight()}
        compactHeaderStyle={androidHeader.compactHeaderStyle}
        overlayHeight={androidHeader.overlayHeight}
        overlayPaddingTop={androidHeader.overlayPaddingTop}
      />
      {scrollContent}
    </View>
  );
}

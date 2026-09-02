import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { EventCard } from '../../../src/components/EventCard';
import { EventSectionHeader } from '../../../src/components/EventSectionHeader';
import IOSLargeSegmentedControl from '../../../src/components/IOSLargeSegmentedControl';
import { AppIcon, type AppIconName, type AppIconVariant } from '../../../src/components/AppIcon';
import { BottomSheetDialog } from '../../../src/components/BottomSheetDialog';
import { ChekiManualEntryList } from '../../../src/components/ChekiManualEntryList';
import {
  CHEKI_SQUARE_GRID_GAP,
  ChekiGridThumbnail,
} from '../../../src/components/ChekiAlbumThumbnail';
import { ChekiViewerModal } from '../../../src/components/ChekiViewerModal';
import type { ChekiViewerItem } from '../../../src/types/chekiViewer';
import { OshiAvatar, OshiBadge } from '../../../src/components/Oshi';
import { MenuCard } from '../../../src/components/SettingsMenu';
import { useDB } from '../../../src/context/DBContext';
import { useAppTheme } from '../../../src/theme/appTheme';
import { Artist, ArtistGroupMembershipWithArtist, Cheki, ChekiManualEntry, Event } from '../../../src/types/models';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { deriveArtistBackdropPalette, extractArtistBackgroundColor } from '../../../src/utils/artistBackdrop';
import { buildChekiViewerItems, getChekiManualCount } from '../../../src/utils/cheki';
import { buildEventMonthSections } from '../../../src/utils/eventSections';
import { sortArtistsWithOshi } from '../../../src/utils/filter';
import { showDeleteFailedAlert } from '../../../src/utils/failureAlert';
import { hapticError, hapticFavoriteToggle } from '../../../src/utils/haptics';
import { getEventCardOshiBadge } from '../../../src/utils/oshiMatch';
import { toISODate } from '../../../src/utils/date';

const ARTIST_HERO_SCREEN_RATIO = 0.7;
const ARTIST_HERO_MAX_WIDTH_RATIO = 1.6;
const ARTIST_HERO_CONTENT_OFFSET = 96;
const BACKDROP_TRANSITION_HEIGHT = 96;
const TAB_KEYS = ['events', 'cheki'] as const;
type TabKey = (typeof TAB_KEYS)[number];
type ArtistChekiListItem =
  | { type: 'row'; key: string; chekis: Cheki[]; isLastPhotoRow: boolean }
  | { type: 'manual'; key: 'manual'; entries: ChekiManualEntry[] };

function canUseLiquidGlass(reduceTransparency: boolean) {
  if (Platform.OS !== 'ios' || reduceTransparency) return false;

  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

function buildArtistChekiItems(
  chekiList: Cheki[],
  manualEntries: ChekiManualEntry[],
): ArtistChekiListItem[] {
  const items: ArtistChekiListItem[] = [];

  for (let index = 0; index < chekiList.length; index += 3) {
    const rowIndex = Math.floor(index / 3);
    const isLastPhotoRow = index + 3 >= chekiList.length && manualEntries.length === 0;
    items.push({
      type: 'row',
      key: `row:${rowIndex}`,
      chekis: chekiList.slice(index, index + 3),
      isLastPhotoRow,
    });
  }

  if (manualEntries.length > 0) {
    items.push({ type: 'manual', key: 'manual', entries: manualEntries });
  }

  return items;
}

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDB();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { colors, isDark, chekiDisplayMode } = useAppTheme();
  const isIOS = Platform.OS === 'ios';

  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [parentArtist, setParentArtist] = useState<Artist | null>(null);
  const [currentGroupCount, setCurrentGroupCount] = useState(0);
  const [members, setMembers] = useState<Artist[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>([]);
  const [memberships, setMemberships] = useState<ArtistGroupMembershipWithArtist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventMap, setEventMap] = useState<Map<string, Event>>(new Map());
  const [chekiList, setChekiList] = useState<Cheki[]>([]);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [manualEntries, setManualEntries] = useState<ChekiManualEntry[]>([]);
  const [viewerSelectedId, setViewerSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('events');
  const [tabRemountKey, setTabRemountKey] = useState<Record<TabKey, number>>({ events: 0, cheki: 0 });
  const [attributesSheetVisible, setAttributesSheetVisible] = useState(false);

  const scrollY = useSharedValue(0);
  const eventsScrollY = useSharedValue(0);
  const chekiScrollY = useSharedValue(0);
  const hasBackground = Boolean(artist?.background_uri);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let isActive = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((isEnabled) => {
      if (isActive) setReduceTransparency(isEnabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);
  const eventsScrollHandler = useAnimatedScrollHandler((event) => {
    eventsScrollY.value = event.contentOffset.y;
    scrollY.value = event.contentOffset.y;
  });
  const chekiScrollHandler = useAnimatedScrollHandler((event) => {
    chekiScrollY.value = event.contentOffset.y;
    scrollY.value = event.contentOffset.y;
  });

  const load = useCallback(async () => {
    if (!id) {
      setArtist(null);
      setParentArtist(null);
      setCurrentGroupCount(0);
      setMembers([]);
      setRelatedArtists([]);
      setMemberships([]);
      setEvents([]);
      setChekiList([]);
      setManualEntries([]);
      setEventMap(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    const [config, currentArtist, artistEvents, chekis, manuals, memberArtists, allEvents] = await Promise.all([
      db.userConfig.getConfig(),
      db.artists.findById(id),
      db.events.findByArtistId(id),
      db.cheki.findByArtistId(id),
      db.chekiManualEntries.findByArtistId(id),
      db.artists.findMembers(id),
      db.events.findAll(),
    ]);

    setArtist(currentArtist);
    if (currentArtist?.background_uri && !currentArtist.background_color) {
      void (async () => {
        const derivedColor = await extractArtistBackgroundColor(currentArtist.background_uri!);
        if (!derivedColor) return;
        try {
          await db.artists.update(currentArtist.id, { background_color: derivedColor });
          setArtist((prev) => (prev && prev.id === currentArtist.id
            ? { ...prev, background_color: derivedColor }
            : prev));
        } catch {
          // Background color backfill is best-effort and should not block detail rendering.
        }
      })();
    }
    setChekiList(chekis);
    setManualEntries(manuals);
    const today = toISODate(new Date());
    const typedMembers = currentArtist?.artist_type === 'group'
      ? await db.artists.findCurrentMembers(id, today)
      : [];
    setMembers(sortArtistsWithOshi(
      currentArtist?.artist_type === 'group' ? typedMembers : memberArtists,
      config.oshi_artist_id,
    ));
    const artistMemberships = currentArtist?.artist_type === 'person'
      ? await db.artists.findMembershipsForPerson(id)
      : currentArtist?.artist_type === 'group'
        ? await db.artists.findMembershipsForGroup(id)
        : [];
    setMemberships(artistMemberships);
    setAttributesSheetVisible(false);
    setOshiArtistId(config.oshi_artist_id);
    setEventMap(new Map(allEvents.map((event) => [event.id, event])));

    if (currentArtist?.artist_type === 'person') {
      const groups = await db.artists.findCurrentGroups(id, today);
      setParentArtist(groups[0] ?? null);
      setCurrentGroupCount(groups.length);
      const groupmates = await db.artists.findCurrentGroupmates(id, today);
      setRelatedArtists(sortArtistsWithOshi(groupmates, config.oshi_artist_id));
    } else {
      setRelatedArtists([]);
      if (currentArtist?.parent_id) {
        setParentArtist(await db.artists.findById(currentArtist.parent_id));
        setCurrentGroupCount(1);
      } else {
        setParentArtist(null);
        setCurrentGroupCount(0);
      }
    }

    setEvents(artistEvents);
    setLoading(false);
  }, [db, id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const handleToggleFavorite = async () => {
    if (!artist) return;
    if (artist.id === oshiArtistId && artist.is_favorite === 1) {
      Alert.alert('单推艺人已收藏', '单推艺人会保持收藏。若要更换或清除单推，请前往「我的 → 设置 → 单推设置」。');
      return;
    }
    const nextFavorite = artist.is_favorite !== 1;
    hapticFavoriteToggle(nextFavorite);
    await db.artists.toggleFavorite(artist.id);
    setArtist((prev) => (prev ? { ...prev, is_favorite: prev.is_favorite ? 0 : 1 } : prev));
  };

  const handleDeleteCheki = useCallback((chekiId: string) => {
    Alert.alert('删除拍立得', '确认删除这张拍立得？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.cheki.delete(chekiId);
            setViewerSelectedId(null);
            await load();
          } catch {
            showDeleteFailedAlert();
          }
        },
      },
    ]);
  }, [db, load]);

  const handleToggleChekiFavorite = useCallback(async (item: ChekiViewerItem) => {
    const nextFavorite = item.isFavorite !== true;
    hapticFavoriteToggle(nextFavorite);
    const itemId = item.itemId ?? item.id;
    setChekiList((current) => current.map((cheki) => (
      cheki.id === itemId ? { ...cheki, is_favorite: nextFavorite ? 1 : 0 } : cheki
    )));
    try {
      await db.cheki.setFavorite(itemId, nextFavorite);
    } catch {
      hapticError();
      setChekiList((current) => current.map((cheki) => (
        cheki.id === itemId ? { ...cheki, is_favorite: nextFavorite ? 0 : 1 } : cheki
      )));
      Alert.alert('收藏失败', '暂时无法更新收藏状态，请稍后重试。');
    }
  }, [db]);

  const handleOpenChekiCreate = () => {
    if (!artist) return;
    router.push({ pathname: '/cheki/new', params: { artist_id: artist.id } });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/artists');
  };

  const compactHeaderHeight = isIOS ? 0 : insets.top + 52;
  const usesLiquidGlass = hasBackground && canUseLiquidGlass(reduceTransparency);
  const heroHeight = hasBackground
    ? Math.round(Math.min(
      screenHeight * ARTIST_HERO_SCREEN_RATIO,
      screenWidth * ARTIST_HERO_MAX_WIDTH_RATIO,
    ))
    : 0;
  const heroDisplayHeight = hasBackground
    ? heroHeight + BACKDROP_TRANSITION_HEIGHT
    : 0;
  const headerFadeStart = hasBackground
    ? Math.max(120, heroDisplayHeight - compactHeaderHeight - 104 - ARTIST_HERO_CONTENT_OFFSET)
    : 40;
  const headerFadeEnd = hasBackground
    ? Math.max(headerFadeStart + 68, heroDisplayHeight - compactHeaderHeight - 28 - ARTIST_HERO_CONTENT_OFFSET)
    : 108;

  const compactHeaderBackgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [headerFadeStart, headerFadeEnd], [0, 1], Extrapolation.CLAMP),
  }));
  const floatingNameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [headerFadeStart, headerFadeEnd], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [headerFadeStart, headerFadeEnd], [8, 0], Extrapolation.CLAMP) }],
  }));
  const handleSelectTab = useCallback((tab: TabKey) => {
    const nextScrollY = tab === 'events' ? eventsScrollY.value : chekiScrollY.value;
    scrollY.value = nextScrollY;
    setTabRemountKey((prev) => {
      const leaving = tab === 'events' ? 'cheki' : 'events';
      return { ...prev, [leaving]: prev[leaving] + 1 };
    });
    setActiveTab(tab);
  }, [chekiScrollY, eventsScrollY, scrollY]);

  const chekiCellW = Math.floor((screenWidth - 32 - 16) / 3);
  const chekiCellH = chekiDisplayMode === 'original'
    ? chekiCellW
    : Math.round((chekiCellW * 86) / 54);
  const eventSections = useMemo(() => buildEventMonthSections(events), [events]);
  const viewerItems = useMemo(
    () => buildChekiViewerItems(chekiList, new Map(artist ? [[artist.id, artist]] : []), eventMap),
    [artist, chekiList, eventMap],
  );
  const artistChekiItems = useMemo(
    () => buildArtistChekiItems(chekiList, manualEntries),
    [chekiList, manualEntries],
  );
  const totalChekiCount = chekiList.length + getChekiManualCount(manualEntries);
  const loadingBg = colors.screen;
  const loadingFg = colors.heading;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: loadingBg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen
          options={isIOS
            ? {
                title: '',
                headerShown: true,
                headerLargeTitleEnabled: false,
                headerTransparent: true,
                headerLargeTitleShadowVisible: false,
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
                headerStyle: { backgroundColor: 'transparent' },
                headerTitleStyle: { color: colors.heading },
                headerTintColor: colors.accent,
              }
            : { headerShown: false }}
        />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!artist) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: loadingBg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppIcon name="artist" size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: loadingFg, marginBottom: 6 }}>
          艺人不存在
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
          这条艺人记录可能已经被删除。
        </Text>
        <TouchableOpacity
          onPress={handleBack}
          style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.divider }}
        >
          <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 14 }}>返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isOshi = artist.id === oshiArtistId;
  const avatarSrc = resolveAvatarSource(artist.avatar_uri);
  const hasShortName = Boolean(artist.short_name?.trim() && artist.short_name.trim() !== artist.name);
  const compactTitle = hasShortName && artist.short_name ? artist.short_name.trim() : artist.name;
  const heroTitleIsLong = artist.name.length > 16;
  const backdropColors = hasBackground ? { ...colors, screen: '#0f0a1e' } : colors;
  const backdropPalette = deriveArtistBackdropPalette(artist.background_color, backdropColors);
  const pDark = backdropPalette.paletteIsDark;
  const lowerCardBorderWidth = hasBackground && pDark ? 0 : 1;
  const cardBg = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.58)')
    : colors.card;
  const cardAltBg = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.46)')
    : colors.cardAlt;
  const eventCardSurfaceStyle = {
    backgroundColor: cardBg,
    borderWidth: lowerCardBorderWidth,
    borderColor: colors.divider,
    shadowOpacity: 0,
    elevation: 0,
  };
  const pageBackgroundColor = hasBackground ? backdropPalette.surfaceColor : colors.screen;
  const headerSurfaceColor = hasBackground
    ? backdropPalette.headerColor
    : (isDark ? 'rgba(15,10,30,0.78)' : 'rgba(255,255,255,0.88)');
  const headerBorderColor = colors.divider;
  const sectionLabelColor = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)')
    : colors.textSecondary;
  const sectionCountColor = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.38)')
    : colors.textMuted;
  const actionPillBackground = hasBackground
    ? (pDark ? 'rgba(15,10,30,0.45)' : 'rgba(255,255,255,0.72)')
    : colors.card;
  const actionPillBorder = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)')
    : colors.divider;
  const actionPillText = hasBackground
    ? (pDark ? colors.white : 'rgba(0,0,0,0.82)')
    : colors.accentText;
  const galleryPlaceholderBg = hasBackground
    ? (pDark ? 'rgba(15,10,30,0.32)' : 'rgba(255,255,255,0.55)')
    : colors.cardAlt;
  const galleryPlaceholderBorder = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
    : colors.divider;
  const backdropText = hasBackground
    ? (pDark ? colors.white : 'rgba(0,0,0,0.85)')
    : colors.text;
  const backdropTextSecondary = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)')
    : colors.textSecondary;
  const backdropChevron = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)')
    : colors.chevron;
  const backdropDivider = hasBackground
    ? (pDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
    : colors.divider;
  const contentSurfaceColor = hasBackground ? backdropPalette.surfaceColor : 'transparent';
  const tabActiveBg = pDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const tabActiveText = pDark ? colors.white : 'rgba(0,0,0,0.85)';
  const tabInactiveText = pDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)';
  const heroNameShadowColor = pDark ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.1)';
  const heroActionText = pDark ? 'rgba(255,255,255,0.86)' : 'rgba(0,0,0,0.76)';
  const heroActionIcon = pDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.6)';
  const backdropEmptyTextColor = pDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const chekiListIsDark = hasBackground ? pDark : isDark;
  const chekiManualTone = hasBackground && pDark ? 'glass' : 'default';
  const hasHiddenAttributes = Boolean(artist.artist_type || artist.url);
  const today = toISODate(new Date());
  const isCurrentMembership = (membership: ArtistGroupMembershipWithArtist) => (
    (membership.start_date == null || membership.start_date <= today)
    && (membership.end_date == null || membership.end_date >= today)
  );
  const currentMemberships = memberships.filter(isCurrentMembership);
  const pastMemberships = memberships.filter((membership) => !isCurrentMembership(membership));

  const renderMetaToggle = (overlay: boolean) => {
    if (!hasHiddenAttributes) return null;

    return overlay ? (
      <HeroMetaAction
        icon="disclosure"
        variant="down"
        label="更多"
        iconColor={heroActionIcon}
        textColor={heroActionText}
        onPress={() => setAttributesSheetVisible(true)}
      />
    ) : (
      <MetaPill
        icon="disclosure"
        iconVariant="down"
        label="更多"
        tone="group"
        overlayMode={false}
        onPress={() => setAttributesSheetVisible(true)}
      />
    );
  };

  const renderArtistAttributes = () => {
    if (!hasHiddenAttributes) return null;

    const renderMembershipCard = (
      testID: string,
      title: string,
      items: ArtistGroupMembershipWithArtist[],
      showCurrentBadge: boolean,
      unit: string,
    ) => (
      <MenuCard testID={testID}>
        <View
          style={{
            minHeight: 44,
            paddingHorizontal: 16,
            paddingTop: 13,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text }}>
            {title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {items.length > 0 ? `${items.length} ${unit}` : '暂无记录'}
          </Text>
        </View>
        {items.length === 0 ? (
          <Text style={{ paddingHorizontal: 16, paddingBottom: 14, fontSize: 13, color: colors.textSecondary }}>
            还没有{title}
          </Text>
        ) : items.map((membership) => (
          <TouchableOpacity
            key={membership.id}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={`查看${membership.artist.name}`}
            onPress={() => {
              setAttributesSheetVisible(false);
              router.push(`/artists/${membership.artist.id}`);
            }}
            style={{
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <OshiAvatar source={resolveAvatarSource(membership.artist.avatar_uri)} size={36} isOshi={false} />
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '700' }}>
                  {membership.artist.name}
                </Text>
                {showCurrentBadge && isCurrentMembership(membership) ? (
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                    当前
                  </Text>
                ) : null}
              </View>
              <Text style={{ marginTop: 3, color: colors.textSecondary, fontSize: 12 }}>
                {membership.start_date ?? '更早'} — {membership.end_date ?? '至今'}
              </Text>
            </View>
            <AppIcon name="disclosure" variant="forward" size={15} color={colors.chevron} />
          </TouchableOpacity>
        ))}
      </MenuCard>
    );

    return (
      <View testID="artist-attributes-card" style={{ gap: 12 }}>
        {artist.artist_type === 'group' ? (
          <>
            {renderMembershipCard('artist-current-members-card', '当前成员', currentMemberships, false, '位')}
            {renderMembershipCard('artist-past-members-card', '历史成员', pastMemberships, false, '位')}
          </>
        ) : artist.artist_type === 'person' ? (
          <>
            {relatedArtists.length > 0 ? (
              <MenuCard testID="artist-related-card">
                <View
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 16,
                    paddingTop: 13,
                    paddingBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text }}>
                    相关艺人
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {relatedArtists.length} 位
                  </Text>
                </View>
                <GestureHandlerScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 14 }}
                >
                  {relatedArtists.map((related) => (
                    <TouchableOpacity
                      key={related.id}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel={`查看${related.name}`}
                      onPress={() => {
                        setAttributesSheetVisible(false);
                        router.push(`/artists/${related.id}`);
                      }}
                      style={{ width: 64, marginRight: 14, alignItems: 'center' }}
                    >
                      <OshiAvatar
                        source={resolveAvatarSource(related.avatar_uri)}
                        size={56}
                        isOshi={related.id === oshiArtistId}
                      />
                      <Text
                        numberOfLines={1}
                        style={{ marginTop: 6, fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}
                      >
                        {related.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </GestureHandlerScrollView>
              </MenuCard>
            ) : null}
            {renderMembershipCard('artist-history-card', '所属团体', memberships, true, '个')}
          </>
        ) : null}
        {artist.url ? (
          <MenuCard testID="artist-link-card">
            <View
              style={{
                minHeight: 44,
                paddingHorizontal: 16,
                paddingTop: 13,
                paddingBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text }}>官方链接</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.72}
              accessibilityRole="link"
              accessibilityLabel="打开艺人链接"
              onPress={() => Linking.openURL(artist.url!)}
              style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
            >
              <AppIcon name="link" size={18} color={colors.accent} />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  {artist.url}
                </Text>
              </View>
              <AppIcon name="externalLink" size={15} color={colors.chevron} />
            </TouchableOpacity>
          </MenuCard>
        ) : null}
      </View>
    );
  };

  const renderChekiListItem = ({ item }: { item: ArtistChekiListItem }) => {
    if (item.type === 'manual') {
      return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <ChekiManualEntryList
            entries={item.entries}
            eventMap={eventMap}
            isDark={chekiListIsDark}
            tone={chekiManualTone}
            onPressEntry={(entry) => router.push(`/cheki/records/${entry.id}`)}
          />
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: chekiDisplayMode === 'original' ? CHEKI_SQUARE_GRID_GAP : 8,
            marginBottom: item.isLastPhotoRow
              ? 24
              : chekiDisplayMode === 'original' ? CHEKI_SQUARE_GRID_GAP : 8,
          }}
        >
          {item.chekis.map((cheki) => (
            <TouchableOpacity
              key={cheki.id}
              onPress={() => setViewerSelectedId(cheki.id)}
              activeOpacity={0.85}
            >
              {chekiDisplayMode === 'original' ? (
                <ChekiGridThumbnail
                  uri={cheki.photo_uri}
                  width={chekiCellW}
                  height={chekiCellH}
                  colors={colors}
                  variant="original"
                />
              ) : (
                <Image
                  source={{ uri: cheki.photo_uri }}
                  resizeMethod="resize"
                  resizeMode="contain"
                  style={{
                    width: chekiCellW,
                    height: chekiCellH,
                    borderRadius: 10,
                    backgroundColor: galleryPlaceholderBg,
                    borderWidth: 1,
                    borderColor: galleryPlaceholderBorder,
                  }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderChekiSummary = (iconColor: string) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 13, color: sectionLabelColor }}>
          共 {totalChekiCount} 张
        </Text>
        <TouchableOpacity
          onPress={handleOpenChekiCreate}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: actionPillBackground,
            borderWidth: 1,
            borderColor: actionPillBorder,
          }}
        >
          <AppIcon name="add" size={14} color={iconColor} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: actionPillText }}>添加</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderChekiEmptyState = () => (
    <View style={{ paddingHorizontal: 16 }}>
      <EmptyState
        message="还没有拍立得记录"
        actionLabel="去添加"
        onPressAction={handleOpenChekiCreate}
        borderless={hasBackground}
        bgColor={hasBackground ? cardBg : undefined}
        textColor={hasBackground ? backdropEmptyTextColor : undefined}
      />
    </View>
  );

  return (
    <View
      style={isIOS
        ? { display: 'contents' }
        : { flex: 1, backgroundColor: pageBackgroundColor }}
    >
      <Stack.Screen
        options={isIOS
          ? {
              title: '',
              headerShown: true,
              headerLargeTitleEnabled: false,
              headerTransparent: true,
              headerLargeTitleShadowVisible: false,
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              headerStyle: { backgroundColor: hasBackground ? 'transparent' : pageBackgroundColor },
              headerLargeStyle: { backgroundColor: 'transparent' },
              headerTitleStyle: { color: hasBackground ? backdropText : colors.heading },
              headerLargeTitleStyle: { color: hasBackground ? backdropText : colors.heading },
              headerTintColor: colors.accent,
            }
          : { headerShown: false }}
      />

      {!isIOS ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: compactHeaderHeight,
            zIndex: 20,
          }}
        >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: headerSurfaceColor,
              borderBottomWidth: 1,
              borderBottomColor: headerBorderColor,
            },
            compactHeaderBackgroundStyle,
          ]}
        />
        <View
          style={{
            height: compactHeaderHeight,
            paddingTop: insets.top + 8,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <CircleIconButton
            icon="disclosure"
            variant="back"
            onPress={handleBack}
            overlayMode={hasBackground}
            overlayIsDark={pDark}
            usesLiquidGlass={usesLiquidGlass}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 64,
                right: 64,
                bottom: 11,
                alignItems: 'center',
              },
              floatingNameStyle,
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                maxWidth: '100%',
                fontSize: 17,
                lineHeight: 22,
                fontWeight: '700',
                color: hasBackground ? backdropText : colors.heading,
                letterSpacing: -0.2,
              }}
            >
              {compactTitle}
            </Text>
          </Animated.View>
          <HeaderTextButton
            label="编辑"
            onPress={() => router.push(`/artists/${artist.id}/edit`)}
            overlayMode={hasBackground}
            overlayIsDark={pDark}
            usesLiquidGlass={usesLiquidGlass}
          />
        </View>
        </View>
      ) : null}

      <View
        pointerEvents={activeTab === 'cheki' ? 'auto' : 'none'}
        accessibilityElementsHidden={activeTab !== 'cheki'}
        importantForAccessibility={activeTab === 'cheki' ? 'auto' : 'no-hide-descendants'}
        style={isIOS
          ? { display: activeTab === 'cheki' ? 'contents' : 'none' }
          : [StyleSheet.absoluteFill, { opacity: activeTab === 'cheki' ? 1 : 0 }]}
      >
        <Animated.FlatList
          data={artistChekiItems}
          keyExtractor={(item) => item.key}
          renderItem={renderChekiListItem}
          onScroll={chekiScrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior={isIOS && !hasBackground ? 'automatic' : 'never'}
          style={{ flex: 1, backgroundColor: pageBackgroundColor }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          ListHeaderComponent={hasBackground ? (
            <View>
              <View style={{ backgroundColor: pageBackgroundColor }}>
                <ImageBackground
                  source={{ uri: artist.background_uri! }}
                  resizeMode="cover"
                  style={{ width: '100%', height: heroDisplayHeight }}
                >
                  <LinearGradient
                    colors={backdropPalette.heroOverlayTopColors}
                    locations={[0, 0.28, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={backdropPalette.heroOverlayBottomColors}
                    locations={[0, 0.7, 1]}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: Math.round(heroHeight * 0.48) + BACKDROP_TRANSITION_HEIGHT,
                    }}
                  />
                  <View
                    testID="artist-hero-content"
                    style={{
                      flex: 1,
                      justifyContent: 'flex-end',
                      paddingTop: compactHeaderHeight + 22,
                      paddingHorizontal: 20,
                      paddingBottom: 8,
                      alignItems: 'flex-start',
                      transform: [{ translateY: -ARTIST_HERO_CONTENT_OFFSET }],
                    }}
                  >
                    <View style={{ width: '100%', minWidth: 0, alignItems: 'flex-start' }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: heroTitleIsLong ? 30 : 34,
                          lineHeight: heroTitleIsLong ? 34 : 38,
                          fontWeight: '800',
                          color: backdropText,
                          letterSpacing: heroTitleIsLong ? -0.5 : -0.7,
                          textShadowColor: heroNameShadowColor,
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 8,
                          textAlign: 'left',
                        }}
                      >
                        {artist.name}
                      </Text>
                    </View>
                    <View
                      style={{
                        marginTop: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        columnGap: 16,
                        minWidth: 0,
                        maxWidth: '100%',
                      }}
                    >
                      <HeroMetaAction
                        icon={isOshi ? 'sparkles' : 'favorite'}
                        label={isOshi ? '单推' : artist.is_favorite ? '已收藏' : '收藏'}
                        iconColor={isOshi ? '#c4b5fd' : artist.is_favorite ? '#fb7185' : heroActionIcon}
                        textColor={heroActionText}
                        onPress={handleToggleFavorite}
                      />
                      {parentArtist ? (
                        <HeroMetaAction
                          icon="artists"
                          label={currentGroupCount > 1 ? `${parentArtist.name} 等 ${currentGroupCount} 个` : parentArtist.name}
                          isFlexible
                          iconColor={heroActionIcon}
                          textColor={heroActionText}
                          onPress={() => router.push(`/artists/${parentArtist.id}`)}
                        />
                      ) : null}
                      {renderMetaToggle(true)}
                    </View>
                  </View>
                </ImageBackground>
                <View
                  testID="artist-details-region"
                  style={{ marginTop: -ARTIST_HERO_CONTENT_OFFSET, paddingTop: 8 }}
                >
                  <View testID="artist-section-tabs" style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                    <ArtistSectionTabs
                      key={`cheki-hero-${tabRemountKey.cheki}`}
                      selectedTab="cheki"
                      eventCount={events.length}
                      chekiCount={totalChekiCount}
                      onSelect={handleSelectTab}
                      usesLiquidGlass={usesLiquidGlass}
                      overlayIsDark={pDark}
                      fallbackBackground={cardAltBg}
                      fallbackBorderWidth={lowerCardBorderWidth}
                      fallbackBorderColor={backdropDivider}
                      activeBg={tabActiveBg}
                      activeTextColor={tabActiveText}
                      inactiveTextColor={tabInactiveText}
                    />
                  </View>
                </View>
              </View>
              <View style={{ backgroundColor: 'transparent' }}>
                <View
                  style={{
                    backgroundColor: 'transparent',
                    paddingTop: 0,
                    paddingBottom: 10,
                  }}
                >
                  {members.length > 0 ? (
                    <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ flex: 1, fontSize: 13, color: sectionLabelColor }}>
                          所属成员
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: sectionCountColor }}>
                          {members.length} 人
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: cardBg,
                          borderRadius: 16,
                          borderWidth: lowerCardBorderWidth,
                          borderColor: colors.divider,
                          overflow: 'hidden',
                        }}
                      >
                        {members.map((member, index) => {
                          const memberAvatarSrc = resolveAvatarSource(member.avatar_uri);
                          const memberIsOshi = member.id === oshiArtistId;
                          const isLast = index === members.length - 1;
                          return (
                            <TouchableOpacity
                              key={member.id}
                              activeOpacity={0.72}
                              onPress={() => router.push(`/artists/${member.id}`)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                borderBottomWidth: isLast ? 0 : 1,
                                borderBottomColor: backdropDivider,
                              }}
                            >
                              <View style={{ marginRight: 12 }}>
                                <OshiAvatar source={memberAvatarSrc} size={36} isOshi={memberIsOshi} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '700', color: backdropText }}>
                                    {member.name}
                                  </Text>
                                  {memberIsOshi ? <OshiBadge /> : null}
                                </View>
                                {member.short_name?.trim() && member.short_name.trim() !== member.name ? (
                                  <Text style={{ fontSize: 12, color: backdropTextSecondary }}>{member.short_name}</Text>
                                ) : null}
                              </View>
                              <AppIcon name="disclosure" variant="forward" size={14} color={backdropChevron} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {renderChekiSummary(actionPillText)}
                </View>
              </View>
            </View>
          ) : (
            <>
              <View
                style={{
                  paddingTop: compactHeaderHeight + 22,
                  paddingHorizontal: 20,
                  paddingBottom: 24,
                  alignItems: 'center',
                }}
              >
                <View style={{ marginBottom: 16 }}>
                  <OshiAvatar source={avatarSrc} size={86} isOshi={isOshi} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      flexShrink: 1,
                      fontSize: 28,
                      lineHeight: 32,
                      fontWeight: '900',
                      color: colors.heading,
                      letterSpacing: -0.6,
                      textAlign: 'center',
                    }}
                  >
                    {artist.name}
                  </Text>
                  {isOshi ? <OshiBadge /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, minWidth: 0, maxWidth: '100%' }}>
                  <MetaPill
                    icon={isOshi ? 'sparkles' : 'favorite'}
                    label={isOshi ? '单推' : '收藏'}
                    tone={isOshi ? 'oshi' : artist.is_favorite ? 'favorite' : 'neutral'}
                    overlayMode={false}
                    onPress={handleToggleFavorite}
                  />
                  {parentArtist ? (
                    <MetaPill
                      icon="artists"
                      label={currentGroupCount > 1 ? `${parentArtist.name} 等 ${currentGroupCount} 个` : parentArtist.name}
                      tone="group"
                      isFlexible
                      overlayMode={false}
                      onPress={() => router.push(`/artists/${parentArtist.id}`)}
                    />
                  ) : null}
                  {renderMetaToggle(false)}
                </View>
              </View>

              <View
                style={{
                  backgroundColor: 'transparent',
                  paddingTop: 16,
                  paddingBottom: 10,
                }}
              >
                {members.length > 0 ? (
                  <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ flex: 1, fontSize: 13, color: sectionLabelColor }}>
                        所属成员
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: sectionCountColor }}>
                        {members.length} 人
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        borderWidth: lowerCardBorderWidth,
                        borderColor: colors.divider,
                        overflow: 'hidden',
                      }}
                    >
                      {members.map((member, index) => {
                        const memberAvatarSrc = resolveAvatarSource(member.avatar_uri);
                        const memberIsOshi = member.id === oshiArtistId;
                        const isLast = index === members.length - 1;
                        return (
                          <TouchableOpacity
                            key={member.id}
                            activeOpacity={0.72}
                            onPress={() => router.push(`/artists/${member.id}`)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              borderBottomWidth: isLast ? 0 : 1,
                              borderBottomColor: colors.divider,
                            }}
                          >
                            <View style={{ marginRight: 12 }}>
                              <OshiAvatar source={memberAvatarSrc} size={36} isOshi={memberIsOshi} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>
                                  {member.name}
                                </Text>
                                {memberIsOshi ? <OshiBadge /> : null}
                              </View>
                              {member.short_name?.trim() && member.short_name.trim() !== member.name ? (
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{member.short_name}</Text>
                              ) : null}
                            </View>
                            <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={{ paddingHorizontal: 16 }}>
                  <ArtistSectionTabs
                    key={`cheki-lower-${tabRemountKey.cheki}`}
                    selectedTab="cheki"
                    eventCount={events.length}
                    chekiCount={totalChekiCount}
                    onSelect={handleSelectTab}
                    usesLiquidGlass={false}
                    overlayIsDark={isDark}
                    fallbackBackground={colors.cardAlt}
                    fallbackBorderWidth={lowerCardBorderWidth}
                    fallbackBorderColor={colors.divider}
                  />
                </View>

                {renderChekiSummary(colors.accent)}
              </View>
            </>
          )}
          ListEmptyComponent={renderChekiEmptyState}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
        />
      </View>
      <View
        pointerEvents={activeTab === 'events' ? 'auto' : 'none'}
        accessibilityElementsHidden={activeTab !== 'events'}
        importantForAccessibility={activeTab === 'events' ? 'auto' : 'no-hide-descendants'}
        style={isIOS
          ? { display: activeTab === 'events' ? 'contents' : 'none' }
          : [StyleSheet.absoluteFill, { opacity: activeTab === 'events' ? 1 : 0 }]}
      >
        <Animated.ScrollView
          onScroll={eventsScrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior={isIOS && !hasBackground ? 'automatic' : 'never'}
          style={{ flex: 1, backgroundColor: pageBackgroundColor }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {hasBackground ? (
            <View>
              <View style={{ backgroundColor: pageBackgroundColor }}>
                <ImageBackground
                  source={{ uri: artist.background_uri! }}
                  resizeMode="cover"
                  style={{ width: '100%', height: heroDisplayHeight }}
                >
                  <LinearGradient
                    colors={backdropPalette.heroOverlayTopColors}
                    locations={[0, 0.28, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={backdropPalette.heroOverlayBottomColors}
                    locations={[0, 0.7, 1]}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: Math.round(heroHeight * 0.48) + BACKDROP_TRANSITION_HEIGHT,
                    }}
                  />
                  <View
                    testID="artist-hero-content"
                    style={{
                      flex: 1,
                      justifyContent: 'flex-end',
                      paddingTop: compactHeaderHeight + 22,
                      paddingHorizontal: 20,
                      paddingBottom: 8,
                      alignItems: 'flex-start',
                      transform: [{ translateY: -ARTIST_HERO_CONTENT_OFFSET }],
                    }}
                  >
                    <View style={{ width: '100%', minWidth: 0, alignItems: 'flex-start' }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: heroTitleIsLong ? 30 : 34,
                          lineHeight: heroTitleIsLong ? 34 : 38,
                          fontWeight: '800',
                          color: backdropText,
                          letterSpacing: heroTitleIsLong ? -0.5 : -0.7,
                          textShadowColor: heroNameShadowColor,
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 8,
                          textAlign: 'left',
                        }}
                      >
                        {artist.name}
                      </Text>
                    </View>
                    <View
                      style={{
                        marginTop: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        columnGap: 16,
                        minWidth: 0,
                        maxWidth: '100%',
                      }}
                    >
                      <HeroMetaAction
                        icon={isOshi ? 'sparkles' : 'favorite'}
                        label={isOshi ? '单推' : artist.is_favorite ? '已收藏' : '收藏'}
                        iconColor={isOshi ? '#c4b5fd' : artist.is_favorite ? '#fb7185' : heroActionIcon}
                        textColor={heroActionText}
                        onPress={handleToggleFavorite}
                      />
                      {parentArtist ? (
                        <HeroMetaAction
                          icon="artists"
                          label={currentGroupCount > 1 ? `${parentArtist.name} 等 ${currentGroupCount} 个` : parentArtist.name}
                          isFlexible
                          iconColor={heroActionIcon}
                          textColor={heroActionText}
                          onPress={() => router.push(`/artists/${parentArtist.id}`)}
                        />
                      ) : null}
                      {renderMetaToggle(true)}
                    </View>
                  </View>
                </ImageBackground>
                <View
                  testID="artist-details-region"
                  style={{ marginTop: -ARTIST_HERO_CONTENT_OFFSET, paddingTop: 8 }}
                >
                  <View testID="artist-section-tabs" style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                    <ArtistSectionTabs
                      key={`events-hero-${tabRemountKey.events}`}
                      selectedTab="events"
                      eventCount={events.length}
                      chekiCount={totalChekiCount}
                      onSelect={handleSelectTab}
                      usesLiquidGlass={usesLiquidGlass}
                      overlayIsDark={pDark}
                      fallbackBackground={cardAltBg}
                      fallbackBorderWidth={lowerCardBorderWidth}
                      fallbackBorderColor={backdropDivider}
                      activeBg={tabActiveBg}
                      activeTextColor={tabActiveText}
                      inactiveTextColor={tabInactiveText}
                    />
                  </View>
                </View>
              </View>
              <View style={{ backgroundColor: 'transparent' }}>
                <View
                  style={{
                    backgroundColor: 'transparent',
                    paddingTop: 0,
                    paddingBottom: 10,
                  }}
                >
                  {members.length > 0 ? (
                    <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ flex: 1, fontSize: 13, color: sectionLabelColor }}>
                          所属成员
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: sectionCountColor }}>
                          {members.length} 人
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: cardBg,
                          borderRadius: 16,
                          borderWidth: lowerCardBorderWidth,
                          borderColor: colors.divider,
                          overflow: 'hidden',
                        }}
                      >
                        {members.map((member, index) => {
                          const memberAvatarSrc = resolveAvatarSource(member.avatar_uri);
                          const memberIsOshi = member.id === oshiArtistId;
                          const isLast = index === members.length - 1;
                          return (
                            <TouchableOpacity
                              key={member.id}
                              activeOpacity={0.72}
                              onPress={() => router.push(`/artists/${member.id}`)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                borderBottomWidth: isLast ? 0 : 1,
                                borderBottomColor: backdropDivider,
                              }}
                            >
                              <View style={{ marginRight: 12 }}>
                                <OshiAvatar source={memberAvatarSrc} size={36} isOshi={memberIsOshi} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '700', color: backdropText }}>
                                    {member.name}
                                  </Text>
                                  {memberIsOshi ? <OshiBadge /> : null}
                                </View>
                                {member.short_name?.trim() && member.short_name.trim() !== member.name ? (
                                  <Text style={{ fontSize: 12, color: backdropTextSecondary }}>{member.short_name}</Text>
                                ) : null}
                              </View>
                              <AppIcon name="disclosure" variant="forward" size={14} color={backdropChevron} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  <View style={{ paddingHorizontal: 16 }}>
                    {events.length === 0 ? (
                      <EmptyState icon="music" message="还没有记录的活动" borderless bgColor={cardBg} textColor={backdropEmptyTextColor} />
                    ) : (
                      eventSections.map((section) => (
                        <View key={section.key}>
                          <EventSectionHeader
                            title={section.title}
                            count={section.data.length}
                            colors={colors}
                            titleColor={backdropText}
                            pillBackgroundColor={actionPillBackground}
                            pillTextColor={backdropText}
                          />
                          {section.data.map((event) => (
                            <EventCard
                              key={event.id}
                              event={event}
                              oshiBadge={getEventCardOshiBadge(event.status, null)}
                              variant="compact"
                              style={eventCardSurfaceStyle}
                              tone={pDark ? 'showcase' : 'showcase-light'}
                            />
                          ))}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <>
              <View
                style={{
                  paddingTop: compactHeaderHeight + 22,
                  paddingHorizontal: 20,
                  paddingBottom: 24,
                  alignItems: 'center',
                }}
              >
                <View style={{ marginBottom: 16 }}>
                  <OshiAvatar source={avatarSrc} size={86} isOshi={isOshi} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      flexShrink: 1,
                      fontSize: 28,
                      lineHeight: 32,
                      fontWeight: '900',
                      color: colors.heading,
                      letterSpacing: -0.6,
                      textAlign: 'center',
                    }}
                  >
                    {artist.name}
                  </Text>
                  {isOshi ? <OshiBadge /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, minWidth: 0, maxWidth: '100%' }}>
                  <MetaPill
                    icon={isOshi ? 'sparkles' : 'favorite'}
                    label={isOshi ? '单推' : '收藏'}
                    tone={isOshi ? 'oshi' : artist.is_favorite ? 'favorite' : 'neutral'}
                    overlayMode={false}
                    onPress={handleToggleFavorite}
                  />
                  {parentArtist ? (
                    <MetaPill
                      icon="artists"
                      label={currentGroupCount > 1 ? `${parentArtist.name} 等 ${currentGroupCount} 个` : parentArtist.name}
                      tone="group"
                      isFlexible
                      overlayMode={false}
                      onPress={() => router.push(`/artists/${parentArtist.id}`)}
                    />
                  ) : null}
                  {renderMetaToggle(false)}
                </View>
              </View>

              <View
                style={{
                  backgroundColor: 'transparent',
                  paddingTop: 16,
                  paddingBottom: 10,
                }}
              >
                {members.length > 0 ? (
                  <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ flex: 1, fontSize: 13, color: sectionLabelColor }}>
                        所属成员
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: sectionCountColor }}>
                        {members.length} 人
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        borderWidth: lowerCardBorderWidth,
                        borderColor: colors.divider,
                        overflow: 'hidden',
                      }}
                    >
                      {members.map((member, index) => {
                        const memberAvatarSrc = resolveAvatarSource(member.avatar_uri);
                        const memberIsOshi = member.id === oshiArtistId;
                        const isLast = index === members.length - 1;
                        return (
                          <TouchableOpacity
                            key={member.id}
                            activeOpacity={0.72}
                            onPress={() => router.push(`/artists/${member.id}`)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              borderBottomWidth: isLast ? 0 : 1,
                              borderBottomColor: colors.divider,
                            }}
                          >
                            <View style={{ marginRight: 12 }}>
                              <OshiAvatar source={memberAvatarSrc} size={36} isOshi={memberIsOshi} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>
                                  {member.name}
                                </Text>
                                {memberIsOshi ? <OshiBadge /> : null}
                              </View>
                              {member.short_name?.trim() && member.short_name.trim() !== member.name ? (
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{member.short_name}</Text>
                              ) : null}
                            </View>
                            <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={{ paddingHorizontal: 16 }}>
                  <ArtistSectionTabs
                    key={`events-lower-${tabRemountKey.events}`}
                    selectedTab="events"
                    eventCount={events.length}
                    chekiCount={totalChekiCount}
                    onSelect={handleSelectTab}
                    usesLiquidGlass={false}
                    overlayIsDark={isDark}
                    fallbackBackground={colors.cardAlt}
                    fallbackBorderWidth={lowerCardBorderWidth}
                    fallbackBorderColor={colors.divider}
                  />
                </View>

                <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
                  {events.length === 0 ? (
                    <EmptyState icon="music" message="还没有记录的活动" borderless={hasBackground} />
                  ) : (
                    eventSections.map((section) => (
                      <View key={section.key}>
                        <EventSectionHeader title={section.title} count={section.data.length} colors={colors} />
                        {section.data.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            oshiBadge={getEventCardOshiBadge(event.status, null)}
                            variant="compact"
                            style={eventCardSurfaceStyle}
                            tone="default"
                          />
                        ))}
                      </View>
                    ))
                  )}
                </View>
              </View>
            </>
          )}
        </Animated.ScrollView>
      </View>

      {isIOS ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button onPress={() => router.push(`/artists/${artist.id}/edit`)}>
            编辑
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}

      <ChekiViewerModal
        visible={viewerSelectedId !== null}
        items={viewerItems}
        selectedId={viewerSelectedId}
        onClose={() => setViewerSelectedId(null)}
        onEdit={(item) => router.push(`/cheki/items/${item.itemId ?? item.id}/edit`)}
        onDelete={(item) => handleDeleteCheki(item.itemId ?? item.id)}
        onToggleFavorite={(item) => void handleToggleChekiFavorite(item)}
      />

      <BottomSheetDialog
        visible={attributesSheetVisible}
        title="更多"
        onClose={() => setAttributesSheetVisible(false)}
        scrollable
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
      >
        {renderArtistAttributes()}
      </BottomSheetDialog>
    </View>
  );
}

function CircleIconButton({
  icon,
  variant,
  onPress,
  overlayMode,
  overlayIsDark,
  usesLiquidGlass,
}: {
  icon: AppIconName;
  variant?: 'back' | 'forward' | 'up' | 'down';
  onPress: () => void;
  overlayMode: boolean;
  overlayIsDark: boolean;
  usesLiquidGlass: boolean;
}) {
  const { colors } = useAppTheme();
  const foregroundColor = overlayMode
    ? (overlayIsDark ? colors.white : 'rgba(0,0,0,0.82)')
    : colors.heading;
  const control = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={variant === 'back' ? '返回' : undefined}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.66 : 1,
      })}
    >
      <AppIcon name={icon} variant={variant} size={20} color={foregroundColor} />
    </Pressable>
  );

  if (usesLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="clear"
        colorScheme={overlayIsDark ? 'dark' : 'light'}
        isInteractive
        style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}
      >
        {control}
      </GlassView>
    );
  }

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: overlayMode
          ? (overlayIsDark ? 'rgba(12,12,16,0.48)' : 'rgba(250,250,252,0.72)')
          : colors.card,
        borderWidth: 1,
        borderColor: overlayMode
          ? (overlayIsDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)')
          : colors.divider,
      }}
    >
      {control}
    </View>
  );
}

function HeaderTextButton({
  label,
  onPress,
  overlayMode,
  overlayIsDark,
  usesLiquidGlass,
}: {
  label: string;
  onPress: () => void;
  overlayMode: boolean;
  overlayIsDark: boolean;
  usesLiquidGlass: boolean;
}) {
  const { colors } = useAppTheme();
  const foregroundColor = overlayMode
    ? (overlayIsDark ? colors.white : 'rgba(0,0,0,0.82)')
    : colors.accentText;
  const control = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 60,
        height: 44,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.66 : 1,
      })}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: foregroundColor }}>{label}</Text>
    </Pressable>
  );

  if (usesLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="clear"
        colorScheme={overlayIsDark ? 'dark' : 'light'}
        isInteractive
        style={{ minWidth: 60, height: 44, borderRadius: 22, overflow: 'hidden' }}
      >
        {control}
      </GlassView>
    );
  }

  return (
    <View
      style={{
        minWidth: 52,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: overlayMode
          ? (overlayIsDark ? 'rgba(12,12,16,0.48)' : 'rgba(250,250,252,0.72)')
          : colors.card,
        borderWidth: 1,
        borderColor: overlayMode
          ? (overlayIsDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)')
          : colors.divider,
      }}
    >
      {control}
    </View>
  );
}

function ArtistSectionTabs({
  selectedTab,
  eventCount,
  chekiCount,
  onSelect,
  usesLiquidGlass,
  overlayIsDark,
  fallbackBackground,
  fallbackBorderWidth,
  fallbackBorderColor,
  activeBg,
  activeTextColor,
  inactiveTextColor,
}: {
  selectedTab: TabKey;
  eventCount: number;
  chekiCount: number;
  onSelect: (tab: TabKey) => void;
  usesLiquidGlass: boolean;
  overlayIsDark: boolean;
  fallbackBackground: string;
  fallbackBorderWidth: number;
  fallbackBorderColor: string;
  activeBg?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
}) {
  const values = [`活动 · ${eventCount}`, `拍立得 · ${chekiCount}`];

  if (Platform.OS === 'ios') {
    return (
      <IOSLargeSegmentedControl
        testID="artist-section-segmented-control"
        values={values}
        selectedIndex={selectedTab === 'events' ? 0 : 1}
        appearance={overlayIsDark ? 'dark' : 'light'}
        onChange={({ nativeEvent }) => {
          const nextTab = TAB_KEYS[nativeEvent.selectedSegmentIndex];
          if (nextTab) onSelect(nextTab);
        }}
      />
    );
  }

  return (
    <TabSwitcherSurface
      usesLiquidGlass={usesLiquidGlass}
      overlayIsDark={overlayIsDark}
      fallbackBackground={fallbackBackground}
      fallbackBorderWidth={fallbackBorderWidth}
      fallbackBorderColor={fallbackBorderColor}
    >
      <TabButton
        label={values[0]}
        active={selectedTab === 'events'}
        onPress={() => onSelect('events')}
        activeBg={activeBg}
        activeTextColor={activeTextColor}
        inactiveTextColor={inactiveTextColor}
      />
      <TabButton
        label={values[1]}
        active={selectedTab === 'cheki'}
        onPress={() => onSelect('cheki')}
        activeBg={activeBg}
        activeTextColor={activeTextColor}
        inactiveTextColor={inactiveTextColor}
      />
    </TabSwitcherSurface>
  );
}

function TabButton({
  label,
  active,
  onPress,
  activeBg,
  activeTextColor,
  inactiveTextColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeBg?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
}) {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 40,
        justifyContent: 'center',
        paddingVertical: 4,
        borderRadius: 9,
        alignItems: 'center',
        backgroundColor: active ? (activeBg ?? colors.card) : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: active ? (activeTextColor ?? colors.text) : (inactiveTextColor ?? colors.textSecondary),
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TabSwitcherSurface({
  children,
  usesLiquidGlass,
  overlayIsDark,
  fallbackBackground,
  fallbackBorderWidth,
  fallbackBorderColor,
}: {
  children: ReactNode;
  usesLiquidGlass: boolean;
  overlayIsDark: boolean;
  fallbackBackground: string;
  fallbackBorderWidth: number;
  fallbackBorderColor: string;
}) {
  const contentStyle = {
    flexDirection: 'row' as const,
    borderRadius: 14,
    padding: 2,
    overflow: 'hidden' as const,
  };

  if (usesLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={overlayIsDark ? 'dark' : 'light'}
        isInteractive
        style={contentStyle}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        contentStyle,
        {
          backgroundColor: fallbackBackground,
          borderWidth: fallbackBorderWidth,
          borderColor: fallbackBorderColor,
        },
      ]}
    >
      {children}
    </View>
  );
}

function HeroMetaAction({
  icon,
  variant,
  label,
  iconColor,
  textColor,
  isFlexible = false,
  onPress,
}: {
  icon: AppIconName;
  variant?: AppIconVariant;
  label: string;
  iconColor: string;
  textColor: string;
  isFlexible?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        maxWidth: isFlexible ? '58%' : undefined,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <AppIcon name={icon} variant={variant} size={15} color={iconColor} />
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, minWidth: 0, fontSize: 13, fontWeight: '700', color: textColor }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type MetaTone = 'neutral' | 'favorite' | 'oshi' | 'group' | 'link';

function MetaPill({
  icon,
  iconVariant,
  label,
  tone,
  isFlexible = false,
  overlayMode,
  onPress,
}: {
  icon: AppIconName;
  iconVariant?: AppIconVariant;
  label: string;
  tone: MetaTone;
  isFlexible?: boolean;
  overlayMode: boolean | 'light';
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const palette = overlayMode === true
    ? (
      tone === 'oshi'
        ? { bg: 'rgba(139,92,246,0.2)', border: 'transparent', text: '#ddd6fe', icon: '#c4b5fd' }
        : tone === 'favorite'
          ? { bg: 'rgba(8,6,15,0.52)', border: 'transparent', text: '#f5f3ff', icon: '#fb7185' }
          : tone === 'group'
            ? { bg: 'rgba(8,6,15,0.52)', border: 'transparent', text: '#ddd6fe', icon: '#c4b5fd' }
            : tone === 'link'
              ? { bg: 'rgba(8,6,15,0.52)', border: 'transparent', text: '#bae6fd', icon: '#7dd3fc' }
              : { bg: 'rgba(8,6,15,0.52)', border: 'transparent', text: '#f5f3ff', icon: '#f5f3ff' }
    )
    : overlayMode === 'light'
      ? (
        tone === 'oshi'
          ? { bg: '#f3e8ff', border: 'transparent', text: '#5b21b6', icon: '#7c3aed' }
          : tone === 'favorite'
            ? { bg: '#fff1f2', border: 'transparent', text: '#be123c', icon: '#e11d48' }
            : tone === 'group'
              ? { bg: '#faf5ff', border: 'transparent', text: '#5b21b6', icon: '#7c3aed' }
              : tone === 'link'
                ? { bg: '#eff6ff', border: 'transparent', text: '#1d4ed8', icon: '#2563eb' }
                : { bg: '#f4f4f5', border: 'transparent', text: '#3f3f46', icon: '#52525b' }
      )
    : (
      tone === 'oshi'
        ? { bg: colors.card, border: 'transparent', text: colors.accentText, icon: colors.oshiBadgeBg }
        : tone === 'favorite'
          ? { bg: colors.card, border: 'transparent', text: colors.textSecondary, icon: colors.oshiBadgeBg }
          : tone === 'group'
            ? { bg: colors.card, border: 'transparent', text: colors.accentText, icon: colors.accent }
            : tone === 'link'
              ? { bg: colors.card, border: 'transparent', text: isDark ? '#bfdbfe' : '#1d4ed8', icon: isDark ? '#93c5fd' : '#2563eb' }
              : { bg: colors.card, border: 'transparent', text: colors.textSecondary, icon: colors.textSecondary }
    );
  const pillStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minWidth: 0,
    maxWidth: '100%' as const,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
  };
  const pillChildren = (
    <>
      <AppIcon name={icon} variant={iconVariant} size={14} color={palette.icon} />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flexShrink: isFlexible ? 1 : 0,
          minWidth: 0,
          fontSize: 12,
          fontWeight: '700',
          color: palette.text,
        }}
      >
        {label}
      </Text>
    </>
  );
  const innerContent = (
    <View style={[pillStyle, { backgroundColor: palette.bg }]}>
      {pillChildren}
    </View>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.75}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={{
        borderRadius: 99,
        flexShrink: isFlexible ? 1 : 0,
        minWidth: isFlexible ? 0 : undefined,
        maxWidth: isFlexible ? '100%' : undefined,
      }}
    >
      {innerContent}
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  message,
  actionLabel,
  onPressAction,
  borderless = false,
  bgColor,
  textColor,
}: {
  icon?: AppIconName;
  message: string;
  actionLabel?: string;
  onPressAction?: () => void;
  borderless?: boolean;
  bgColor?: string;
  textColor?: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        backgroundColor: bgColor ?? colors.card,
        borderRadius: 16,
        paddingVertical: 32,
        alignItems: 'center',
        borderWidth: borderless ? 0 : 1,
        borderColor: colors.divider,
      }}
    >
      {icon ? <AppIcon name={icon} size={22} color={textColor ?? colors.textSecondary} style={{ marginBottom: 8 }} /> : null}
      <Text style={{ fontSize: 14, color: textColor ?? colors.textSecondary }}>{message}</Text>
      {actionLabel && onPressAction ? (
        <TouchableOpacity
          onPress={onPressAction}
          activeOpacity={0.75}
          style={{
            marginTop: 12,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: colors.accentSofter,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { AppIcon, type AppIconName } from '../../../src/components/AppIcon';
import { ChekiManualEntryList } from '../../../src/components/ChekiManualEntryList';
import { ChekiViewerModal } from '../../../src/components/ChekiViewerModal';
import { OshiAvatar, OshiBadge } from '../../../src/components/Oshi';
import { useDB } from '../../../src/context/DBContext';
import { useAppTheme } from '../../../src/theme/appTheme';
import { Artist, Cheki, ChekiManualEntry, Event } from '../../../src/types/models';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { deriveArtistBackdropPalette, extractArtistBackgroundColor } from '../../../src/utils/artistBackdrop';
import { buildChekiViewerItems, getChekiManualCount } from '../../../src/utils/cheki';
import { buildEventMonthSections } from '../../../src/utils/eventSections';
import { sortArtistsWithOshi } from '../../../src/utils/filter';
import { showDeleteFailedAlert } from '../../../src/utils/failureAlert';
import { getEventCardOshiBadge } from '../../../src/utils/oshiMatch';

const ARTIST_HERO_ASPECT_RATIO = 4 / 5;
const CONTENT_OVERLAP = 24;
const TAB_KEYS = ['events', 'cheki'] as const;
type TabKey = (typeof TAB_KEYS)[number];
type ArtistChekiListItem =
  | { type: 'row'; key: string; chekis: Cheki[]; isLastPhotoRow: boolean }
  | { type: 'manual'; key: 'manual'; entries: ChekiManualEntry[] };

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
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [parentArtist, setParentArtist] = useState<Artist | null>(null);
  const [members, setMembers] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventMap, setEventMap] = useState<Map<string, Event>>(new Map());
  const [chekiList, setChekiList] = useState<Cheki[]>([]);
  const [manualEntries, setManualEntries] = useState<ChekiManualEntry[]>([]);
  const [viewerSelectedId, setViewerSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('events');

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const load = useCallback(async () => {
    if (!id) {
      setArtist(null);
      setParentArtist(null);
      setMembers([]);
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
    setMembers(sortArtistsWithOshi(memberArtists, config.oshi_artist_id));
    setOshiArtistId(config.oshi_artist_id);
    setEventMap(new Map(allEvents.map((event) => [event.id, event])));

    let resolvedEvents = artistEvents;
    if (currentArtist?.parent_id) {
      const [parentEvents, parent] = await Promise.all([
        db.events.findByArtistId(currentArtist.parent_id),
        db.artists.findById(currentArtist.parent_id),
      ]);
      const merged = [...artistEvents, ...parentEvents];
      const seen = new Set<string>();
      resolvedEvents = merged.filter((event) => (seen.has(event.id) ? false : (seen.add(event.id), true)));
      resolvedEvents.sort((a, b) => b.event_date.localeCompare(a.event_date));
      setParentArtist(parent);
    } else {
      setParentArtist(null);
    }

    setEvents(resolvedEvents);
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

  const compactHeaderHeight = insets.top + 52;
  const hasBackground = Boolean(artist?.background_uri);
  const heroHeight = hasBackground ? Math.round(screenWidth / ARTIST_HERO_ASPECT_RATIO) : 0;
  const headerFadeStart = hasBackground ? Math.max(120, heroHeight - 168) : 40;
  const headerFadeEnd = hasBackground ? Math.max(headerFadeStart + 68, heroHeight - 92) : 108;

  const compactHeaderBackgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [headerFadeStart, headerFadeEnd], [0, 1], Extrapolation.CLAMP),
  }));
  const floatingNameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [headerFadeStart, headerFadeEnd], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [headerFadeStart, headerFadeEnd], [8, 0], Extrapolation.CLAMP) }],
  }));

  const chekiCellW = Math.floor((screenWidth - 32 - 16) / 3);
  const chekiCellH = Math.round((chekiCellW * 86) / 54);
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
        <Stack.Screen options={{ headerShown: false }} />
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
    ? (pDark ? 'rgba(15,10,30,0.45)' : 'rgba(255,255,255,0.72)')
    : colors.card;
  const cardAltBg = hasBackground
    ? (pDark ? 'rgba(15,10,30,0.32)' : 'rgba(255,255,255,0.52)')
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
  const tabActiveBg = pDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
  const tabActiveText = pDark ? colors.white : 'rgba(0,0,0,0.85)';
  const tabInactiveText = pDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.42)';
  const heroNameShadowColor = pDark ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.1)';
  const backdropEmptyTextColor = pDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const chekiListIsDark = hasBackground ? pDark : isDark;
  const chekiManualTone = hasBackground && pDark ? 'glass' : 'default';

  const renderChekiListItem = ({ item }: { item: ArtistChekiListItem }) => {
    if (item.type === 'manual') {
      return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <ChekiManualEntryList
            entries={item.entries}
            eventMap={eventMap}
            isDark={chekiListIsDark}
            tone={chekiManualTone}
            onPressEntry={(entry) => router.push(`/cheki/manual/${entry.id}/edit`)}
          />
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: item.isLastPhotoRow ? 24 : 8 }}>
          {item.chekis.map((cheki) => (
            <TouchableOpacity
              key={cheki.id}
              onPress={() => setViewerSelectedId(cheki.id)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: cheki.photo_uri }}
                resizeMethod="resize"
                style={{
                  width: chekiCellW,
                  height: chekiCellH,
                  borderRadius: 10,
                  backgroundColor: galleryPlaceholderBg,
                  borderWidth: 1,
                  borderColor: galleryPlaceholderBorder,
                }}
              />
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
    <View style={{ flex: 1, backgroundColor: pageBackgroundColor }}>
      <Stack.Screen options={{ headerShown: false }} />

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
            flex: 1,
            paddingTop: insets.top + 8,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <CircleIconButton icon="disclosure" variant="back" onPress={handleBack} overlayMode={hasBackground} />
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
          <HeaderTextButton label="编辑" onPress={() => router.push(`/artists/${artist.id}/edit`)} overlayMode={hasBackground} />
        </View>
      </View>

      {activeTab === 'cheki' ? (
        <Animated.FlatList
          data={artistChekiItems}
          keyExtractor={(item) => item.key}
          renderItem={renderChekiListItem}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          ListHeaderComponent={hasBackground ? (
            <>
              <View style={{ backgroundColor: pageBackgroundColor }}>
                <ImageBackground
                  source={{ uri: artist.background_uri! }}
                  resizeMode="cover"
                  style={{ width: '100%', aspectRatio: ARTIST_HERO_ASPECT_RATIO }}
                >
                  <LinearGradient
                    colors={backdropPalette.heroOverlayTopColors}
                    locations={[0, 0.28, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={backdropPalette.heroOverlayBottomColors}
                    locations={[0, 0.42, 1]}
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '44%' }}
                  />
                  <View
                    style={{
                      flex: 1,
                      justifyContent: 'flex-end',
                      paddingTop: compactHeaderHeight + 22,
                      paddingHorizontal: 20,
                      paddingBottom: 8,
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ marginBottom: 14 }}>
                      <OshiAvatar source={avatarSrc} size={48} isOshi={isOshi} />
                    </View>
                    <View style={{ minWidth: 0, alignItems: 'center' }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: heroTitleIsLong ? 28 : 32,
                          lineHeight: heroTitleIsLong ? 32 : 36,
                          fontWeight: '900',
                          color: backdropText,
                          letterSpacing: heroTitleIsLong ? -0.5 : -0.7,
                          textShadowColor: heroNameShadowColor,
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 8,
                          textAlign: 'center',
                        }}
                      >
                        {artist.name}
                      </Text>
                    </View>
                    <View
                      style={{
                        marginTop: 18,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                        minWidth: 0,
                        maxWidth: '100%',
                      }}
                    >
                      <MetaPill
                        icon={isOshi ? 'sparkles' : 'favorite'}
                        label={isOshi ? '单推' : '收藏'}
                        tone={isOshi ? 'oshi' : artist.is_favorite ? 'favorite' : 'neutral'}
                        overlayMode={pDark ? true : 'light'}
                        onPress={handleToggleFavorite}
                      />
                      {parentArtist ? (
                        <MetaPill
                          icon="artists"
                          label={parentArtist.name}
                          tone="group"
                          isFlexible
                          overlayMode={pDark ? true : 'light'}
                          onPress={() => router.push(`/artists/${parentArtist.id}`)}
                        />
                      ) : null}
                      {artist.url ? (
                        <MetaPill
                          icon="link"
                          label="链接"
                          tone="link"
                          overlayMode={pDark ? true : 'light'}
                          onPress={() => Linking.openURL(artist.url!)}
                        />
                      ) : null}
                    </View>
                  </View>
                </ImageBackground>
              </View>
              <View
                style={{
                  marginTop: -CONTENT_OVERLAP,
                  backgroundColor: 'transparent',
                }}
              >
                <LinearGradient
                  colors={backdropPalette.transitionColors}
                  locations={[0, 0.68, 1]}
                  style={{ height: CONTENT_OVERLAP + 34 }}
                />
                <View
                  style={{
                    marginTop: -22,
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
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: cardAltBg,
                        borderRadius: 14,
                        padding: 4,
                        borderWidth: lowerCardBorderWidth,
                        borderColor: backdropDivider,
                      }}
                    >
                      <TabButton
                        label={`活动 · ${events.length}`}
                        active={false}
                        onPress={() => setActiveTab('events')}
                        activeBg={tabActiveBg}
                        activeTextColor={tabActiveText}
                        inactiveTextColor={tabInactiveText}
                      />
                      <TabButton
                        label={`拍立得 · ${totalChekiCount}`}
                        active
                        onPress={() => setActiveTab('cheki')}
                        activeBg={tabActiveBg}
                        activeTextColor={tabActiveText}
                        inactiveTextColor={tabInactiveText}
                      />
                    </View>
                  </View>

                  {renderChekiSummary(actionPillText)}
                </View>
              </View>
            </>
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
                      label={parentArtist.name}
                      tone="group"
                      isFlexible
                      overlayMode={false}
                      onPress={() => router.push(`/artists/${parentArtist.id}`)}
                    />
                  ) : null}
                  {artist.url ? (
                    <MetaPill
                      icon="link"
                      label="链接"
                      tone="link"
                      overlayMode={false}
                      onPress={() => Linking.openURL(artist.url!)}
                    />
                  ) : null}
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
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: colors.cardAlt,
                      borderRadius: 14,
                      padding: 4,
                      borderWidth: lowerCardBorderWidth,
                      borderColor: colors.divider,
                    }}
                  >
                    <TabButton
                      label={`活动 · ${events.length}`}
                      active={false}
                      onPress={() => setActiveTab('events')}
                    />
                    <TabButton
                      label={`拍立得 · ${totalChekiCount}`}
                      active
                      onPress={() => setActiveTab('cheki')}
                    />
                  </View>
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
      ) : (
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {hasBackground ? (
            <>
              <View style={{ backgroundColor: pageBackgroundColor }}>
                <ImageBackground
                  source={{ uri: artist.background_uri! }}
                  resizeMode="cover"
                  style={{ width: '100%', aspectRatio: ARTIST_HERO_ASPECT_RATIO }}
                >
                  <LinearGradient
                    colors={backdropPalette.heroOverlayTopColors}
                    locations={[0, 0.28, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={backdropPalette.heroOverlayBottomColors}
                    locations={[0, 0.42, 1]}
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '44%' }}
                  />
                  <View
                    style={{
                      flex: 1,
                      justifyContent: 'flex-end',
                      paddingTop: compactHeaderHeight + 22,
                      paddingHorizontal: 20,
                      paddingBottom: 8,
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ marginBottom: 14 }}>
                      <OshiAvatar source={avatarSrc} size={48} isOshi={isOshi} />
                    </View>
                    <View style={{ minWidth: 0, alignItems: 'center' }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: heroTitleIsLong ? 28 : 32,
                          lineHeight: heroTitleIsLong ? 32 : 36,
                          fontWeight: '900',
                          color: backdropText,
                          letterSpacing: heroTitleIsLong ? -0.5 : -0.7,
                          textShadowColor: heroNameShadowColor,
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 8,
                          textAlign: 'center',
                        }}
                      >
                        {artist.name}
                      </Text>
                    </View>
                    <View
                      style={{
                        marginTop: 18,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                        minWidth: 0,
                        maxWidth: '100%',
                      }}
                    >
                      <MetaPill
                        icon={isOshi ? 'sparkles' : 'favorite'}
                        label={isOshi ? '单推' : '收藏'}
                        tone={isOshi ? 'oshi' : artist.is_favorite ? 'favorite' : 'neutral'}
                        overlayMode={pDark ? true : 'light'}
                        onPress={handleToggleFavorite}
                      />
                      {parentArtist ? (
                        <MetaPill
                          icon="artists"
                          label={parentArtist.name}
                          tone="group"
                          isFlexible
                          overlayMode={pDark ? true : 'light'}
                          onPress={() => router.push(`/artists/${parentArtist.id}`)}
                        />
                      ) : null}
                      {artist.url ? (
                        <MetaPill
                          icon="link"
                          label="链接"
                          tone="link"
                          overlayMode={pDark ? true : 'light'}
                          onPress={() => Linking.openURL(artist.url!)}
                        />
                      ) : null}
                    </View>
                  </View>
                </ImageBackground>
              </View>
              <View
                style={{
                  marginTop: -CONTENT_OVERLAP,
                  backgroundColor: 'transparent',
                }}
              >
                <LinearGradient
                  colors={backdropPalette.transitionColors}
                  locations={[0, 0.68, 1]}
                  style={{ height: CONTENT_OVERLAP + 34 }}
                />
                <View
                  style={{
                    marginTop: -22,
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
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: cardAltBg,
                        borderRadius: 14,
                        padding: 4,
                        borderWidth: lowerCardBorderWidth,
                        borderColor: backdropDivider,
                      }}
                    >
                      <TabButton
                        label={`活动 · ${events.length}`}
                        active
                        onPress={() => setActiveTab('events')}
                        activeBg={tabActiveBg}
                        activeTextColor={tabActiveText}
                        inactiveTextColor={tabInactiveText}
                      />
                      <TabButton
                        label={`拍立得 · ${totalChekiCount}`}
                        active={false}
                        onPress={() => setActiveTab('cheki')}
                        activeBg={tabActiveBg}
                        activeTextColor={tabActiveText}
                        inactiveTextColor={tabInactiveText}
                      />
                    </View>
                  </View>

                  <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
                    {events.length === 0 ? (
                      <EmptyState icon="music" message="还没有记录的活动" borderless bgColor={cardBg} textColor={backdropEmptyTextColor} />
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
                              tone={pDark ? 'showcase' : 'showcase-light'}
                            />
                          ))}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            </>
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
                      label={parentArtist.name}
                      tone="group"
                      isFlexible
                      overlayMode={false}
                      onPress={() => router.push(`/artists/${parentArtist.id}`)}
                    />
                  ) : null}
                  {artist.url ? (
                    <MetaPill
                      icon="link"
                      label="链接"
                      tone="link"
                      overlayMode={false}
                      onPress={() => Linking.openURL(artist.url!)}
                    />
                  ) : null}
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
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: colors.cardAlt,
                      borderRadius: 14,
                      padding: 4,
                      borderWidth: lowerCardBorderWidth,
                      borderColor: colors.divider,
                    }}
                  >
                    <TabButton
                      label={`活动 · ${events.length}`}
                      active
                      onPress={() => setActiveTab('events')}
                    />
                    <TabButton
                      label={`拍立得 · ${totalChekiCount}`}
                      active={false}
                      onPress={() => setActiveTab('cheki')}
                    />
                  </View>
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
      )}

      <ChekiViewerModal
        visible={viewerSelectedId !== null}
        items={viewerItems}
        selectedId={viewerSelectedId}
        onClose={() => setViewerSelectedId(null)}
        onEdit={(item) => router.push(`/cheki/${item.id}/edit`)}
        onDelete={(item) => handleDeleteCheki(item.id)}
      />
    </View>
  );
}

function CircleIconButton({
  icon,
  variant,
  onPress,
  overlayMode,
}: {
  icon: AppIconName;
  variant?: 'back' | 'forward' | 'up' | 'down';
  onPress: () => void;
  overlayMode: boolean;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: overlayMode
          ? (isDark ? 'rgba(15,10,30,0.42)' : 'rgba(255,255,255,0.78)')
          : colors.card,
        borderWidth: 1,
        borderColor: overlayMode
          ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(31,18,53,0.08)')
          : colors.divider,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <AppIcon name={icon} variant={variant} size={20} color={colors.heading} />
    </Pressable>
  );
}

function HeaderTextButton({ label, onPress, overlayMode }: { label: string; onPress: () => void; overlayMode: boolean }) {
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 52,
        height: 38,
        borderRadius: 19,
        paddingHorizontal: 14,
        backgroundColor: overlayMode
          ? (isDark ? 'rgba(15,10,30,0.42)' : 'rgba(255,255,255,0.78)')
          : colors.card,
        borderWidth: 1,
        borderColor: overlayMode
          ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(31,18,53,0.08)')
          : colors.divider,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accentText }}>{label}</Text>
    </Pressable>
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
        paddingVertical: 9,
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

type MetaTone = 'neutral' | 'favorite' | 'oshi' | 'group' | 'link';

function MetaPill({
  icon,
  label,
  tone,
  isFlexible = false,
  overlayMode,
  onPress,
}: {
  icon: AppIconName;
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
      <AppIcon name={icon} size={14} color={palette.icon} />
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

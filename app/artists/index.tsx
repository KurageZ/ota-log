import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useDB } from '../../src/context/DBContext';
import { Artist } from '../../src/types/models';
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { getArtistDisplayText, getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { filterArtistsByQuery } from '../../src/utils/filter';
import { OshiAvatar, OshiBadge } from '../../src/components/Oshi';
import { useAppTheme } from '../../src/theme/appTheme';
import { SearchFilterBar } from '../../src/components/SearchFilterBar';
import { FilterSheet, FilterSection } from '../../src/components/FilterSheet';
import { FilteredEmptyState } from '../../src/components/FilteredEmptyState';
import { AppIcon, type AppIconName } from '../../src/components/AppIcon';
import { NativeAddToolbar } from '../../src/components/native-add-toolbar';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

type FilterTab = 'all' | 'favorites';
type ArtistEventFilter = 'attended' | null;
type ArtistGroupFilter = 'has_parent' | 'no_parent' | null;
const IS_IOS = process.env.EXPO_OS === 'ios';

export default function ArtistsScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [hasChekiOnly, setHasChekiOnly] = useState(false);
  const [chekiArtistIds, setChekiArtistIds] = useState<Set<string>>(new Set());
  const [eventArtistIds, setEventArtistIds] = useState<Set<string>>(new Set());
  const [eventFilter, setEventFilter] = useState<ArtistEventFilter>(null);
  const [groupFilter, setGroupFilter] = useState<ArtistGroupFilter>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pendingFavoriteArtistId, setPendingFavoriteArtistId] = useState<string | null>(null);

  const parentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    artists.forEach((artist) => {
      map[artist.id] = getArtistPrimaryName(artist);
    });
    return map;
  }, [artists]);

  const filteredArtists = useMemo(() => {
    const searched = filterArtistsByQuery(artists, searchQuery, oshiArtistId);
    return searched.filter((artist) => {
      if (filter === 'favorites' && artist.is_favorite !== 1) return false;
      if (hasChekiOnly && !chekiArtistIds.has(artist.id)) return false;
      if (eventFilter === 'attended' && !eventArtistIds.has(artist.id)) return false;
      if (groupFilter === 'has_parent' && !artist.parent_id) return false;
      if (groupFilter === 'no_parent' && artist.parent_id) return false;
      return true;
    });
  }, [artists, searchQuery, oshiArtistId, filter, hasChekiOnly, chekiArtistIds, eventFilter, eventArtistIds, groupFilter]);

  const loadArtists = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const [data, distinctChekiArtistIds, distinctEventArtistIds, config] = await Promise.all([
        db.artists.findAll(),
        db.cheki.findDistinctArtistIds(),
        db.events.findDistinctArtistIds(),
        db.userConfig.getConfig(),
      ]);
      setArtists(data);
      setChekiArtistIds(new Set(distinctChekiArtistIds));
      setEventArtistIds(new Set(distinctEventArtistIds));
      setOshiArtistId(config.oshi_artist_id);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadArtists();
    }, [loadArtists])
  );

  const handleFilterChange = useCallback((tab: FilterTab) => {
    setFilter(tab);
  }, []);

  const filterSections = useMemo<FilterSection[]>(() => [
    {
      key: 'cheki',
      title: '拍立得记录',
      value: hasChekiOnly ? 'has_cheki' : null,
      onChange: (value) => setHasChekiOnly(value === 'has_cheki'),
      options: [{ value: 'has_cheki', label: '有拍立得' }],
    },
    {
      key: 'event',
      title: '活动记录',
      value: eventFilter,
      onChange: (value) => setEventFilter(value === 'attended' ? 'attended' : null),
      options: [{ value: 'attended', label: '参加过活动' }],
    },
    {
      key: 'group',
      title: '所属团体',
      value: groupFilter,
      onChange: (value) => {
        setGroupFilter(value === 'has_parent' || value === 'no_parent' ? value : null);
      },
      options: [
        { value: 'has_parent', label: '有所属团体' },
        { value: 'no_parent', label: '无所属团体' },
      ],
    },
  ], [hasChekiOnly, eventFilter, groupFilter]);

  const clearFilter = useCallback(() => {
    setSearchQuery('');
    setFilter('all');
    setHasChekiOnly(false);
    setEventFilter(null);
    setGroupFilter(null);
  }, []);

  const activeSearchFilters = useMemo(() => {
    const filters: Array<{ id: string; label: string; onPress: () => void }> = [];
    if (hasChekiOnly) {
      filters.push({ id: 'cheki:has_cheki', label: '有拍立得', onPress: () => setHasChekiOnly(false) });
    }
    if (eventFilter === 'attended') {
      filters.push({ id: 'event:attended', label: '参加过活动', onPress: () => setEventFilter(null) });
    }
    if (groupFilter) {
      filters.push({
        id: `group:${groupFilter}`,
        label: groupFilter === 'has_parent' ? '有所属团体' : '无所属团体',
        onPress: () => setGroupFilter(null),
      });
    }
    return filters;
  }, [hasChekiOnly, eventFilter, groupFilter]);

  const handleToggleFavorite = async (artist: Artist) => {
    if (pendingFavoriteArtistId) return;
    if (artist.id === oshiArtistId && artist.is_favorite === 1) {
      Alert.alert('单推艺人已收藏', '单推艺人会保持收藏。若要更换或清除单推，请前往「我的 → 设置 → 单推设置」。');
      return;
    }
    setPendingFavoriteArtistId(artist.id);
    try {
      await db.artists.toggleFavorite(artist.id);
      setArtists((prev) =>
        prev.map((a) => a.id === artist.id ? { ...a, is_favorite: a.is_favorite ? 0 : 1 } : a)
      );
    } catch (error) {
      showOperationFailedAlert('无法更新收藏状态。', '请稍后再试一次。', error);
    } finally {
      setPendingFavoriteArtistId(null);
    }
  };

  const bg = colors.screen;
  const cardBg = colors.card;
  const textPrimary = colors.text;
  const borderColor = colors.divider;
  const hasAnyFilter = Boolean(
    searchQuery.trim() ||
    filter === 'favorites' ||
    activeSearchFilters.length > 0
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: '艺人管理',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.header },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.heading, fontWeight: '700' },
          headerRight: IS_IOS ? undefined : () => (
            <TouchableOpacity
              onPress={() => router.push('/artists/new')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ paddingRight: 4 }}
            >
              <AppIcon name="add" size={24} color={colors.accent} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: bg }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <SearchFilterBar
            keyword={searchQuery}
            onKeywordChange={setSearchQuery}
            placeholder="输入关键词搜索"
            onOpenFilter={() => setFilterVisible(true)}
            activeFilters={activeSearchFilters}
            activeCount={activeSearchFilters.length}
            isDark={isDark}
          />
          <View
            style={{
              flexDirection: 'row',
              padding: 3,
              marginBottom: 12,
              borderRadius: 12,
              backgroundColor: colors.cardAlt,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          >
            {([
              { value: 'all' as const, label: '全部艺人', icon: 'artists' as AppIconName },
              { value: 'favorites' as const, label: '收藏艺人', icon: 'favorite' as AppIconName },
            ]).map((option) => {
              const active = filter === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleFilterChange(option.value)}
                  activeOpacity={0.72}
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: 9,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: active ? colors.card : 'transparent',
                    shadowColor: active ? colors.shadow : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: active ? 0.08 : 0,
                    shadowRadius: 3,
                    elevation: active ? 1 : 0,
                  }}
                >
                  <AppIcon
                    name={option.icon}
                    size={15}
                    color={active ? colors.accent : colors.textMuted}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: active ? '700' : '600',
                      color: active ? colors.accent : colors.textSecondary,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {loadFailed ? (
            <View
              style={{
                marginBottom: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: colors.dangerSoft,
                borderWidth: 1,
                borderColor: colors.dangerBorder,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary }}>
                艺人数据加载失败
              </Text>
              <TouchableOpacity onPress={loadArtists} disabled={isLoading} hitSlop={8}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>重试</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={filteredArtists}
          keyExtractor={(a) => a.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              {isLoading ? (
                <>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={{ marginTop: 12, fontSize: 13, color: colors.textMuted }}>正在加载艺人…</Text>
                </>
              ) : loadFailed ? null : (
                hasAnyFilter ? (
                  <FilteredEmptyState
                    title="没有符合条件的艺人"
                    onClear={clearFilter}
                    isDark={isDark}
                    paddingTop={0}
                  />
                ) : (
                  <>
                    <AppIcon name="artist" size={28} color={colors.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#e5e7eb' : '#374151', marginBottom: 6 }}>
                      还没有艺人
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
                      点击右上角 + 添加常看的团体或成员。
                    </Text>
                  </>
                )
              )}
            </View>
          }
          renderItem={({ item: artist, index }) => {
            const isLast = index === filteredArtists.length - 1;
            const isFav = artist.is_favorite === 1;
            const avatarSrc = resolveAvatarSource(artist.avatar_uri);
            const isOshi = artist.id === oshiArtistId;
            const display = getArtistDisplayText({
              artist,
              parentName: artist.parent_id ? parentNameMap[artist.parent_id] : null,
              mode: 'management',
            });

            return (
              <TouchableOpacity
                onPress={() => router.push(`/artists/${artist.id}`)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: cardBg,
                  borderTopLeftRadius: index === 0 ? 18 : 0,
                  borderTopRightRadius: index === 0 ? 18 : 0,
                  borderBottomLeftRadius: isLast ? 18 : 0,
                  borderBottomRightRadius: isLast ? 18 : 0,
                  overflow: 'hidden',
                  shadowColor: index === 0 ? '#000' : undefined,
                  shadowOffset: index === 0 ? { width: 0, height: 2 } : undefined,
                  shadowOpacity: index === 0 ? 0.06 : 0,
                  shadowRadius: index === 0 ? 8 : 0,
                  elevation: index === 0 ? 2 : 0,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: isLast ? 0 : 1, borderBottomColor: borderColor }}>

                  {/* Avatar */}
                  <View style={{ marginRight: 12 }}>
                    <OshiAvatar source={avatarSrc} size={40} isOshi={isOshi} />
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: textPrimary }}
                      >
                        {display.title}
                      </Text>
                      {isOshi ? <OshiBadge /> : null}
                    </View>
                    {display.subtitle ? (
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
                        {display.subtitle}
                      </Text>
                    ) : null}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 16, marginLeft: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleToggleFavorite(artist)}
                      disabled={pendingFavoriteArtistId != null}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ opacity: pendingFavoriteArtistId && pendingFavoriteArtistId !== artist.id ? 0.45 : 1 }}
                    >
                      {pendingFavoriteArtistId === artist.id ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <AppIcon
                          name="favorite"
                          variant={isFav ? 'active' : 'inactive'}
                          size={20}
                          color={isFav ? colors.danger : colors.chevron}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
        <FilterSheet
          visible={filterVisible}
          sections={filterSections}
          isDark={isDark}
          onReset={clearFilter}
          onClose={() => setFilterVisible(false)}
        />
      </SafeAreaView>
      {IS_IOS ? (
        <NativeAddToolbar
          accessibilityLabel="新建艺人"
          onPress={() => router.push('/artists/new')}
        />
      ) : null}
    </>
  );
}

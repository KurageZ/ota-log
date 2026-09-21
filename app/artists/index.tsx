import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import SegmentedControl from '@expo/ui/community/segmented-control';
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
import { AppIcon } from '../../src/components/AppIcon';
import { NativeAddToolbar } from '../../src/components/native-add-toolbar';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { hapticError, hapticFavoriteToggle } from '../../src/utils/haptics';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toISODate } from '../../src/utils/date';
import {
  ArtistGroupFilter,
  matchesArtistGroupFilter,
} from '../../src/utils/artistManagementFilters';
import { useWindowMode } from '../../src/utils/windowMode';
import {
  MASTER_PANE_WIDTH,
  MasterDetailEmptyState,
  MasterPaneHeader,
} from '../../src/components/adaptive/MasterDetailLayout';
import { ArtistDetailScreen } from './[id]/index';

type FilterTab = 'all' | 'favorites';
type ArtistEventFilter = 'attended' | null;
type ArtistTypeFilter = 'person' | 'group' | 'unset' | null;
interface ArtistFilterDraft {
  hasChekiOnly: boolean;
  eventFilter: ArtistEventFilter;
  groupFilter: ArtistGroupFilter;
  typeFilter: ArtistTypeFilter;
}
const EMPTY_ARTIST_FILTERS: ArtistFilterDraft = {
  hasChekiOnly: false,
  eventFilter: null,
  groupFilter: null,
  typeFilter: null,
};
const IS_IOS = process.env.EXPO_OS === 'ios';
const ARTIST_TYPE_NOTICE_DISMISSED_KEY = 'artist_type_notice_dismissed_v1';

export default function ArtistsScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [hasChekiOnly, setHasChekiOnly] = useState(false);
  const [chekiArtistIds, setChekiArtistIds] = useState<Set<string>>(new Set());
  const [eventArtistIds, setEventArtistIds] = useState<Set<string>>(new Set());
  const [currentGroupLabels, setCurrentGroupLabels] = useState<Record<string, string>>({});
  const [eventFilter, setEventFilter] = useState<ArtistEventFilter>(null);
  const [groupFilter, setGroupFilter] = useState<ArtistGroupFilter>(null);
  const [typeFilter, setTypeFilter] = useState<ArtistTypeFilter>(null);
  const [showTypeNotice, setShowTypeNotice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterDraft, setFilterDraft] = useState<ArtistFilterDraft>(EMPTY_ARTIST_FILTERS);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [detailWidth, setDetailWidth] = useState<number | undefined>();
  const { isWide } = useWindowMode();

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
      if (!matchesArtistGroupFilter(
        artist,
        groupFilter,
        Boolean(currentGroupLabels[artist.id]),
      )) return false;
      if (typeFilter === 'person' && artist.artist_type !== 'person') return false;
      if (typeFilter === 'group' && artist.artist_type !== 'group') return false;
      if (typeFilter === 'unset' && artist.artist_type != null) return false;
      return true;
    });
  }, [artists, searchQuery, oshiArtistId, filter, hasChekiOnly, chekiArtistIds, eventFilter, eventArtistIds, groupFilter, typeFilter, currentGroupLabels]);

  useEffect(() => {
    void AsyncStorage.getItem(ARTIST_TYPE_NOTICE_DISMISSED_KEY).then((dismissed) => {
      setShowTypeNotice(dismissed !== 'true');
    });
  }, []);

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
      const groupSummaries = await db.artists.findCurrentGroupSummaries(toISODate(new Date()));
      const groupNames = new Map<string, string[]>();
      groupSummaries.forEach((summary) => {
        const names = groupNames.get(summary.person_artist_id) ?? [];
        names.push(summary.group_name);
        groupNames.set(summary.person_artist_id, names);
      });
      setArtists(data);
      setCurrentGroupLabels(Object.fromEntries(
        [...groupNames].map(([artistId, names]) => [
          artistId,
          names.length === 1 ? names[0] : `${names[0]} 等 ${names.length} 个`,
        ]),
      ));
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
      key: 'type',
      title: '艺人类型',
      value: filterDraft.typeFilter,
      onChange: (value) => setFilterDraft((draft) => ({ ...draft, typeFilter: value as ArtistTypeFilter })),
      options: [
        { value: 'person', label: '个人' },
        { value: 'group', label: '团体' },
        { value: 'unset', label: '未设置' },
      ],
    },
    {
      key: 'cheki',
      title: '拍立得记录',
      value: filterDraft.hasChekiOnly ? 'has_cheki' : null,
      onChange: (value) => setFilterDraft((draft) => ({ ...draft, hasChekiOnly: value === 'has_cheki' })),
      options: [{ value: 'has_cheki', label: '有拍立得' }],
    },
    {
      key: 'event',
      title: '活动记录',
      value: filterDraft.eventFilter,
      onChange: (value) => setFilterDraft((draft) => ({ ...draft, eventFilter: value as ArtistEventFilter })),
      options: [{ value: 'attended', label: '参加过活动' }],
    },
    {
      key: 'group',
      title: '所属团体',
      value: filterDraft.groupFilter,
      onChange: (value) => setFilterDraft((draft) => ({ ...draft, groupFilter: value as ArtistGroupFilter })),
      options: [
        { value: 'has_parent', label: '有所属团体' },
        { value: 'no_parent', label: '无所属团体' },
      ],
    },
  ], [filterDraft]);

  const clearFilter = useCallback(() => {
    setSearchQuery('');
    setFilter('all');
    setHasChekiOnly(false);
    setEventFilter(null);
    setGroupFilter(null);
    setTypeFilter(null);
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
    if (typeFilter) {
      filters.push({
        id: `type:${typeFilter}`,
        label: typeFilter === 'person' ? '个人' : typeFilter === 'group' ? '团体' : '未设置',
        onPress: () => setTypeFilter(null),
      });
    }
    return filters;
  }, [hasChekiOnly, eventFilter, groupFilter, typeFilter]);

  const handleToggleFavorite = async (artist: Artist) => {
    if (artist.id === oshiArtistId && artist.is_favorite === 1) {
      Alert.alert('单推艺人已收藏', '单推艺人会保持收藏。若要更换或清除单推，请前往「我的 → 设置 → 单推设置」。');
      return;
    }
    const nextFavorite = artist.is_favorite !== 1;
    hapticFavoriteToggle(nextFavorite);
    setArtists((prev) =>
      prev.map((a) => a.id === artist.id ? { ...a, is_favorite: nextFavorite ? 1 : 0 } : a)
    );
    try {
      await db.artists.toggleFavorite(artist.id);
    } catch (error) {
      hapticError();
      setArtists((prev) =>
        prev.map((a) => a.id === artist.id ? { ...a, is_favorite: nextFavorite ? 0 : 1 } : a)
      );
      showOperationFailedAlert('无法更新收藏状态。', '请稍后再试一次。', error);
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

  useEffect(() => {
    if (!isWide) return;
    if (selectedArtistId && artists.some((artist) => artist.id === selectedArtistId)) return;
    setSelectedArtistId(filteredArtists[0]?.id ?? null);
  }, [artists, filteredArtists, isWide, selectedArtistId]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '艺人管理',
          headerShown: !isWide,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.header },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.heading, fontWeight: '700' },
          headerRight: IS_IOS || isWide ? undefined : () => (
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
        <View style={{ flex: 1, flexDirection: isWide ? 'row' : 'column' }}>
          <View
            style={isWide ? {
              width: MASTER_PANE_WIDTH,
              flexShrink: 0,
              borderRightWidth: 1,
              borderRightColor: colors.divider,
            } : { flex: 1 }}
          >
          {isWide ? (
            <MasterPaneHeader
              title="艺人管理"
              actionLabel="新建艺人"
              onAction={() => router.push('/artists/new')}
              colors={colors}
            />
          ) : null}
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {showTypeNotice && artists.some((artist) => artist.artist_type == null) ? (
            <View style={{
              marginBottom: 12, padding: 14, borderRadius: 14,
              backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>艺人类型是可选的高级功能</Text>
                  <Text style={{ marginTop: 5, color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                    设置个人或团体后，可记录多团体履历，并按在团时间关联活动统计。不需要时可以保持未设置。
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/settings/artist-type-conversion')} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>批量设置类型</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  accessibilityLabel="关闭艺人类型说明"
                  onPress={() => {
                    setShowTypeNotice(false);
                    void AsyncStorage.setItem(ARTIST_TYPE_NOTICE_DISMISSED_KEY, 'true');
                  }}
                  hitSlop={8}
                >
                  <AppIcon name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          <SearchFilterBar
            keyword={searchQuery}
            onKeywordChange={setSearchQuery}
            placeholder="输入关键词搜索"
            onOpenFilter={() => {
              setFilterDraft({ hasChekiOnly, eventFilter, groupFilter, typeFilter });
              setFilterVisible(true);
            }}
            activeFilters={activeSearchFilters}
            activeCount={activeSearchFilters.length}
            isDark={isDark}
          />
          <View style={{ marginBottom: 12 }}>
            <SegmentedControl
              values={['全部艺人', '收藏艺人']}
              selectedIndex={filter === 'favorites' ? 1 : 0}
              appearance={isDark ? 'dark' : 'light'}
              onChange={({ nativeEvent }) => {
                handleFilterChange(nativeEvent.selectedSegmentIndex === 1 ? 'favorites' : 'all');
              }}
              style={{ height: 60 }}
            />
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
              parentName: currentGroupLabels[artist.id]
                ?? (artist.parent_id ? parentNameMap[artist.parent_id] : null),
              mode: 'management',
            });

            return (
              <TouchableOpacity
                onPress={() => {
                  if (isWide) setSelectedArtistId(artist.id);
                  else router.push(`/artists/${artist.id}`);
                }}
                activeOpacity={0.7}
                accessibilityState={{ selected: isWide && selectedArtistId === artist.id }}
                style={{
                  backgroundColor: isWide && selectedArtistId === artist.id ? colors.accentSoft : cardBg,
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
                    <OshiAvatar source={avatarSrc} size={40} isOshi={isOshi} name={display.title} />
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
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <AppIcon
                        name="favorite"
                        variant={isFav ? 'active' : 'inactive'}
                        size={20}
                        color={isFav ? colors.danger : colors.chevron}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
          </View>
          {isWide ? (
            <View
              style={{ flex: 1, minWidth: 0 }}
              onLayout={(event) => setDetailWidth(event.nativeEvent.layout.width)}
            >
              {selectedArtistId ? (
                <ArtistDetailScreen
                  key={selectedArtistId}
                  artistId={selectedArtistId}
                  embedded
                  availableWidth={detailWidth}
                />
              ) : (
                <MasterDetailEmptyState
                  icon={<AppIcon name="artist" size={34} color={colors.textMuted} />}
                  title="选择一位艺人"
                  message="从左侧列表选择艺人后，可在这里查看和编辑详情。"
                  colors={colors}
                />
              )}
            </View>
          ) : null}
        </View>
        <FilterSheet
          visible={filterVisible}
          sections={filterSections}
          isDark={isDark}
          onReset={() => setFilterDraft(EMPTY_ARTIST_FILTERS)}
          onClose={() => setFilterVisible(false)}
          onApply={() => {
            setHasChekiOnly(filterDraft.hasChekiOnly);
            setEventFilter(filterDraft.eventFilter);
            setGroupFilter(filterDraft.groupFilter);
            setTypeFilter(filterDraft.typeFilter);
            setFilterVisible(false);
          }}
        />
      </SafeAreaView>
      {IS_IOS && !isWide ? (
        <NativeAddToolbar
          accessibilityLabel="新建艺人"
          onPress={() => router.push('/artists/new')}
        />
      ) : null}
    </>
  );
}

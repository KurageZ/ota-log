import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { Sortable, SortableItem, type SortableRenderItemProps } from 'react-native-reanimated-dnd';
import { useDB } from '../../src/context/DBContext';
import { Artist, UserConfig } from '../../src/types/models';
import { ThemeColors, useAppTheme } from '../../src/theme/appTheme';
import { ArtistSearchPicker } from '../../src/components/ArtistSearchPicker';
import { AppIcon, type AppIconName } from '../../src/components/AppIcon';
import { BottomSheetDialog } from '../../src/components/BottomSheetDialog';
import { SectionLabel } from '../../src/components/SettingsMenu';
import type { HydratedDateItem } from '../../src/repositories/DateItemRepository';
import { getArtistDisplayText, getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { toISODate } from '../../src/utils/date';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import {
  DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT,
  HOME_CARD_LABELS,
  HOME_PINNED_INFO_LABELS,
  HomeCardConfig,
  HomePinnedInfoConfig,
  HomePinnedInfoType,
  MAX_FEATURED_ARTISTS_PER_HOME_CARD,
  MAX_RECENT_COMPLETED_DISPLAY_LIMIT,
  MIN_RECENT_COMPLETED_DISPLAY_LIMIT,
  RECENT_COMPLETED_DISPLAY_ALL,
  createDefaultHomeCards,
  createDefaultHomePinnedInfo,
  getHomeCardKey,
  loadHomePreferences,
  saveHomePreferences,
  sanitizeRecentCompletedDisplayLimit,
  sanitizeHomeCards,
  sanitizeHomePinnedInfo,
} from '../../src/utils/homePreferences';

const HOME_CARD_ROW_MIN_HEIGHT = 72;
const HOME_CARD_SORTABLE_ITEM_HEIGHT = 82;
const HOME_CARD_DISABLED_DIVIDER_ID = 'home-card-disabled-divider';
const PINNED_INFO_OPTIONS: Array<{
  type: HomePinnedInfoType;
  icon: AppIconName;
  description: string;
}> = [
  { type: 'nextEvent', icon: 'calendar', description: '下一场计划和倒计时' },
  { type: 'featuredArtist', icon: 'favorite', description: '一位艺人的活动摘要' },
  { type: 'monthSummary', icon: 'stats', description: '本月完成、计划和拍立得' },
];

type HomeCardSection = 'enabled' | 'disabled';
type ArtistSelectorMode = 'featuredCard' | 'pinnedInfo';
type HomeSettingsSortableItem =
  | { id: string; kind: 'card'; card: HomeCardConfig }
  | { id: typeof HOME_CARD_DISABLED_DIVIDER_ID; kind: 'disabledDivider'; disabledCount: number };

function isToggleableCard(card: HomeCardConfig): card is Extract<HomeCardConfig, { visible: boolean }> {
  return card.type === 'futureActivity'
    || card.type === 'featuredArtist'
    || card.type === 'recentCompleted'
    || card.type === 'monthOverview'
    || card.type === 'chekiOverview'
    || card.type === 'importantDates';
}

export default function HomeSettingsScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const [pinnedInfo, setPinnedInfo] = useState<HomePinnedInfoConfig>(() => createDefaultHomePinnedInfo());
  const [cards, setCards] = useState<HomeCardConfig[]>([]);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [allDateItems, setAllDateItems] = useState<HydratedDateItem[]>([]);
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [artistSelectorMode, setArtistSelectorMode] = useState<ArtistSelectorMode | null>(null);
  const [isDateItemSelectorVisible, setIsDateItemSelectorVisible] = useState(false);
  const [isRecentEditorVisible, setIsRecentEditorVisible] = useState(false);
  const [recentLimitInput, setRecentLimitInput] = useState(String(DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT));
  const [recentLimitAll, setRecentLimitAll] = useState(false);
  const [artistSearch, setArtistSearch] = useState('');
  const [dateItemSearch, setDateItemSearch] = useState('');
  const sortableItemsRef = useRef<HomeSettingsSortableItem[]>([]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [config, artists, dateItems] = await Promise.all([
        db.userConfig.getConfig(),
        db.artists.findAll(),
        db.dateItems.findAll(toISODate(new Date())),
      ]);
      const validArtistIds = new Set(artists.map((artist) => artist.id));
      const validDateItemIds = new Set(dateItems.map((item) => item.item.id));
      const preferences = await loadHomePreferences({
        oshiArtistId: config.oshi_artist_id,
        validArtistIds,
        validDateItemIds,
      });

      setUserConfig(config);
      setAllArtists(artists);
      setAllDateItems(dateItems);
      setPinnedInfo(preferences.pinnedInfo);
      const groupedCards = groupCardsForSections(preferences.cards);
      setCards(groupedCards);
    } catch (error) {
      showOperationFailedAlert(
        '无法读取首页设置。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再打开。',
        error,
      );
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const artistMap = useMemo(
    () => new Map(allArtists.map((artist) => [artist.id, artist])),
    [allArtists],
  );
  const selectedArtistIds = useMemo(
    () => new Set(cards.find((card) => card.type === 'featuredArtist')?.artistIds ?? []),
    [cards],
  );
  const selectedDateItemIds = useMemo(
    () => new Set(cards.find((card) => card.type === 'importantDates')?.dateItemIds ?? []),
    [cards],
  );
  const featuredArtistOrder = useMemo(
    () => cards.find((card) => card.type === 'featuredArtist')?.artistIds ?? [],
    [cards],
  );
  const selectedFeaturedArtists = useMemo(
    () => featuredArtistOrder
      .map((artistId) => artistMap.get(artistId))
      .filter((artist): artist is Artist => Boolean(artist)),
    [artistMap, featuredArtistOrder],
  );
  const selectedPinnedArtist = useMemo(() => {
    if (pinnedInfo.type !== 'featuredArtist' || !pinnedInfo.artistId) return null;
    return artistMap.get(pinnedInfo.artistId) ?? null;
  }, [artistMap, pinnedInfo]);
  const pinnedArtistIds = useMemo(
    () => new Set(pinnedInfo.type === 'featuredArtist' && pinnedInfo.artistId ? [pinnedInfo.artistId] : []),
    [pinnedInfo],
  );
  const selectedDateItems = useMemo(() => {
    const dateItemMap = new Map(allDateItems.map((item) => [item.item.id, item]));
    return [...selectedDateItemIds]
      .map((dateItemId) => dateItemMap.get(dateItemId))
      .filter((item): item is HydratedDateItem => Boolean(item));
  }, [allDateItems, selectedDateItemIds]);
  const filteredDateItems = useMemo(() => {
    const query = dateItemSearch.trim().toLowerCase();
    if (!query) return allDateItems;
    return allDateItems.filter((item) => {
      const haystack = [
        item.item.title,
        item.item.date,
        item.relativeText,
        ...item.artists.map(getArtistPrimaryName),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [allDateItems, dateItemSearch]);
  const enabledCards = useMemo(() => cards.filter(isCardEnabledForSettings), [cards]);
  const disabledCards = useMemo(() => cards.filter((card) => canToggleCardVisibility(card) && !isCardEnabledForSettings(card)), [cards]);
  const sortableItems = useMemo<HomeSettingsSortableItem[]>(() => [
    ...enabledCards.map((card) => toSortableCardItem(card)),
    { id: HOME_CARD_DISABLED_DIVIDER_ID, kind: 'disabledDivider', disabledCount: disabledCards.length },
    ...disabledCards.map((card) => toSortableCardItem(card)),
  ], [disabledCards, enabledCards]);
  const sortableHeight = Math.max(HOME_CARD_SORTABLE_ITEM_HEIGHT, sortableItems.length * HOME_CARD_SORTABLE_ITEM_HEIGHT);
  const isArtistSelectorVisible = artistSelectorMode !== null;
  const isPinnedArtistSelector = artistSelectorMode === 'pinnedInfo';
  const modalSelectedArtistIds = isPinnedArtistSelector ? pinnedArtistIds : selectedArtistIds;
  const modalSelectedArtists = isPinnedArtistSelector
    ? (selectedPinnedArtist ? [selectedPinnedArtist] : [])
    : selectedFeaturedArtists;

  useEffect(() => {
    sortableItemsRef.current = sortableItems;
  }, [sortableItems]);

  const persistPreferences = useCallback(async (nextPinnedInfo: HomePinnedInfoConfig, nextCards: HomeCardConfig[]) => {
    const validArtistIds = new Set(allArtists.map((artist) => artist.id));
    const validDateItemIds = new Set(allDateItems.map((item) => item.item.id));
    const sanitizedPinnedInfo = sanitizeHomePinnedInfo(nextPinnedInfo, { validArtistIds });
    const sanitized = groupCardsForSections(sanitizeHomeCards(nextCards, { validArtistIds, validDateItemIds }));
    setPinnedInfo(sanitizedPinnedInfo);
    setCards(sanitized);
    try {
      await saveHomePreferences({
        pinnedInfo: sanitizedPinnedInfo,
        cards: sanitized,
      });
    } catch (error) {
      showOperationFailedAlert(
        '无法保存首页设置。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再调整。',
        error,
      );
    }
  }, [allArtists, allDateItems]);

  const persistCards = useCallback(async (nextCards: HomeCardConfig[]) => {
    await persistPreferences(pinnedInfo, nextCards);
  }, [persistPreferences, pinnedInfo]);

  const persistPinnedInfo = useCallback(async (nextPinnedInfo: HomePinnedInfoConfig) => {
    await persistPreferences(nextPinnedInfo, cards);
  }, [cards, persistPreferences]);

  const handleDragStart = useCallback(() => {
    Vibration.vibrate(50);
  }, []);

  const handleSortableDrop = useCallback((id: string, _position: number, allPositions?: Record<string, number>) => {
    if (id === HOME_CARD_DISABLED_DIVIDER_ID || !allPositions) return;

    const currentItems = sortableItemsRef.current;
    const getPosition = (item: HomeSettingsSortableItem) => (
      allPositions[item.id] ?? currentItems.findIndex((currentItem) => currentItem.id === item.id)
    );
    const sortedItems = [...currentItems].sort((a, b) => getPosition(a) - getPosition(b));
    const dividerIndex = sortedItems.findIndex((item) => item.kind === 'disabledDivider');
    if (dividerIndex < 0) return;

    const nextCards = sortedItems.flatMap((item, index) => {
      if (item.kind !== 'card') return [];
      const section: HomeCardSection = index < dividerIndex ? 'enabled' : 'disabled';
      return [setCardSection(item.card, section)];
    });

    void persistCards(nextCards);
  }, [persistCards]);

  const openArtistSelector = useCallback(() => {
    setArtistSearch('');
    setArtistSelectorMode('featuredCard');
  }, []);

  const openDateItemSelector = useCallback(() => {
    setDateItemSearch('');
    setIsDateItemSelectorVisible(true);
  }, []);

  const openPinnedArtistSelector = useCallback(() => {
    setArtistSearch('');
    setArtistSelectorMode('pinnedInfo');
  }, []);

  const closeArtistSelector = useCallback(() => {
    setArtistSelectorMode(null);
    setArtistSearch('');
  }, []);

  const closeDateItemSelector = useCallback(() => {
    setIsDateItemSelectorVisible(false);
    setDateItemSearch('');
  }, []);

  const openRecentCompletedEditor = useCallback((card: Extract<HomeCardConfig, { type: 'recentCompleted' }>) => {
    const isAll = card.displayLimit === RECENT_COMPLETED_DISPLAY_ALL;
    setRecentLimitAll(isAll);
    setRecentLimitInput(isAll ? String(DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT) : String(card.displayLimit));
    setIsRecentEditorVisible(true);
  }, []);

  const closeRecentCompletedEditor = useCallback(() => {
    setIsRecentEditorVisible(false);
  }, []);

  const handleSaveRecentCompletedLimit = useCallback(() => {
    const nextDisplayLimit = recentLimitAll
      ? RECENT_COMPLETED_DISPLAY_ALL
      : sanitizeRecentCompletedDisplayLimit(recentLimitInput);

    const nextCards: HomeCardConfig[] = cards.map((card) => (
      card.type === 'recentCompleted'
        ? { ...card, displayLimit: nextDisplayLimit }
        : card
    ));
    void persistCards(nextCards);
    closeRecentCompletedEditor();
  }, [cards, closeRecentCompletedEditor, persistCards, recentLimitAll, recentLimitInput]);

  const handleToggleFeaturedArtist = useCallback((artist: Artist) => {
    const featuredCard = cards.find((card) => card.type === 'featuredArtist');
    if (!featuredCard) return;

    const nextArtistIds = selectedArtistIds.has(artist.id)
      ? featuredCard.artistIds.filter((artistId) => artistId !== artist.id)
      : [...featuredCard.artistIds, artist.id];

    if (nextArtistIds.length > MAX_FEATURED_ARTISTS_PER_HOME_CARD) {
      Alert.alert('数量已达上限', `一个关注艺人卡片最多选择 ${MAX_FEATURED_ARTISTS_PER_HOME_CARD} 位艺人。`);
      return;
    }

    const nextCards: HomeCardConfig[] = cards.map((card) => (
      card.type === 'featuredArtist'
        ? { ...card, artistIds: nextArtistIds }
        : card
    ));
    void persistCards(nextCards);
  }, [cards, persistCards, selectedArtistIds]);

  const handleToggleImportantDate = useCallback((item: HydratedDateItem) => {
    const importantDatesCard = cards.find((card) => card.type === 'importantDates');
    if (!importantDatesCard) return;

    const nextDateItemIds = selectedDateItemIds.has(item.item.id)
      ? importantDatesCard.dateItemIds.filter((dateItemId) => dateItemId !== item.item.id)
      : [...importantDatesCard.dateItemIds, item.item.id];

    const nextCards: HomeCardConfig[] = cards.map((card) => (
      card.type === 'importantDates'
        ? { ...card, dateItemIds: nextDateItemIds }
        : card
    ));
    void persistCards(nextCards);
  }, [cards, persistCards, selectedDateItemIds]);

  const handleSelectPinnedArtist = useCallback((artist: Artist) => {
    void persistPinnedInfo({ type: 'featuredArtist', artistId: artist.id });
    closeArtistSelector();
  }, [closeArtistSelector, persistPinnedInfo]);

  const handleRemovePinnedArtist = useCallback(() => {
    void persistPinnedInfo({ type: 'featuredArtist', artistId: null });
  }, [persistPinnedInfo]);

  const handleSelectPinnedInfoType = useCallback((type: HomePinnedInfoType) => {
    if (type === 'featuredArtist') {
      void persistPinnedInfo({
        type: 'featuredArtist',
        artistId: pinnedInfo.type === 'featuredArtist' ? pinnedInfo.artistId : null,
      });
      openPinnedArtistSelector();
      return;
    }

    void persistPinnedInfo({ type });
  }, [openPinnedArtistSelector, persistPinnedInfo, pinnedInfo]);

  const handleReset = useCallback(() => {
    Alert.alert('恢复默认', '置顶信息会恢复为下一场活动，功能卡片恢复默认顺序，并只启用未来活动、最近完成和拍立得。确认继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复',
        onPress: () => {
          void persistPreferences(createDefaultHomePinnedInfo(), createDefaultHomeCards(userConfig?.oshi_artist_id));
        },
      },
    ]);
  }, [persistPreferences, userConfig?.oshi_artist_id]);

  const renderPinnedInfoSection = useCallback(() => (
    <View style={{ marginBottom: 18 }}>
      <SectionLabel label="置顶信息" />
      <Text style={{ marginTop: -4, marginBottom: 10, paddingLeft: 11, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.textMuted }}>
        选择首页顶部优先展示的内容。
      </Text>
      <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card }}>
        {PINNED_INFO_OPTIONS.map((option, index) => {
          const selected = pinnedInfo.type === option.type;
          const tint = selected ? getPinnedInfoTint(option.type, colors) : colors.textMuted;
          const pinnedArtistTitle = option.type === 'featuredArtist' && selectedPinnedArtist
            ? getArtistDisplayText({
              artist: selectedPinnedArtist,
              parentName: selectedPinnedArtist.parent_id ? artistNameMap[selectedPinnedArtist.parent_id] : null,
            }).title
            : null;
          const description = option.type === 'featuredArtist' && selected
            ? (pinnedArtistTitle ?? '选择一位艺人')
            : option.description;
          return (
            <TouchableOpacity
              key={option.type}
              activeOpacity={0.68}
              onPress={() => handleSelectPinnedInfoType(option.type)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 64,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.divider,
                backgroundColor: selected ? colors.accentPress : colors.card,
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: selected ? `${tint}22` : colors.cardMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <AppIcon name={option.icon} size={18} color={tint} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 19, fontWeight: '700', color: selected ? colors.accent : colors.text }}>
                  {HOME_PINNED_INFO_LABELS[option.type]}
                </Text>
                <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, lineHeight: 15, fontWeight: '500', color: colors.textSecondary }}>
                  {description}
                </Text>
              </View>
              {option.type === 'featuredArtist' && selected ? (
                <View
                  style={{
                    marginLeft: 10,
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.accentSoft,
                  }}
                >
                  <AppIcon name="edit" size={17} color={colors.accent} />
                </View>
              ) : null}
              <View style={{ width: 30, alignItems: 'flex-end' }}>
                <AppIcon
                  name="radio"
                  variant={selected ? 'selected' : 'unselected'}
                  size={18}
                  color={selected ? colors.accent : colors.textMuted}
                  secondaryColor={colors.onAccent}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  ), [
    artistNameMap,
    colors,
    handleSelectPinnedInfoType,
    openPinnedArtistSelector,
    pinnedInfo,
    selectedPinnedArtist,
  ]);

  const renderCardRow = useCallback((card: HomeCardConfig) => {
    const isEnabled = isCardEnabledForSettings(card);
    const title = card.type === 'featuredArtist' ? HOME_CARD_LABELS.featuredArtist : HOME_CARD_LABELS[card.type];
    const icon = getCardIcon(card);
    const tint = isEnabled ? getCardTint(card, colors) : colors.textMuted;
    const subtitle = getCardSubtitle(card, artistMap, artistNameMap);
    const cardBackground = isEnabled ? colors.card : colors.cardAlt;
    const titleColor = isEnabled ? colors.text : colors.textMuted;
    const subtitleColor = isEnabled ? colors.textSecondary : colors.textMuted;
    const controlBackground = isEnabled ? colors.accentSoft : colors.cardMuted;
    const controlColor = isEnabled ? colors.accent : colors.textMuted;
    const dragHandle = (
      <SortableItem.Handle>
        <View
          style={{
            width: 36,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppIcon name="menuDrag" size={24} color={colors.textMuted} />
        </View>
      </SortableItem.Handle>
    );
    const canEdit = card.type === 'featuredArtist' || card.type === 'recentCompleted' || card.type === 'importantDates';

    return (
      <View
        style={{
          minHeight: HOME_CARD_ROW_MIN_HEIGHT,
          borderRadius: 16,
          backgroundColor: cardBackground,
          borderWidth: 1,
          borderColor: colors.divider,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: HOME_CARD_ROW_MIN_HEIGHT, paddingLeft: 14, paddingRight: 8, paddingVertical: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: isEnabled ? `${tint}22` : colors.cardMuted,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <AppIcon name={icon} size={18} color={tint} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 19, fontWeight: '700', color: titleColor }}>
              {title}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, lineHeight: 15, fontWeight: '500', color: subtitleColor }}>
              {subtitle}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8 }}>
            {canEdit ? (
              <TouchableOpacity
                activeOpacity={0.65}
                onPress={() => {
                  if (card.type === 'featuredArtist') openArtistSelector();
                  if (card.type === 'recentCompleted') openRecentCompletedEditor(card);
                  if (card.type === 'importantDates') openDateItemSelector();
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: controlBackground,
                }}
              >
                <AppIcon name="edit" size={17} color={controlColor} />
              </TouchableOpacity>
            ) : null}
            {dragHandle}
          </View>
        </View>
      </View>
    );
  }, [
    artistMap,
    artistNameMap,
    colors,
    openArtistSelector,
    openDateItemSelector,
    openRecentCompletedEditor,
  ]);

  const renderSortableItem = useCallback((props: SortableRenderItemProps<HomeSettingsSortableItem>) => {
    const { item, id, ...sortableProps } = props;

    if (item.kind === 'disabledDivider') {
      return (
        <SortableItem
          key={id}
          id={id}
          data={item}
          {...sortableProps}
          style={{
            height: HOME_CARD_SORTABLE_ITEM_HEIGHT,
            justifyContent: item.disabledCount === 0 ? 'center' : 'flex-end',
            paddingBottom: 10,
          }}
        >
          <SortableItem.Handle style={{ width: 0, height: 0, opacity: 0 }}>
            <View />
          </SortableItem.Handle>
          <SectionLabel label="未启用" />
          {item.disabledCount === 0 ? (
            <Text style={{ paddingLeft: 2, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textMuted }}>
              拖拽到这里隐藏卡片
            </Text>
          ) : null}
        </SortableItem>
      );
    }

    return (
      <SortableItem
        key={id}
        id={id}
        data={item}
        {...sortableProps}
        onDragStart={handleDragStart}
        onDrop={handleSortableDrop}
        style={{ paddingBottom: 10 }}
      >
        {renderCardRow(item.card)}
      </SortableItem>
    );
  }, [colors.textMuted, handleDragStart, handleSortableDrop, renderCardRow]);

  const renderResetAction = useCallback(() => (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={handleReset}
      style={{
        minWidth: 52,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        backgroundColor: colors.accentSoft,
      }}
      accessibilityLabel="恢复默认首页设置"
    >
      <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.accent }}>
        重置
      </Text>
    </TouchableOpacity>
  ), [colors.accent, colors.accentSoft, handleReset]);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ headerRight: renderResetAction }} />
      {isLoading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.screen }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {renderPinnedInfoSection()}
          <SectionLabel label="已启用" />
          <Sortable
            data={sortableItems}
            renderItem={renderSortableItem}
            itemHeight={HOME_CARD_SORTABLE_ITEM_HEIGHT}
            itemKeyExtractor={(item) => item.id}
            style={{ height: sortableHeight, backgroundColor: colors.screen }}
            contentContainerStyle={{ paddingBottom: 0 }}
            useFlatList={false}
          />
        </ScrollView>
      )}

      <BottomSheetDialog
        visible={isArtistSelectorVisible}
        title={isPinnedArtistSelector ? '选择置顶艺人' : '选择关注艺人'}
        onClose={closeArtistSelector}
        snapPoints={['72%']}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flex: 1 }}
        headerAccessory={!isPinnedArtistSelector ? (
          <View
            style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.accentSoft }}
          >
            <Text style={{ fontSize: 12, lineHeight: 15, fontWeight: '800', color: colors.accent }}>
              {selectedArtistIds.size}/{MAX_FEATURED_ARTISTS_PER_HOME_CARD}
            </Text>
          </View>
        ) : undefined}
      >
        <ArtistSearchPicker
          artists={allArtists}
          selectedArtists={modalSelectedArtists}
          selectedIds={modalSelectedArtistIds}
          oshiArtistId={userConfig?.oshi_artist_id}
          isDark={isDark}
          searchValue={artistSearch}
          onSearchChange={setArtistSearch}
          placeholder="搜索艺人"
          maxHeight={220}
          selectedLabel={isPinnedArtistSelector ? '已选置顶艺人' : '已选关注艺人'}
          maxVisibleSelected={isPinnedArtistSelector ? 1 : MAX_FEATURED_ARTISTS_PER_HOME_CARD}
          onSelectArtist={isPinnedArtistSelector ? handleSelectPinnedArtist : handleToggleFeaturedArtist}
          onRemoveArtist={isPinnedArtistSelector ? handleRemovePinnedArtist : handleToggleFeaturedArtist}
          parentNameMap={artistNameMap}
          emptyText="没有找到艺人"
          idleEmptyText={isPinnedArtistSelector ? '搜索艺人设为置顶' : '搜索艺人添加到关注'}
          inputVariant="bottomSheet"
        />
      </BottomSheetDialog>

      <BottomSheetDialog
        visible={isDateItemSelectorVisible}
        title="选择重要日期"
        onClose={closeDateItemSelector}
        snapPoints={['72%']}
        scrollable
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
        headerAccessory={(
          <View
            style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.accentSoft }}
          >
            <Text style={{ fontSize: 12, lineHeight: 15, fontWeight: '800', color: colors.accent }}>
              {selectedDateItems.length}
            </Text>
          </View>
        )}
      >
        <BottomSheetTextInput
          value={dateItemSearch}
          onChangeText={setDateItemSearch}
          placeholder="搜索重要日期"
          placeholderTextColor={colors.placeholder}
          style={{
            height: 42,
            borderRadius: 13,
            paddingHorizontal: 13,
            marginBottom: 12,
            backgroundColor: isDark ? colors.input : colors.card,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            color: colors.text,
            fontSize: 14,
          }}
        />

        {allDateItems.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 34 }}>
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name="dateItem" size={22} color={colors.accent} />
            </View>
            <Text style={{ marginTop: 12, fontSize: 15, lineHeight: 19, fontWeight: '800', color: colors.heading }}>
              暂无重要日期
            </Text>
            <Text style={{ marginTop: 5, fontSize: 12.5, lineHeight: 18, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>
              新建重要日期后，就可以把它们固定到首页卡片。
            </Text>
          </View>
        ) : (
          <>
            {filteredDateItems.map((item, index) => {
              const selected = selectedDateItemIds.has(item.item.id);
              return (
                <TouchableOpacity
                  key={item.item.id}
                  activeOpacity={0.68}
                  onPress={() => handleToggleImportantDate(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 58,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.divider,
                    backgroundColor: selected ? colors.accentPress : colors.card,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? colors.accentSoft : colors.cardMuted,
                      marginRight: 10,
                    }}
                  >
                    <AppIcon name="dateItem" size={17} color={selected ? colors.accent : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, lineHeight: 18, fontWeight: '800', color: selected ? colors.accent : colors.text }}>
                      {item.item.title}
                    </Text>
                    <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, lineHeight: 15, fontWeight: '500', color: colors.textSecondary }}>
                      {formatDateItemSelectorSubtitle(item)}
                    </Text>
                  </View>
                  <View style={{ width: 32, alignItems: 'flex-end', marginLeft: 8 }}>
                    <AppIcon
                      name="checkbox"
                      variant={selected ? 'selected' : 'unselected'}
                      size={20}
                      color={selected ? colors.accent : colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
            {filteredDateItems.length === 0 ? (
              <Text style={{ paddingVertical: 26, textAlign: 'center', fontSize: 13, lineHeight: 18, color: colors.textMuted }}>
                没有找到重要日期
              </Text>
            ) : null}
          </>
        )}
      </BottomSheetDialog>

      <BottomSheetDialog
        visible={isRecentEditorVisible}
        title="最近完成"
        onClose={closeRecentCompletedEditor}
        maxHeightRatio={0.48}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
      >
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setRecentLimitAll(false)}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 11,
              alignItems: 'center',
              backgroundColor: recentLimitAll ? colors.card : colors.accent,
              borderWidth: 1,
              borderColor: recentLimitAll ? colors.inputBorder : colors.accent,
            }}
          >
            <Text style={{ fontSize: 13, lineHeight: 17, fontWeight: '800', color: recentLimitAll ? colors.text : colors.onAccent }}>
              指定数量
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setRecentLimitAll(true)}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 11,
              alignItems: 'center',
              backgroundColor: recentLimitAll ? colors.accent : colors.card,
              borderWidth: 1,
              borderColor: recentLimitAll ? colors.accent : colors.inputBorder,
            }}
          >
            <Text style={{ fontSize: 13, lineHeight: 17, fontWeight: '800', color: recentLimitAll ? colors.onAccent : colors.text }}>
              全部
            </Text>
          </TouchableOpacity>
        </View>

        <BottomSheetTextInput
          value={recentLimitInput}
          onChangeText={(value) => {
            setRecentLimitAll(false);
            setRecentLimitInput(value.replace(/[^\d]/g, ''));
          }}
          editable={!recentLimitAll}
          keyboardType="number-pad"
          placeholder={`${MIN_RECENT_COMPLETED_DISPLAY_LIMIT}-${MAX_RECENT_COMPLETED_DISPLAY_LIMIT}`}
          placeholderTextColor={colors.placeholder}
          style={{
            height: 44,
            borderRadius: 12,
            paddingHorizontal: 13,
            marginBottom: 14,
            backgroundColor: recentLimitAll ? colors.cardAlt : (isDark ? colors.input : colors.card),
            borderWidth: 1,
            borderColor: colors.inputBorder,
            color: colors.text,
            fontSize: 14,
            opacity: recentLimitAll ? 0.62 : 1,
          }}
        />

        <TouchableOpacity
          activeOpacity={0.72}
          onPress={handleSaveRecentCompletedLimit}
          style={{
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
          }}
        >
          <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.onAccent }}>
            保存
          </Text>
        </TouchableOpacity>
      </BottomSheetDialog>
    </SafeAreaView>
  );
}

function getCardIcon(card: HomeCardConfig): AppIconName {
  if (card.type === 'futureActivity') return 'calendar';
  if (card.type === 'recentCompleted') return 'statusCompleted';
  if (card.type === 'monthOverview') return 'stats';
  if (card.type === 'chekiOverview') return 'cheki';
  if (card.type === 'importantDates') return 'dateItem';
  return 'favorite';
}

function getCardSubtitle(
  card: HomeCardConfig,
  artistMap: Map<string, Artist>,
  artistNameMap: Record<string, string>,
) {
  if (card.type === 'futureActivity') return card.visible ? '下一场和未来时间线' : '已隐藏';
  if (card.type === 'recentCompleted') {
    const limit = card.displayLimit === RECENT_COMPLETED_DISPLAY_ALL
      ? '全部活动'
      : `最近 ${card.displayLimit || DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT} 场活动`;
    return card.visible ? limit : `已隐藏，设置为${limit}`;
  }
  if (card.type === 'monthOverview') return card.visible ? '已完成、计划中、拍立得' : '已隐藏';
  if (card.type === 'chekiOverview') return card.visible ? '总数、本月新增、最近拍立得' : '已隐藏';
  if (card.type === 'importantDates') {
    const count = card.dateItemIds.length;
    if (count === 0) return card.visible ? '未选择重要日期' : '已隐藏，未选择重要日期';
    return card.visible ? `已选择 ${count} 个重要日期` : `已隐藏，已选择 ${count} 个重要日期`;
  }
  if (card.type !== 'featuredArtist') return '';

  if (card.artistIds.length === 0) {
    return card.visible ? '未选择艺人' : '已隐藏，未选择艺人';
  }

  const names = card.artistIds.map((artistId) => {
    const artist = artistMap.get(artistId);
    if (!artist) return null;
    return getArtistDisplayText({
      artist,
      parentName: artist.parent_id ? artistNameMap[artist.parent_id] : null,
    }).title;
  }).filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    return card.visible ? '未选择艺人' : '已隐藏，未选择艺人';
  }
  const preview = names.slice(0, 2).join('、');
  const hiddenPrefix = card.visible ? '' : '已隐藏，';
  return names.length > 2 ? `${hiddenPrefix}${preview} 等 ${names.length} 位` : `${hiddenPrefix}${preview}`;
}

function getCardTint(card: HomeCardConfig, colors: ThemeColors) {
  if (card.type === 'featuredArtist') return colors.oshiBadgeBg;
  if (card.type === 'chekiOverview') return colors.featureCheki;
  if (card.type === 'recentCompleted') return colors.success;
  if (card.type === 'futureActivity') return colors.featureEvents;
  if (card.type === 'importantDates') return colors.accent;
  return colors.accent;
}

function getPinnedInfoTint(type: HomePinnedInfoType, colors: ThemeColors) {
  if (type === 'featuredArtist') return colors.oshiBadgeBg;
  if (type === 'monthSummary') return colors.accent;
  return colors.featureEvents;
}

function toSortableCardItem(card: HomeCardConfig): HomeSettingsSortableItem {
  return { id: getHomeCardKey(card), kind: 'card', card };
}

function canToggleCardVisibility(card: HomeCardConfig): card is Extract<HomeCardConfig, { visible: boolean }> {
  return isToggleableCard(card);
}

function isCardEnabledForSettings(card: HomeCardConfig) {
  return canToggleCardVisibility(card) ? card.visible : false;
}

function setCardSection(card: HomeCardConfig, section: HomeCardSection): HomeCardConfig {
  if (!canToggleCardVisibility(card)) return card;
  return { ...card, visible: section === 'enabled' };
}

function groupCardsForSections(cards: HomeCardConfig[]) {
  const enabledCards = cards.filter(isCardEnabledForSettings);
  const disabledCards = cards.filter((card) => canToggleCardVisibility(card) && !isCardEnabledForSettings(card));
  return [...enabledCards, ...disabledCards];
}

function formatDateItemSelectorSubtitle(item: HydratedDateItem): string {
  const artistText = item.artists.map(getArtistPrimaryName).join(' / ');
  return [item.item.date, item.relativeText, artistText].filter(Boolean).join(' · ');
}

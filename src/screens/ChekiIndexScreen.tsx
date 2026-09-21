import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert, Image, useWindowDimensions, ScrollView, ActivityIndicator, Platform, type LayoutChangeEvent,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDB } from '../context/DBContext';
import { Artist, Cheki, Event } from '../types/models';
import { resolveAvatarSource } from '../utils/avatarSource';
import { getArtistDisplayText, getArtistPrimaryName } from '../utils/artistDisplay';
import { OshiAvatar, OshiBadge } from '../components/Oshi';
import { ChekiViewerModal } from '../components/ChekiViewerModal';
import type { ChekiViewerItem } from '../types/chekiViewer';
import type { FullscreenImageTransitionOrigin } from '../components/FullscreenImageViewer';
import {
  buildChekiViewerItems,
  ChekiArtistGroup,
  ChekiGridDensity,
  ChekiGridColumns,
  chunkChekiPhysicalRows,
  getChekiAlbumFrame, getChekiJustifiedRowHeight,
  groupChekiRecordsByArtist,
  sortChekisDesc,
} from '../utils/cheki';
import {
  CHEKI_BARE_THUMBNAIL_RADIUS,
  CHEKI_GRID_GAP,
  CHEKI_SQUARE_GRID_GAP,
  ChekiGridThumbnail,
  useChekiAlbumGridLayout,
} from '../components/ChekiAlbumThumbnail';
import { showDeleteFailedAlert } from '../utils/failureAlert';
import { useReducedMotionEnabled } from '../utils/useReducedMotionEnabled';
import {
  hapticDeleteSuccess,
  hapticError,
  hapticFavoriteToggle,
} from '../utils/haptics';
import { ThemeColors, useAppTheme } from '../theme/appTheme';
import { ChekiRecordListItem } from '../components/ChekiRecordListItem';
import { EventSectionHeader } from '../components/EventSectionHeader';
import type { ChekiBrowseItem, ChekiRecordWithItems } from '../repositories/ChekiRecordRepository';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../components/AndroidCollapsibleTabHeader';
import { SearchFilterBar } from '../components/SearchFilterBar';
import { BottomSheetDialog } from '../components/BottomSheetDialog';
import { FilterSheet, FilterSection, type FilterChipGroup, type FilterOption } from '../components/FilterSheet';
import { ChekiDatePicker, type ChekiDatePickerMode } from '../components/ChekiDatePicker';
import { DateFilterHeader } from '../components/DateFilterHeader';
import { FilterBatchChip } from '../components/FilterBatchChip';
import { FilteredEmptyState } from '../components/FilteredEmptyState';
import { AppIcon, getAppIconSFSymbol } from '../components/AppIcon';
import {
  ModeChoiceButtons,
  type ModeChoiceOption,
} from '../components/mode-choice-buttons';
import { getArtistSearchText } from '../utils/filter';
import { withAlpha } from '../utils/color';
import { measureImageTransitionOrigin } from '../utils/imageTransition';
import {
  ChekiSortOrder,
  ChekiBrowseMode,
  ChekiAlbumGrouping,
  ChekiViewPreferences,
  DEFAULT_CHEKI_VIEW_PREFERENCES,
  loadChekiViewPreferences,
  saveChekiViewPreferences,
} from '../utils/chekiViewPreferences';
import { useFloatingTabBarSpacing } from '../navigation/floatingTabBar';
import { useFloatingTabBarScroll } from '../navigation/FloatingTabBarVisibility';
import { CHEKI_SPECS, type ChekiSpec } from '../domain/chekiSpec';
import {
  EMPTY_CHEKI_ITEM_FILTERS,
  EMPTY_CHEKI_RECORD_FILTERS,
  cloneChekiItemFilters,
  cloneChekiRecordFilters,
  countChekiItemFilterCategories,
  countChekiRecordFilterCategories,
  matchesChekiItemFilters,
  type ChekiItemFilters,
  type ChekiRecordFilters,
} from '../utils/chekiFilters';
import { buildChekiDateSections, buildChekiMonthSections } from '../utils/chekiSections';
import { formatChineseDateWithWeekday } from '../utils/date';
import {
  buildChekiItemSearchIndex,
  buildChekiRecordSearchIndex,
  matchesChekiSearchIndex,
  tokenizeChekiSearchQuery,
} from '../utils/chekiSearch';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { toggleBatchSelection } from '../utils/filterSelection';
import {
  buildChekiDeepLinkState,
  createClearedChekiDeepLinkParams,
  getChekiDeepLinkSignature,
  type ChekiFilterRouteParams,
} from '../utils/chekiDeepLink';

type ChekiGalleryItem =
  | { type: 'record'; key: string; record: ChekiRecordWithItems }
  | { type: 'recordSectionHeader'; key: string; title: string; count: number }
  | { type: 'header'; key: string; groupKey: string; group: ChekiArtistGroup }
  | { type: 'dateHeader'; key: string; title: string; count: number }
  | { type: 'row'; key: string; groupKey: string; chekis: Cheki[]; viewerChekis: Cheki[]; isLastPhotoRow: boolean };

function ChekiThumbnailButton({
  cheki,
  viewerChekis,
  width,
  height,
  colors,
  onOpen,
  displayMode,
}: {
  cheki: Cheki;
  viewerChekis: Cheki[];
  width: number;
  height: number;
  colors: ThemeColors;
  onOpen: (cheki: Cheki, chekis: Cheki[], origin: FullscreenImageTransitionOrigin | null) => void;
  displayMode: 'portrait' | 'original';
}) {
  const thumbnailRef = useRef<View>(null);
  const thumbnailImageRef = useRef<Image>(null);
  const cancelPendingMeasurementRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    cancelPendingMeasurementRef.current?.();
  }, []);

  const handlePress = useCallback(() => {
    cancelPendingMeasurementRef.current?.();
    const node = thumbnailImageRef.current ?? thumbnailRef.current;
    if (!node) {
      onOpen(cheki, viewerChekis, null);
      return;
    }

    cancelPendingMeasurementRef.current = measureImageTransitionOrigin(
      node,
      CHEKI_BARE_THUMBNAIL_RADIUS,
      (origin) => {
        cancelPendingMeasurementRef.current = null;
        onOpen(cheki, viewerChekis, origin);
      },
    );
  }, [cheki, onOpen, viewerChekis]);

  return (
    <View ref={thumbnailRef} collapsable={false}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <ChekiGridThumbnail
          uri={cheki.photo_uri}
          width={width}
          height={height}
          colors={colors}
          imageRef={thumbnailImageRef}
          variant={displayMode}
          spec={cheki.spec}
        />
      </TouchableOpacity>
    </View>
  );
}

function buildArtistGridItems(groups: ChekiArtistGroup[], columns: ChekiGridColumns, displayMode: 'portrait' | 'original', itemWidth: number, chekiTidyMode: boolean, chekiFillGaps: boolean): ChekiGalleryItem[] {
  const items: ChekiGalleryItem[] = [];
  for (const group of groups) {
    const groupKey = group.artist?.id ?? '__null__';
    items.push({ type: 'header', key: `${groupKey}:header`, groupKey, group });

    const photoRows = chunkChekiPhysicalRows(group.chekis, columns, displayMode, itemWidth, CHEKI_GRID_GAP, chekiTidyMode, chekiFillGaps);
    const viewerChekis = photoRows.flat();
    photoRows.forEach((row, rowIndex, rows) => {
      const isLastPhotoRow = rowIndex === rows.length - 1;
      items.push({
        type: 'row',
        key: `${groupKey}:row:${rowIndex}`,
        groupKey,
        chekis: row,
        viewerChekis,
        isLastPhotoRow,
      });
    });

  }
  return items;
}

function sortChekiRecords<T extends { date: string | null; created_at: string }>(records: T[], sortOrder: ChekiSortOrder): T[] {
  const sorted = sortChekisDesc(records);
  return sortOrder === 'asc' ? sorted.reverse() : sorted;
}

function formatAlbumDate(date: string): string {
  if (date === '__undated__') return '日期未填写';
  return formatChineseDateWithWeekday(date, { omitCurrentYear: true });
}

function buildRecordMonthItems(
  records: ChekiRecordWithItems[],
  sortOrder: ChekiSortOrder,
): ChekiGalleryItem[] {
  return buildChekiMonthSections(records, sortOrder).flatMap(({ key, items }) => {
    return [
      {
        type: 'recordSectionHeader' as const,
        key: `record-section:${key}`,
        title: key === '__undated__' ? '日期未填写' : key,
        count: items.length,
      },
      ...items.map((record) => ({
        type: 'record' as const,
        key: `record:${record.id}`,
        record,
      })),
    ];
  });
}

function buildAlbumGridItems(
  chekis: Cheki[],
  columns: ChekiGridColumns,
  sortOrder: ChekiSortOrder,
  displayMode: 'portrait' | 'original',
  itemWidth: number,
  chekiTidyMode: boolean,
  chekiFillGaps: boolean,
): ChekiGalleryItem[] {
  const sortedChekis = sortChekiRecords(chekis, sortOrder);
  const photoRows = chunkChekiPhysicalRows(sortedChekis, columns, displayMode, itemWidth, CHEKI_GRID_GAP, chekiTidyMode, chekiFillGaps);
  const viewerChekis = photoRows.flat();
  const items: ChekiGalleryItem[] = photoRows.map((row, index, rows) => ({
    type: 'row',
    key: `album:row:${index}`,
    groupKey: '__album__',
    chekis: row,
    viewerChekis,
    isLastPhotoRow: index === rows.length - 1,
  }));
  return items;
}

function buildDateGroupedAlbumGridItems(
  chekis: Cheki[],
  columns: ChekiGridColumns,
  sortOrder: ChekiSortOrder,
  displayMode: 'portrait' | 'original',
  itemWidth: number,
  chekiTidyMode: boolean,
  chekiFillGaps: boolean,
): ChekiGalleryItem[] {
  return buildChekiDateSections(chekis, sortOrder).flatMap(({ key, items }) => {
    const groupChekis = items;
    const photoRows = chunkChekiPhysicalRows(groupChekis, columns, displayMode, itemWidth, CHEKI_GRID_GAP, chekiTidyMode, chekiFillGaps);
    const viewerChekis = photoRows.flat();
    const rows: ChekiGalleryItem[] = photoRows.map((row, index, allRows) => ({
      type: 'row',
      key: `date:${key}:row:${index}`,
      groupKey: `date:${key}`,
      chekis: row,
      viewerChekis,
      isLastPhotoRow: index === allRows.length - 1,
    }));
    return [{
      type: 'dateHeader' as const,
      key: `date:${key}:header`,
      title: formatAlbumDate(key),
      count: groupChekis.length,
    }, ...rows];
  });
}

function matchesDateRange(
  record: { date: string | null; created_at: string },
  startDate?: string,
  endDate?: string,
): boolean {
  if (!startDate || !endDate) return true;
  const effective = (record.date ?? record.created_at).slice(0, 10);
  return effective >= startDate && effective <= endDate;
}

function browseItemToCheki(item: ChekiBrowseItem): Cheki {
  const frontPhotoUri = item.images.find((image) => image.side === 'front')?.photo_uri ?? null;
  const backPhotoUri = item.images.find((image) => image.side === 'back')?.photo_uri ?? null;
  return {
    id: item.id,
    event_id: item.record.event_id,
    artist_id: item.record.artist_id,
    photo_uri: frontPhotoUri ?? backPhotoUri ?? '',
    front_photo_uri: frontPhotoUri,
    back_photo_uri: backPhotoUri,
    date: item.record.date,
    price: item.unit_price,
    notes: item.notes,
    is_favorite: item.is_favorite,
    spec: item.spec,
    created_at: item.record.created_at,
  };
}

function SegmentedOptions({
  colors,
  options,
  value,
  onChange,
}: {
  colors: ThemeColors;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      gap: 4,
      borderRadius: 12,
      padding: 3,
      backgroundColor: colors.cardAlt,
    }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.72}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.card : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12,
              lineHeight: 16,
              fontWeight: '800',
              color: selected ? colors.text : colors.textMuted,
            }}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const BROWSE_MODE_OPTIONS: ReadonlyArray<ModeChoiceOption<ChekiBrowseMode>> = [
  { value: 'album', label: '相册', icon: 'album' },
  { value: 'record', label: '记录', icon: 'reorder' },
];

export default function ChekiLibraryScreen() {
  const params = useLocalSearchParams<ChekiFilterRouteParams>();
  const db = useDB();
  const { colors, isDark, chekiDisplayMode, chekiTidyMode: defaultTidyMode, chekiFillGaps: defaultFillGaps } = useAppTheme();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const isAndroid = Platform.OS === 'android';
  const androidHeader = useAndroidCollapsibleTabHeader();
  const iosTabBarScroll = useFloatingTabBarScroll();
  const tabBarScroll = isAndroid ? androidHeader.scrollProps : iosTabBarScroll;
  const reducedMotion = useReducedMotionEnabled();

  const deepLinkSignature = getChekiDeepLinkSignature(params);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [viewPreferences, setViewPreferences] = useState<ChekiViewPreferences>(DEFAULT_CHEKI_VIEW_PREFERENCES);
  const [viewPreferencesLoaded, setViewPreferencesLoaded] = useState(false);
  const [albumDisplayOverride, setAlbumDisplayOverride] = useState<'physical' | 'justified' | 'square' | null>(null);
  const consumedDeepLinkRef = useRef<string | null>(null);
  const [viewSettingsVisible, setViewSettingsVisible] = useState(false);
  const [galleryViewportHeight, setGalleryViewportHeight] = useState(0);
  const [galleryHeaderHeight, setGalleryHeaderHeight] = useState(0);
  const galleryContentWidth = Math.max(1, screenWidth - 32);
  const galleryAvailableHeight = Math.max(
    240,
    (galleryViewportHeight || screenHeight) - galleryHeaderHeight - 40,
  );
  const albumStyle = albumDisplayOverride ?? (chekiDisplayMode === 'original' ? 'square' : defaultTidyMode ? 'justified' : 'physical');
  const albumDisplayMode = albumStyle === 'square' ? 'original' : 'portrait';
  const chekiTidyMode = albumStyle === 'justified';
  const [fillGapsOverride, setFillGapsOverride] = useState<boolean | null>(null);
  const chekiFillGaps = fillGapsOverride ?? defaultFillGaps;
  const gridLayout = useChekiAlbumGridLayout({
    density: viewPreferences.density,
    availableWidth: galleryContentWidth,
    availableHeight: galleryAvailableHeight,
    displayMode: albumDisplayMode,
  });
  const columns = gridLayout.columns;
  const chekiW = gridLayout.itemWidth;
  const chekiH = gridLayout.itemHeight;

  const [browseItems, setBrowseItems] = useState<ChekiBrowseItem[]>([]);
  const [recordList, setRecordList] = useState<ChekiRecordWithItems[]>([]);
  const [artistMap, setArtistMap] = useState<Map<string, Artist>>(new Map());
  const [eventMap, setEventMap] = useState<Map<string, Event>>(new Map());
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 180);
  const searchTokens = useMemo(() => tokenizeChekiSearchQuery(debouncedKeyword), [debouncedKeyword]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<ChekiDatePickerMode | null>(null);
  const [recordFilters, setRecordFilters] = useState<ChekiRecordFilters>(EMPTY_CHEKI_RECORD_FILTERS);
  const [itemFilters, setItemFilters] = useState<ChekiItemFilters>(EMPTY_CHEKI_ITEM_FILTERS);
  const [recordFilterDraft, setRecordFilterDraft] = useState<ChekiRecordFilters>(recordFilters);
  const [itemFilterDraft, setItemFilterDraft] = useState<ChekiItemFilters>(itemFilters);
  const [viewerState, setViewerState] = useState<{
    selectedId: string;
    chekis: Cheki[];
    transitionOrigin: FullscreenImageTransitionOrigin | null;
  } | null>(null);
  const isRecordMode = viewPreferences.browseMode === 'record';
  const appliedArtistIds = isRecordMode ? recordFilters.artistIds : itemFilters.artistIds;
  const appliedDate = isRecordMode ? recordFilters.date : itemFilters.date;
  const appliedEventId = isRecordMode ? recordFilters.eventId : null;

  useEffect(() => {
    let isActive = true;
    loadChekiViewPreferences().then((preferences) => {
      if (!isActive) return;
      setViewPreferences({ ...preferences, browseMode: preferences.defaultBrowseMode });
      setViewPreferencesLoaded(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!viewPreferencesLoaded || consumedDeepLinkRef.current === deepLinkSignature) return;
    const incoming = buildChekiDeepLinkState(params, viewPreferences.browseMode);
    consumedDeepLinkRef.current = deepLinkSignature;
    if (!incoming.hasDeepLink) return;

    if (incoming.filterAction === 'replace') {
      if (incoming.targetMode === 'record') {
        setRecordFilters(cloneChekiRecordFilters(incoming.filters));
        setRecordFilterDraft(cloneChekiRecordFilters(incoming.filters));
      } else {
        setItemFilters(cloneChekiItemFilters(incoming.filters));
        setItemFilterDraft(cloneChekiItemFilters(incoming.filters));
      }
    } else if (incoming.filterAction === 'clearDate') {
      if (incoming.targetMode === 'record') {
        setRecordFilters((current) => ({ ...current, date: null }));
        setRecordFilterDraft((current) => ({ ...current, date: null }));
      } else {
        setItemFilters((current) => ({ ...current, date: null }));
        setItemFilterDraft((current) => ({ ...current, date: null }));
      }
    }
    setViewPreferences((current) => (
      current.browseMode === incoming.targetMode
        ? current
        : { ...current, browseMode: incoming.targetMode }
    ));
    router.setParams(createClearedChekiDeepLinkParams());
  }, [deepLinkSignature, params, viewPreferences.browseMode, viewPreferencesLoaded]);

  const load = useCallback(async () => {
    const [items, records, artists, events, config] = await Promise.all([
      db.chekiRecords.findBrowseItems(),
      db.chekiRecords.findRecords(),
      db.artists.findAll(),
      db.events.findAll(),
      db.userConfig.getConfig(),
    ]);
    setBrowseItems(items);
    setRecordList(records);
    setArtistMap(new Map(artists.map((artist) => [artist.id, artist])));
    setEventMap(new Map(events.map((event) => [event.id, event])));
    setOshiArtistId(config.oshi_artist_id);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 拍立得只按 Record 直接关联的艺人筛选，不沿任何所属关系归因。
  const filterArtistIds = useMemo<Set<string> | null>(() => {
    if (appliedArtistIds.length === 0) return null;
    return new Set(appliedArtistIds);
  }, [appliedArtistIds]);

  const matchesArtist = useCallback((artistId: string | null) => {
    if (!filterArtistIds) return true;
    if (!artistId) return false;
    return filterArtistIds.has(artistId);
  }, [filterArtistIds]);

  const indexedBrowseItems = useMemo(() => browseItems.map((item) => {
    const { record } = item;
    const artist = record.artist_id ? artistMap.get(record.artist_id) : null;
    const event = record.event_id ? eventMap.get(record.event_id) : null;
    return {
      item,
      searchIndex: buildChekiItemSearchIndex({
        date: record.date,
        recordNotes: record.notes,
        itemNotes: item.notes,
        artistText: artist ? getArtistSearchText(artist, artistMap) : null,
        eventTitle: event?.title ?? null,
      }),
    };
  }), [artistMap, browseItems, eventMap]);
  const indexedRecordList = useMemo(() => recordList.map((record) => {
    const artist = record.artist_id ? artistMap.get(record.artist_id) : null;
    const event = record.event_id ? eventMap.get(record.event_id) : null;
    return {
      record,
      searchIndex: buildChekiRecordSearchIndex({
        date: record.date,
        recordNotes: record.notes,
        artistText: artist ? getArtistSearchText(artist, artistMap) : null,
        eventTitle: event?.title ?? null,
        itemNotes: record.items.map((item) => item.notes),
      }),
    };
  }), [artistMap, eventMap, recordList]);

  const filteredChekiList = useMemo(
    () => {
      if (isRecordMode) return [];
      return indexedBrowseItems.filter(({ item, searchIndex }) => {
        if (!matchesChekiItemFilters(item, itemFilters)) return false;
        return matchesChekiSearchIndex(searchIndex, searchTokens);
      }).map(({ item }) => browseItemToCheki(item));
    },
    [
      indexedBrowseItems,
      isRecordMode,
      itemFilters,
      searchTokens,
    ],
  );
  const filteredRecordList = useMemo(
    () => {
      if (!isRecordMode) return [];
      return indexedRecordList.filter(({ record, searchIndex }) => {
        const imageItemCount = record.items.filter((item) => item.images.length > 0).length;
        const hasNotes = Boolean(
          record.notes?.trim()
          || record.items.some((item) => item.notes?.trim()),
        );
        const hasBackImage = record.items.some((item) => item.images.some((image) => image.side === 'back'));
        if (!matchesArtist(record.artist_id)) return false;
        if (recordFilters.eventId && record.event_id !== recordFilters.eventId) return false;
        if (recordFilters.date && !matchesDateRange(record, recordFilters.date.startDate, recordFilters.date.endDate)) return false;
        if (recordFilters.hasLinkedEvent && !record.event_id) return false;
        if (recordFilters.hasNotes && !hasNotes) return false;
        if (recordFilters.hasBackImage && !hasBackImage) return false;
        if (recordFilters.imageStatus === 'none' && imageItemCount !== 0) return false;
        if (recordFilters.imageStatus === 'partial' && (imageItemCount === 0 || imageItemCount >= record.quantity)) return false;
        if (recordFilters.imageStatus === 'complete' && imageItemCount !== record.quantity) return false;

        return matchesChekiSearchIndex(searchIndex, searchTokens);
      }).map(({ record }) => record);
    },
    [
      isRecordMode,
      indexedRecordList,
      matchesArtist,
      recordFilters,
      searchTokens,
    ],
  );

  // 出现在拍立得记录中的艺人，按记录数降序，供艺人选择器使用
  const distinctArtists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of recordList) {
      if (record.artist_id) {
        counts.set(record.artist_id, (counts.get(record.artist_id) ?? 0) + record.quantity);
      }
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ artist: artistMap.get(id), count }))
      .filter((item): item is { artist: Artist; count: number } => Boolean(item.artist))
      .sort((a, b) => b.count - a.count || a.artist.name.localeCompare(b.artist.name))
      .map((item) => item.artist);
  }, [recordList, artistMap]);

  const groups = useMemo(
    () => groupChekiRecordsByArtist(filteredChekiList, [], artistMap, oshiArtistId),
    [filteredChekiList, artistMap, oshiArtistId],
  );
  const galleryItems = useMemo(() => {
    if (viewPreferences.browseMode === 'record') {
      return buildRecordMonthItems(filteredRecordList, viewPreferences.recordSortOrder);
    }

    if (viewPreferences.albumGrouping === 'none') {
      return buildAlbumGridItems(filteredChekiList, columns, viewPreferences.albumSortOrder, albumDisplayMode, chekiW, chekiTidyMode, chekiFillGaps);
    }

    if (viewPreferences.albumGrouping === 'date') {
      return buildDateGroupedAlbumGridItems(filteredChekiList, columns, viewPreferences.albumSortOrder, albumDisplayMode, chekiW, chekiTidyMode, chekiFillGaps);
    }

    const sortedGroups = groups.map((group) => ({
      ...group,
      chekis: sortChekiRecords(group.chekis, viewPreferences.albumSortOrder),
      manualEntries: [],
      totalCount: group.chekis.length,
    })).filter((group) => group.chekis.length > 0);
    return buildArtistGridItems(sortedGroups, columns, albumDisplayMode, chekiW, chekiTidyMode, chekiFillGaps);
  }, [
    albumDisplayMode,
    chekiW,
    chekiTidyMode,
    chekiFillGaps,
    columns,
    filteredChekiList,
    filteredRecordList,
    groups,
    viewPreferences.albumGrouping,
    viewPreferences.albumSortOrder,
    viewPreferences.browseMode,
    viewPreferences.recordSortOrder,
  ]);
  const artistNameMap = useMemo(
    () => Object.fromEntries([...artistMap.values()].map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [artistMap],
  );
  const filterEvent = appliedEventId ? eventMap.get(appliedEventId) ?? null : null;
  const draftArtistIds = isRecordMode ? recordFilterDraft.artistIds : itemFilterDraft.artistIds;
  const draftDate = isRecordMode ? recordFilterDraft.date : itemFilterDraft.date;
  const setDraftArtistIds = useCallback((artistIds: string[]) => {
    if (isRecordMode) setRecordFilterDraft((current) => ({ ...current, artistIds }));
    else setItemFilterDraft((current) => ({ ...current, artistIds }));
  }, [isRecordMode]);
  const favoriteArtistIds = useMemo(
    () => [...artistMap.values()].filter((artist) => artist.is_favorite === 1).map((artist) => artist.id),
    [artistMap],
  );
  const toggleArtistBatch = useCallback((batch: string[]) => {
    setDraftArtistIds(toggleBatchSelection(draftArtistIds, batch));
  }, [draftArtistIds, setDraftArtistIds]);
  const filterHeader = (
    <DateFilterHeader
      value={draftDate}
      onSelectMode={(mode) => {
        setFilterVisible(false);
        setDatePickerMode(mode);
      }}
    />
  );

  const filterSections = useMemo<FilterSection[]>(() => {
    const result: FilterSection[] = [];
    // 日期之下为「图片状态」与「其他条件」：图片状态单独成节，其他条件保留正向开关 chips 与规格
    const otherGroups: FilterChipGroup[] = [];
    if (isRecordMode) {
      result.push({
        key: 'image_status',
        title: '图片状态',
        value: null,
        onChange: () => {},
        options: [],
        chipGroups: [{
          key: 'image_status',
          options: [
            { value: 'none', label: '无图片' },
            { value: 'partial', label: '部分有图' },
            { value: 'complete', label: '全部有图' },
          ],
          value: recordFilterDraft.imageStatus,
          onChange: (value) => setRecordFilterDraft((current) => ({
            ...current,
            imageStatus: value === 'none' || value === 'partial' || value === 'complete' ? value : null,
          })),
          showAllChip: true,
        }],
      });
    }
    const hasLinkedEvent = isRecordMode ? recordFilterDraft.hasLinkedEvent : itemFilterDraft.hasLinkedEvent;
    const hasNotes = isRecordMode ? recordFilterDraft.hasNotes : itemFilterDraft.hasNotes;
    const hasBackImage = isRecordMode ? recordFilterDraft.hasBackImage : itemFilterDraft.hasBackImage;
    const quickOptions: FilterOption[] = [
      { value: 'linked', label: '已关联活动' },
      { value: 'with_notes', label: '有备注' },
      ...(!isRecordMode ? [{ value: 'favorite', label: '已收藏' }] : []),
      { value: 'with_back', label: '有背签' },
    ];
    otherGroups.push({
      key: 'quick',
      multiple: true,
      values: [
        ...(hasLinkedEvent ? ['linked'] : []),
        ...(hasNotes ? ['with_notes'] : []),
        ...(!isRecordMode && itemFilterDraft.isFavorite ? ['favorite'] : []),
        ...(hasBackImage ? ['with_back'] : []),
      ],
      onValuesChange: (values) => {
        const selected = new Set(values);
        if (isRecordMode) {
          setRecordFilterDraft((current) => ({
            ...current,
            hasLinkedEvent: selected.has('linked'),
            hasNotes: selected.has('with_notes'),
            hasBackImage: selected.has('with_back'),
          }));
        } else {
          setItemFilterDraft((current) => ({
            ...current,
            hasLinkedEvent: selected.has('linked'),
            hasNotes: selected.has('with_notes'),
            isFavorite: selected.has('favorite'),
            hasBackImage: selected.has('with_back'),
          }));
        }
      },
      showAllChip: true,
      options: quickOptions,
    });
    if (!isRecordMode) {
      // 规格：其他条件的最后一位
      otherGroups.push({
        key: 'spec',
        title: '规格',
        multiple: true,
        values: itemFilterDraft.specs,
        onValuesChange: (values) => setItemFilterDraft((current) => ({ ...current, specs: values as ChekiSpec[] })),
        showAllChip: true,
        options: CHEKI_SPECS.map((spec) => ({ value: spec.id, label: spec.label })),
      });
    }
    result.push({
      key: 'other',
      title: '其他条件',
      value: null,
      onChange: () => {},
      options: [],
      chipGroups: otherGroups,
    });

    // 艺人：单推 / 收藏艺人快捷 chip 放在选择器上方；选择器复用共享 ArtistSearchPicker
    const oshiSelected = Boolean(oshiArtistId && draftArtistIds.includes(oshiArtistId));
    const favoritesSelected = favoriteArtistIds.length > 0 && favoriteArtistIds.every((id) => draftArtistIds.includes(id));
    const artistSearchArtists = [...distinctArtists];
    const artistSearchArtistIds = new Set(artistSearchArtists.map((artist) => artist.id));
    for (const artistId of draftArtistIds) {
      const selectedArtist = artistMap.get(artistId);
      if (selectedArtist && !artistSearchArtistIds.has(selectedArtist.id)) {
        artistSearchArtistIds.add(selectedArtist.id);
        artistSearchArtists.push(selectedArtist);
      }
    }
    const missingSelectedArtistRows = draftArtistIds
      .filter((artistId) => !artistMap.has(artistId))
      .map((artistId) => ({ id: artistId, label: '未知艺人' }));
    result.push({
      key: 'artist',
      title: '艺人',
      value: null,
      values: draftArtistIds,
      multiple: true,
      onChange: (value) => setDraftArtistIds(value ? [value] : []),
      onValuesChange: setDraftArtistIds,
      beforeContent: (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <FilterBatchChip
            label="单推"
            onPress={() => toggleArtistBatch(oshiArtistId ? [oshiArtistId] : [])}
            disabled={!oshiArtistId}
            selected={oshiSelected}
          />
          <FilterBatchChip
            label="收藏艺人"
            onPress={() => toggleArtistBatch(favoriteArtistIds)}
            disabled={favoriteArtistIds.length === 0}
            selected={favoritesSelected}
          />
        </View>
      ),
      artistSearch: {
        artists: artistSearchArtists,
        lookup: [...artistMap.values()],
        oshiArtistId,
        parentNameMap: artistNameMap,
        placeholder: '搜索艺人…',
        typePreference: 'person',
        extraSelectedRows: missingSelectedArtistRows,
      },
    });
    // 活动筛选仅经深链带入，这里给出可清除的 chip
    if (isRecordMode && recordFilterDraft.eventId) {
      result.push({
        key: 'event',
        title: '活动',
        value: recordFilterDraft.eventId,
        onChange: (value) => setRecordFilterDraft((current) => ({ ...current, eventId: value })),
        options: [{ value: recordFilterDraft.eventId, label: filterEvent?.title ?? '指定活动' }],
      });
    }
    return result;
  }, [
    draftArtistIds,
    isRecordMode,
    recordFilterDraft,
    itemFilterDraft,
    filterEvent,
    distinctArtists,
    oshiArtistId,
    artistMap,
    favoriteArtistIds,
    toggleArtistBatch,
    isDark,
    setDraftArtistIds,
  ]);

  const activeFilterCount = useMemo(() => {
    return isRecordMode
      ? countChekiRecordFilterCategories(recordFilters)
      : countChekiItemFilterCategories(itemFilters);
  }, [isRecordMode, itemFilters, recordFilters]);
  const hasKeyword = keyword.trim().length > 0;
  const hasAnyFilter = hasKeyword || activeFilterCount > 0;
  const resultCount = isRecordMode ? filteredRecordList.length : filteredChekiList.length;
  const resultCountLabel = isRecordMode ? `${resultCount} 条记录` : `${resultCount} 张拍立得`;

  const clearCurrentFilters = useCallback(() => {
    if (isRecordMode) setRecordFilters(cloneChekiRecordFilters(EMPTY_CHEKI_RECORD_FILTERS));
    else setItemFilters(cloneChekiItemFilters(EMPTY_CHEKI_ITEM_FILTERS));
  }, [isRecordMode]);
  const handleEmptyClear = useCallback(() => {
    if (keyword.trim()) setKeyword('');
    else clearCurrentFilters();
  }, [clearCurrentFilters, keyword]);

  const persistViewPreferences = useCallback((nextPreferences: ChekiViewPreferences) => {
    setViewPreferences(nextPreferences);
    void saveChekiViewPreferences(nextPreferences);
  }, []);

  const handleChangeBrowseMode = useCallback((browseMode: ChekiBrowseMode) => {
    persistViewPreferences({
      ...viewPreferences,
      browseMode,
    });
  }, [persistViewPreferences, viewPreferences]);

  const handleChangeAlbumGrouping = useCallback((albumGrouping: ChekiAlbumGrouping) => {
    persistViewPreferences({ ...viewPreferences, albumGrouping });
  }, [persistViewPreferences, viewPreferences]);

  const handleChangeSortOrder = useCallback((sortOrder: ChekiSortOrder) => {
    persistViewPreferences({
      ...viewPreferences,
      ...(isRecordMode ? { recordSortOrder: sortOrder } : { albumSortOrder: sortOrder }),
    });
  }, [isRecordMode, persistViewPreferences, viewPreferences]);

  const handleChangeDensity = useCallback((density: ChekiGridDensity) => {
    persistViewPreferences({ ...viewPreferences, density });
  }, [persistViewPreferences, viewPreferences]);


  const handleChangeRecordThumbnails = useCallback((showRecordThumbnails: boolean) => {
    persistViewPreferences({ ...viewPreferences, showRecordThumbnails });
  }, [persistViewPreferences, viewPreferences]);

  const handleDismissAlbumModeHint = useCallback(() => {
    persistViewPreferences({ ...viewPreferences, albumModeHintDismissed: true });
  }, [persistViewPreferences, viewPreferences]);

  const handleChangeAlbumDisplayMode = useCallback((mode: 'physical' | 'justified' | 'square') => {
    // 电子切册页内的切换只影响本次会话，不写入持久化；持久化默认值由设置页「拍立得展示方式」决定。
    setAlbumDisplayOverride(mode);
  }, []);

  const filterParams = useMemo(() => {
    const params: { artist_id?: string; event_id?: string; date?: string } = {};
    if (appliedArtistIds.length === 1) params.artist_id = appliedArtistIds[0];
    if (appliedEventId) params.event_id = appliedEventId;
    if (appliedDate?.mode === 'day') params.date = appliedDate.startDate;
    else if (filterEvent?.event_date) params.date = filterEvent.event_date;
    return params;
  }, [appliedArtistIds, appliedDate, appliedEventId, filterEvent?.event_date]);
  const openUnifiedCreate = useCallback(() => {
    router.push({ pathname: '/cheki/new', params: filterParams });
  }, [filterParams]);

  const bg = colors.screen;
  const viewerItems = useMemo(
    () => viewerState ? buildChekiViewerItems(viewerState.chekis, artistMap, eventMap) : [],
    [artistMap, eventMap, viewerState],
  );

  const handleGalleryLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setGalleryViewportHeight((current) => (current === nextHeight ? current : nextHeight));
  }, []);

  const handleGalleryHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setGalleryHeaderHeight((current) => (current === nextHeight ? current : nextHeight));
  }, []);

  const handleDeleteCheki = useCallback((chekiId: string) => {
    Alert.alert('删除这张拍立得？', '删除后无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await db.chekiRecords.deleteItem(chekiId);
            hapticDeleteSuccess();
            setViewerState(null);
            load();
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
    const update = (chekis: Cheki[], isFavorite: boolean): Cheki[] => {
      const favoriteValue: Cheki['is_favorite'] = isFavorite ? 1 : 0;
      return chekis.map((cheki) => (
        cheki.id === itemId ? { ...cheki, is_favorite: favoriteValue } : cheki
      ));
    };
    const updateBrowseItems = (items: ChekiBrowseItem[], isFavorite: boolean): ChekiBrowseItem[] => {
      const favoriteValue: ChekiBrowseItem['is_favorite'] = isFavorite ? 1 : 0;
      return items.map((browseItem) => (
        browseItem.id === itemId ? { ...browseItem, is_favorite: favoriteValue } : browseItem
      ));
    };
    setBrowseItems((current) => updateBrowseItems(current, nextFavorite));
    setViewerState((current) => current ? {
      ...current,
      chekis: update(current.chekis, nextFavorite),
    } : current);
    try {
      await db.chekiRecords.setItemFavorite(itemId, nextFavorite);
    } catch {
      hapticError();
      setBrowseItems((current) => updateBrowseItems(current, !nextFavorite));
      setViewerState((current) => current ? {
        ...current,
        chekis: update(current.chekis, !nextFavorite),
      } : current);
      Alert.alert('无法更新收藏', '请稍后再试。');
    }
  }, [db]);

  const renderHeaderActions = useCallback(() => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <TouchableOpacity
        accessibilityLabel="电子切册显示选项"
        accessibilityRole="button"
        onPress={() => setViewSettingsVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <AppIcon name="viewSettings" size={22} color={colors.accent} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="添加拍立得记录"
        accessibilityRole="button"
        onPress={openUnifiedCreate}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ paddingRight: 4 }}
      >
        <AppIcon name="add" size={24} color={colors.accent} />
      </TouchableOpacity>
    </View>
  ), [colors.accent, openUnifiedCreate]);

  const openViewer = useCallback((
    cheki: Cheki,
    chekis: Cheki[],
    transitionOrigin: FullscreenImageTransitionOrigin | null,
  ) => {
    setViewerState({
      selectedId: cheki.id,
      chekis,
      transitionOrigin: reducedMotion ? null : transitionOrigin,
    });
  }, [reducedMotion]);

  const renderEmptyState = useCallback(() => (
    <View style={{ alignItems: 'center', paddingTop: 80 }}>
      <AppIcon name="camera" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.heading, marginBottom: 8 }}>
        {isRecordMode ? '还没有拍立得记录' : '还没有拍立得'}
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
        {isRecordMode ? '添加第一条记录，图片可以稍后补充。' : '添加记录并保存图片后，会显示在这里。'}
      </Text>
      <View style={{ alignItems: 'center' }}>
        <TouchableOpacity
          onPress={openUnifiedCreate}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.accent }}
        >
          <AppIcon name="add" size={16} color={colors.onAccent} />
          <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 14 }}>添加记录</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [colors, isRecordMode, openUnifiedCreate]);

  const renderGalleryItem = useCallback(({ item }: { item: ChekiGalleryItem }) => {
    if (item.type === 'recordSectionHeader') {
      return <EventSectionHeader title={item.title} count={item.count} colors={colors} />;
    }

    if (item.type === 'record') {
      const artist = item.record.artist_id ? artistMap.get(item.record.artist_id) ?? null : null;
      const event = item.record.event_id ? eventMap.get(item.record.event_id) ?? null : null;
      const parentName = artist?.parent_id ? artistNameMap[artist.parent_id] ?? null : null;
      return (
        <ChekiRecordListItem
          record={item.record}
          artist={artist}
          parentName={parentName}
          event={event}
          isOshi={artist?.id === oshiArtistId}
          showThumbnail={viewPreferences.showRecordThumbnails}
          onPress={() => router.push(`/cheki/records/${item.record.id}`)}
        />
      );
    }

    if (item.type === 'dateHeader') {
      return <EventSectionHeader title={item.title} count={item.count} colors={colors} />;
    }

    if (item.type === 'header') {
      const groupAvatarSrc = item.group.artist ? resolveAvatarSource(item.group.artist.avatar_uri) : null;
      const isOshi = item.group.artist?.id === oshiArtistId;
      const display = item.group.artist ? getArtistDisplayText({
        artist: item.group.artist,
        parentName: item.group.artist.parent_id ? artistNameMap[item.group.artist.parent_id] : null,
      }) : null;

      return (
        <TouchableOpacity
          activeOpacity={item.group.artist ? 0.7 : 1}
          onPress={item.group.artist ? () => router.push(`/artists/${item.group.artist!.id}`) : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 10, gap: 8 }}
        >
          <View>
            <OshiAvatar source={groupAvatarSrc} size={isOshi ? 36 : 32} isOshi={isOshi} name={display?.title} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 30, fontWeight: '700', color: colors.text, flexShrink: 1 }}>
                {display?.title ?? '未关联艺人'}
              </Text>
              {isOshi ? <OshiBadge /> : null}
            </View>
            {display?.subtitle ? (
              <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.textSecondary }}>
                {display.subtitle}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: withAlpha(colors.accent, 0.12), borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent }}>
                {item.group.totalCount} 张
              </Text>
            </View>
          </View>
          {item.group.artist ? <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} /> : null}
        </TouchableOpacity>
      );
    }

    const rowHeight = chekiTidyMode ? getChekiJustifiedRowHeight(item.chekis, columns, chekiW, CHEKI_GRID_GAP, item.isLastPhotoRow) : undefined;
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: albumDisplayMode === 'original' ? CHEKI_SQUARE_GRID_GAP : CHEKI_GRID_GAP,
          marginBottom: item.isLastPhotoRow
            ? 24
            : albumDisplayMode === 'original' ? CHEKI_SQUARE_GRID_GAP : CHEKI_GRID_GAP,
        }}
      >
        {item.chekis.map((cheki) => (
          <ChekiThumbnailButton
            key={cheki.id}
            cheki={cheki}
            viewerChekis={item.viewerChekis}
            width={albumDisplayMode === 'original' ? chekiW : getChekiAlbumFrame(cheki.spec, chekiW, rowHeight).width}
            height={albumDisplayMode === 'original' ? chekiH : getChekiAlbumFrame(cheki.spec, chekiW, rowHeight).height}
            colors={colors}
            onOpen={openViewer}
            displayMode={albumDisplayMode}
          />
        ))}
      </View>
    );
  }, [
    artistNameMap,
    chekiH,
    chekiW,
    chekiTidyMode,
    chekiFillGaps,
    colors,
    columns,
    eventMap,
    isDark,
    openViewer,
    oshiArtistId,
    albumDisplayMode,
    viewPreferences.albumGrouping,
    viewPreferences.showRecordThumbnails,
  ]);

  const galleryList = (
    <FlatList
      onLayout={handleGalleryLayout}
      data={galleryItems}
      keyExtractor={(item) => item.key}
      renderItem={renderGalleryItem}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: isAndroid ? androidHeader.contentTopPadding : 12,
        paddingBottom: contentBottomPadding,
      }}
      contentInsetAdjustmentBehavior="automatic"
      scrollIndicatorInsets={isAndroid ? { bottom: contentBottomPadding } : undefined}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...tabBarScroll}
      ListHeaderComponent={
        <>
          {isAndroid ? (
            <AndroidLargeTabTitle
              title="电子切册"
              right={renderHeaderActions()}
              largeTitleStyle={androidHeader.largeTitleStyle}
            />
          ) : null}
          <View onLayout={handleGalleryHeaderLayout} style={{ marginBottom: 8 }}>
            <SearchFilterBar
              keyword={keyword}
              onKeywordChange={setKeyword}
              placeholder="搜索艺人、活动或备注等关键词"
              onOpenFilter={() => {
                if (isRecordMode) {
                  setRecordFilterDraft(cloneChekiRecordFilters(recordFilters));
                } else {
                  setItemFilterDraft(cloneChekiItemFilters(itemFilters));
                }
                setFilterVisible(true);
              }}
              activeCount={activeFilterCount}
              showActiveFilters={false}
              clearButtonBehavior="custom"
              filterExpanded={filterVisible}
              isDark={isDark}
            />
            {hasAnyFilter && resultCount > 0 ? (
              <Text
                accessibilityRole="text"
                style={{ marginTop: -2, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}
              >
                {resultCountLabel}
              </Text>
            ) : null}
          </View>
        </>
      }
      ListEmptyComponent={
        hasAnyFilter ? (
          <FilteredEmptyState
            title={isRecordMode ? '没有符合条件的记录' : '没有符合条件的拍立得'}
            message="尝试调整搜索或筛选条件。"
            onClear={handleEmptyClear}
            clearLabel={hasKeyword ? '清除搜索' : '清除筛选'}
            isDark={isDark}
          />
        ) : renderEmptyState()
      }
      initialNumToRender={12}
      maxToRenderPerBatch={9}
      windowSize={7}
      removeClippedSubviews
    />
  );

  const screenOverlays = (
    <>
      <ChekiViewerModal
        visible={viewerState !== null}
        items={viewerItems}
        selectedId={viewerState?.selectedId ?? null}
        onClose={() => setViewerState(null)}
        onEdit={(item) => router.push(`/cheki/items/${item.itemId ?? item.id}/edit`)}
        onDelete={(item) => handleDeleteCheki(item.itemId ?? item.id)}
        onToggleFavorite={(item) => void handleToggleChekiFavorite(item)}
        initialTransitionOrigin={viewerState?.transitionOrigin ?? null}
      />

      <FilterSheet
        visible={filterVisible}
        sections={filterSections}
        isDark={isDark}
        header={filterHeader}
        onReset={() => {
          if (isRecordMode) setRecordFilterDraft(cloneChekiRecordFilters(EMPTY_CHEKI_RECORD_FILTERS));
          else setItemFilterDraft(cloneChekiItemFilters(EMPTY_CHEKI_ITEM_FILTERS));
        }}
        onClose={() => setFilterVisible(false)}
        onApply={() => {
          if (isRecordMode) setRecordFilters(cloneChekiRecordFilters(recordFilterDraft));
          else setItemFilters(cloneChekiItemFilters(itemFilterDraft));
          setFilterVisible(false);
        }}
      />

      <ChekiDatePicker
        visible={datePickerMode != null}
        mode={datePickerMode ?? 'day'}
        value={draftDate}
        onCancel={() => {
          setDatePickerMode(null);
          requestAnimationFrame(() => setFilterVisible(true));
        }}
        onClear={() => {
          if (isRecordMode) setRecordFilterDraft((current) => ({ ...current, date: null }));
          else setItemFilterDraft((current) => ({ ...current, date: null }));
          setDatePickerMode(null);
          requestAnimationFrame(() => setFilterVisible(true));
        }}
        onConfirm={(date) => {
          if (isRecordMode) setRecordFilterDraft((current) => ({ ...current, date }));
          else setItemFilterDraft((current) => ({ ...current, date }));
          setDatePickerMode(null);
          requestAnimationFrame(() => setFilterVisible(true));
        }}
      />

      <BottomSheetDialog
          visible={viewSettingsVisible}
          title="显示选项"
          onClose={() => setViewSettingsVisible(false)}
          maxHeightRatio={0.7}
          scrollable
        >
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '800', color: colors.heading }}>
              浏览模式
            </Text>
            <View style={{ marginTop: 12 }}>
              <ModeChoiceButtons
                colors={colors}
                options={BROWSE_MODE_OPTIONS}
                value={viewPreferences.browseMode}
                onChange={handleChangeBrowseMode}
              />
            </View>
            {!isRecordMode && !viewPreferences.albumModeHintDismissed ? (
              <View
                accessibilityRole="alert"
                style={{
                  marginTop: 12,
                  paddingHorizontal: 13,
                  paddingVertical: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  backgroundColor: colors.infoSoft,
                }}
              >
                <AppIcon name="image" size={20} color={colors.info} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.text }}>
                    相册仅展示已添加图片的拍立得
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>
                    无图记录请切换到「记录」模式查看全部记录。
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="不再提示"
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  onPress={handleDismissAlbumModeHint}
                  style={{ padding: 2, marginTop: -2, marginRight: -2 }}
                >
                  <AppIcon name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={{ paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.divider }}>
            <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '800', color: colors.heading }}>
              {isRecordMode ? '记录设置' : '相册设置'}
            </Text>

            {!isRecordMode ? (
              <View style={{ marginTop: 16, marginBottom: 16 }}>
                <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                  分组方式
                </Text>
                <SegmentedOptions
                  colors={colors}
                  options={[
                    { value: 'artist', label: '按艺人' },
                    { value: 'date', label: '按日期' },
                    { value: 'none', label: '不分组' },
                  ]}
                  value={viewPreferences.albumGrouping}
                  onChange={(value) => handleChangeAlbumGrouping(value as ChekiAlbumGrouping)}
                />
              </View>
            ) : null}

            <View style={{ marginTop: isRecordMode ? 16 : 0, marginBottom: 16 }}>
              <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                排序
              </Text>
              <SegmentedOptions
                colors={colors}
                options={[
                  { value: 'desc', label: '最新在前' },
                  { value: 'asc', label: '最早在前' },
                ]}
                value={isRecordMode ? viewPreferences.recordSortOrder : viewPreferences.albumSortOrder}
                onChange={(value) => handleChangeSortOrder(value as ChekiSortOrder)}
              />
            </View>

            {isRecordMode ? (
              <View>
                <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                  记录缩略图
                </Text>
                <SegmentedOptions
                  colors={colors}
                  options={[
                    { value: 'show', label: '显示' },
                    { value: 'hide', label: '隐藏' },
                  ]}
                  value={viewPreferences.showRecordThumbnails ? 'show' : 'hide'}
                  onChange={(value) => handleChangeRecordThumbnails(value === 'show')}
                />
              </View>
            ) : (
              <View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                    图片大小
                  </Text>
                  <SegmentedOptions
                    colors={colors}
                    options={[
                      { value: 'large', label: '大' },
                      { value: 'medium', label: '中' },
                      { value: 'small', label: '小' },
                    ]}
                    value={viewPreferences.density}
                    onChange={(value) => handleChangeDensity(value as ChekiGridDensity)}
                  />
                </View>
                <View>
                  <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                    展示方式
                  </Text>
                  <SegmentedOptions
                    colors={colors}
                    options={[
                      { value: 'physical', label: '实物比例' },
                      { value: 'justified', label: '等高排列' },
                      { value: 'square', label: '方形网格' },
                    ]}
                    value={albumStyle}
                    onChange={(value) => handleChangeAlbumDisplayMode(value as 'physical' | 'justified' | 'square')}
                  />
                  {albumStyle === 'physical' ? (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>允许提前补位</Text>
                      <SegmentedOptions colors={colors} options={[{ value: 'yes', label: '允许补位' }, { value: 'no', label: '严格排序' }]}
                        value={chekiFillGaps ? 'yes' : 'no'} onChange={(value) => setFillGapsOverride(value === 'yes')} />
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        </BottomSheetDialog>
    </>
  );

  if (!viewPreferencesLoaded) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="正在加载电子切册"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}
      >
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, fontSize: 13, color: colors.textSecondary }}>正在加载电子切册…</Text>
      </View>
    );
  }

  if (isAndroid) {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <Stack.Screen
          options={{
            headerRight: renderHeaderActions,
          }}
        />
        <AndroidCompactTabHeader
          title="电子切册"
          right={renderHeaderActions()}
          compactHeaderStyle={androidHeader.compactHeaderStyle}
          overlayHeight={androidHeader.overlayHeight}
          overlayPaddingTop={androidHeader.overlayPaddingTop}
        />
        {galleryList}
        {screenOverlays}
      </View>
    );
  }

  return (
    <>
      {galleryList}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="电子切册显示选项"
          icon={getAppIconSFSymbol('viewSettings')}
          onPress={() => setViewSettingsVisible(true)}
        />
        <Stack.Toolbar.Spacer width={8} />
        <Stack.Toolbar.Button
          accessibilityLabel="添加拍立得记录"
          icon={getAppIconSFSymbol('add')}
          onPress={openUnifiedCreate}
          separateBackground
        />
      </Stack.Toolbar>
      {screenOverlays}
    </>
  );
}

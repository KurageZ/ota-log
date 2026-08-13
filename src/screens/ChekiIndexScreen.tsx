import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert, Image, useWindowDimensions, ScrollView, AccessibilityInfo, Platform, type LayoutChangeEvent,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDB } from '../context/DBContext';
import { Artist, Cheki, ChekiManualEntry, Event } from '../types/models';
import { resolveAvatarSource } from '../utils/avatarSource';
import { getArtistDisplayText, getArtistPrimaryName } from '../utils/artistDisplay';
import { OshiAvatar, OshiBadge } from '../components/Oshi';
import { ChekiViewerModal } from '../components/ChekiViewerModal';
import type { ChekiViewerItem } from '../types/chekiViewer';
import type { FullscreenImageTransitionOrigin } from '../components/FullscreenImageViewer';
import {
  buildChekiViewerItems,
  calculateChekiGridLayout,
  ChekiArtistGroup,
  ChekiGridDensity,
  ChekiGridColumns,
  chunkChekis,
  groupChekiRecordsByArtist,
  matchesChekiKeyword,
  sortChekisDesc,
} from '../utils/cheki';
import { showDeleteFailedAlert } from '../utils/failureAlert';
import { ThemeColors, useAppTheme } from '../theme/appTheme';
import { ChekiManualEntryList } from '../components/ChekiManualEntryList';
import { ChekiRecordListItem } from '../components/ChekiRecordListItem';
import { EventSectionHeader } from '../components/EventSectionHeader';
import type { ChekiRecordWithItems } from '../repositories/ChekiRecordRepository';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../components/AndroidCollapsibleTabHeader';
import { SearchFilterBar } from '../components/SearchFilterBar';
import { BottomSheetDialog } from '../components/BottomSheetDialog';
import { FilterSheet, FilterSection, type FilterChipGroup, type FilterOption } from '../components/FilterSheet';
import { ChekiDatePicker, type ChekiDatePickerMode } from '../components/ChekiDatePicker';
import { FilteredEmptyState } from '../components/FilteredEmptyState';
import { AppIcon, getAppIconSFSymbol } from '../components/AppIcon';
import { getArtistSearchText, sortArtistsWithOshi } from '../utils/filter';
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
import { CHEKI_SPECS, getChekiSpecAspectRatio, normalizeChekiSpec, type ChekiSpec } from '../domain/chekiSpec';
import {
  EMPTY_CHEKI_ITEM_FILTERS,
  EMPTY_CHEKI_RECORD_FILTERS,
  cloneChekiItemFilters,
  cloneChekiRecordFilters,
  countChekiItemFilterCategories,
  countChekiRecordFilterCategories,
  formatChekiDateFilter,
  type ChekiItemFilters,
  type ChekiRecordFilters,
} from '../utils/chekiFilters';
import { buildChekiDateSections, buildChekiMonthSections } from '../utils/chekiSections';
import { formatChineseDateWithWeekday } from '../utils/date';

function recordYear(record: { date: string | null; created_at: string }): string {
  return (record.date ?? record.created_at).slice(0, 4);
}

type ChekiGalleryItem =
  | { type: 'record'; key: string; record: ChekiRecordWithItems }
  | { type: 'recordSectionHeader'; key: string; title: string; count: number }
  | { type: 'header'; key: string; groupKey: string; group: ChekiArtistGroup }
  | { type: 'dateHeader'; key: string; title: string; count: number }
  | { type: 'row'; key: string; groupKey: string; chekis: Cheki[]; viewerChekis: Cheki[]; isLastPhotoRow: boolean }
  | { type: 'manual'; key: string; groupKey: string; entries: ChekiManualEntry[] }
  | { type: 'notice'; key: string; text: string };

const CHEKI_GRID_GAP = 8;
const CHEKI_ASPECT_RATIO = 86 / 54;
const CHEKI_BARE_THUMBNAIL_RADIUS = 10;
const CHEKI_GRID_DENSITY_LABELS: Record<ChekiGridDensity, string> = {
  large: '大图',
  medium: '中图',
  small: '小图',
};

function ChekiGridThumbnail({
  uri,
  width,
  height,
  colors,
  imageRef,
  aspectRatio,
}: {
  uri: string;
  width: number;
  height: number;
  colors: ThemeColors;
  imageRef?: Ref<Image>;
  aspectRatio: number | null;
}) {
  const usesSpecLayout = aspectRatio !== null;
  const cardInset = usesSpecLayout ? Math.max(5, Math.round(width * 0.07)) : 0;
  const fitInside = (maxWidth: number, maxHeight: number) => {
    if (aspectRatio === null) return { width: maxWidth, height: maxHeight };
    const widthFromHeight = maxHeight * aspectRatio;
    return widthFromHeight <= maxWidth
      ? { width: widthFromHeight, height: maxHeight }
      : { width: maxWidth, height: maxWidth / aspectRatio };
  };
  const fitted = fitInside(width - cardInset * 2, height - cardInset * 2);

  return (
    <View
      style={{
        width,
        height,
        padding: cardInset,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: usesSpecLayout ? 12 : 0,
        backgroundColor: usesSpecLayout ? colors.cardAlt : 'transparent',
      }}
    >
      <View
        style={{
          ...fitted,
          borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: usesSpecLayout ? 3 : 0 },
          shadowOpacity: usesSpecLayout ? 0.18 : 0,
          shadowRadius: usesSpecLayout ? 5 : 0,
          elevation: usesSpecLayout ? 3 : 0,
        }}
      >
        <Image
          ref={imageRef}
          source={{ uri }}
          resizeMethod="resize"
          resizeMode="contain"
          style={{ width: '100%', height: '100%', borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS }}
        />
      </View>
    </View>
  );
}

function ChekiThumbnailButton({
  cheki,
  viewerChekis,
  width,
  height,
  colors,
  onOpen,
  useSpecAspectRatio,
}: {
  cheki: Cheki;
  viewerChekis: Cheki[];
  width: number;
  height: number;
  colors: ThemeColors;
  onOpen: (cheki: Cheki, chekis: Cheki[], origin: FullscreenImageTransitionOrigin | null) => void;
  useSpecAspectRatio: boolean;
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
          aspectRatio={useSpecAspectRatio
            ? getChekiSpecAspectRatio(normalizeChekiSpec(cheki.spec))
            : null}
        />
      </TouchableOpacity>
    </View>
  );
}

function buildArtistGridItems(groups: ChekiArtistGroup[], columns: ChekiGridColumns): ChekiGalleryItem[] {
  const items: ChekiGalleryItem[] = [];
  for (const group of groups) {
    const groupKey = group.artist?.id ?? '__null__';
    items.push({ type: 'header', key: `${groupKey}:header`, groupKey, group });

    chunkChekis(group.chekis, columns).forEach((row, rowIndex, rows) => {
      const isLastPhotoRow = rowIndex === rows.length - 1 && group.manualEntries.length === 0;
      items.push({
        type: 'row',
        key: `${groupKey}:row:${rowIndex}`,
        groupKey,
        chekis: row,
        viewerChekis: group.chekis,
        isLastPhotoRow,
      });
    });

    if (group.manualEntries.length > 0) {
      items.push({
        type: 'manual',
        key: `${groupKey}:manual`,
        groupKey,
        entries: group.manualEntries,
      });
    }
  }
  return items;
}

function sortChekiRecords<T extends { date: string | null; created_at: string }>(records: T[], sortOrder: ChekiSortOrder): T[] {
  const sorted = sortChekisDesc(records);
  return sortOrder === 'asc' ? sorted.reverse() : sorted;
}

function formatRecordMonth(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${year}年${Number(monthNumber)}月`;
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
        title: key === '__undated__' ? '日期未填写' : formatRecordMonth(key),
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
  manualEntries: ChekiManualEntry[],
  columns: ChekiGridColumns,
  sortOrder: ChekiSortOrder,
): ChekiGalleryItem[] {
  const sortedChekis = sortChekiRecords(chekis, sortOrder);
  const sortedManualEntries = sortChekiRecords(manualEntries, sortOrder);
  const items: ChekiGalleryItem[] = chunkChekis(sortedChekis, columns).map((row, index, rows) => ({
    type: 'row',
    key: `album:row:${index}`,
    groupKey: '__album__',
    chekis: row,
    viewerChekis: sortedChekis,
    isLastPhotoRow: index === rows.length - 1 && sortedManualEntries.length === 0,
  }));

  if (sortedManualEntries.length > 0) {
    items.push({
      type: 'manual',
      key: 'album:manual',
      groupKey: '__album__',
      entries: sortedManualEntries,
    });
  }
  return items;
}

function buildDateGroupedAlbumGridItems(
  chekis: Cheki[],
  columns: ChekiGridColumns,
  sortOrder: ChekiSortOrder,
): ChekiGalleryItem[] {
  return buildChekiDateSections(chekis, sortOrder).flatMap(({ key, items }) => {
    const groupChekis = items;
    const rows: ChekiGalleryItem[] = chunkChekis(groupChekis, columns).map((row, index, allRows) => ({
      type: 'row',
      key: `date:${key}:row:${index}`,
      groupKey: `date:${key}`,
      chekis: row,
      viewerChekis: groupChekis,
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

function matchesPeriod(record: { date: string | null; created_at: string }, year?: number, month?: number): boolean {
  if (!year) return true;
  const effective = record.date ?? record.created_at;
  if (month) {
    return effective.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}`;
  }
  return effective.slice(0, 4) === String(year);
}

function matchesDate(record: { date: string | null; created_at: string }, date?: string): boolean {
  if (!date) return true;
  return (record.date ?? record.created_at).slice(0, 10) === date;
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

function parseArtistIdsParam(value: string | string[] | undefined): string[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(rawValues
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean))];
}

function serializeArtistIdsParam(values: string[]): string {
  return [...new Set(values)].join(',');
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

function BrowseModeOptions({
  colors,
  value,
  onChange,
}: {
  colors: ThemeColors;
  value: ChekiBrowseMode;
  onChange: (value: ChekiBrowseMode) => void;
}) {
  const options: Array<{
    value: ChekiBrowseMode;
    label: string;
    icon: 'album' | 'reorder';
  }> = [
    { value: 'album', label: '相册', icon: 'album' },
    { value: 'record', label: '记录', icon: 'reorder' },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
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
              minHeight: 72,
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? colors.accent : colors.inputBorder,
              backgroundColor: selected ? colors.accentSofter : colors.card,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.cardAlt }}>
                <AppIcon name={option.icon} size={17} color={selected ? colors.onAccent : colors.textSecondary} />
              </View>
              <AppIcon
                name="radio"
                variant={selected ? 'selected' : 'unselected'}
                size={18}
                color={selected ? colors.accent : colors.textMuted}
                secondaryColor={colors.card}
              />
            </View>
            <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 20, fontWeight: '800', color: colors.heading }}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function useReducedMotionEnabled(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

export default function ChekiLibraryScreen() {
  const {
    artist_id: filterArtistParam,
    event_id: filterEventId,
    year: yearParam,
    month: monthParam,
    date: dateParam,
    startDate: startDateParam,
    endDate: endDateParam,
    preset: presetParam,
    scope: scopeParamRaw,
  } = useLocalSearchParams<{
    artist_id?: string | string[];
    event_id?: string;
    year?: string;
    month?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    preset?: string;
    scope?: string;
  }>();
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const isAndroid = Platform.OS === 'android';
  const androidHeader = useAndroidCollapsibleTabHeader();
  const iosTabBarScroll = useFloatingTabBarScroll();
  const tabBarScroll = isAndroid ? androidHeader.scrollProps : iosTabBarScroll;
  const reducedMotion = useReducedMotionEnabled();

  const filterYear = yearParam ? Number(yearParam) : undefined;
  const filterMonth = monthParam ? Number(monthParam) : undefined;
  const filterDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
  const filterStartDate = startDateParam && /^\d{4}-\d{2}-\d{2}$/.test(startDateParam) ? startDateParam : undefined;
  const filterEndDate = endDateParam && /^\d{4}-\d{2}-\d{2}$/.test(endDateParam) ? endDateParam : undefined;
  const scopeParam = scopeParamRaw === 'favorite' || scopeParamRaw === 'oshi' ? scopeParamRaw : undefined;
  const selectedArtistIds = useMemo(() => parseArtistIdsParam(filterArtistParam), [filterArtistParam]);
  const hasRecordDeepLink = Boolean(
    filterArtistParam
    || filterEventId
    || filterDate
    || filterStartDate
    || filterYear
    || presetParam === 'all',
  );

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [viewPreferences, setViewPreferences] = useState<ChekiViewPreferences>(DEFAULT_CHEKI_VIEW_PREFERENCES);
  const [viewSettingsVisible, setViewSettingsVisible] = useState(false);
  const [galleryViewportHeight, setGalleryViewportHeight] = useState(0);
  const [galleryHeaderHeight, setGalleryHeaderHeight] = useState(0);
  const galleryContentWidth = Math.max(1, screenWidth - 32);
  const galleryAvailableHeight = Math.max(
    240,
    (galleryViewportHeight || screenHeight) - galleryHeaderHeight - 40,
  );
  const gridLayout = useMemo(
    () => calculateChekiGridLayout({
      density: viewPreferences.density,
      availableWidth: galleryContentWidth,
      availableHeight: galleryAvailableHeight,
      gap: CHEKI_GRID_GAP,
      aspectRatio: viewPreferences.useSpecAspectRatio ? 1 : CHEKI_ASPECT_RATIO,
    }),
    [
      galleryAvailableHeight,
      galleryContentWidth,
      viewPreferences.density,
      viewPreferences.useSpecAspectRatio,
    ],
  );
  const columns = gridLayout.columns;
  const chekiW = gridLayout.itemWidth;
  const chekiH = gridLayout.itemHeight;

  const [chekiList, setChekiList] = useState<Cheki[]>([]);
  const [manualEntries, setManualEntries] = useState<ChekiManualEntry[]>([]);
  const [recordList, setRecordList] = useState<ChekiRecordWithItems[]>([]);
  const [artistMap, setArtistMap] = useState<Map<string, Artist>>(new Map());
  const [eventMap, setEventMap] = useState<Map<string, Event>>(new Map());
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<ChekiDatePickerMode | null>(null);
  const [recordFilters, setRecordFilters] = useState<ChekiRecordFilters>(() => ({
    ...EMPTY_CHEKI_RECORD_FILTERS,
    artistIds: [...selectedArtistIds],
    eventId: filterEventId ?? null,
    date: filterDate
      ? { mode: 'day', startDate: filterDate, endDate: filterDate }
      : filterStartDate && filterEndDate
        ? { mode: 'custom', startDate: filterStartDate, endDate: filterEndDate }
        : filterYear
          ? {
              mode: filterMonth ? 'month' : 'year',
              startDate: filterMonth
                ? `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`
                : `${filterYear}-01-01`,
              endDate: filterMonth
                ? `${filterYear}-${String(filterMonth).padStart(2, '0')}-31`
                : `${filterYear}-12-31`,
            }
          : null,
  }));
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
      if (isActive) setViewPreferences(
        hasRecordDeepLink
          ? { ...preferences, browseMode: 'record' }
          : preferences,
      );
    });
    return () => {
      isActive = false;
    };
  }, [hasRecordDeepLink]);

  useEffect(() => {
    if (!hasRecordDeepLink) return;
    const date = filterDate
      ? { mode: 'day' as const, startDate: filterDate, endDate: filterDate }
      : filterStartDate && filterEndDate
        ? { mode: 'custom' as const, startDate: filterStartDate, endDate: filterEndDate }
        : filterYear
          ? {
              mode: filterMonth ? 'month' as const : 'year' as const,
              startDate: filterMonth
                ? `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`
                : `${filterYear}-01-01`,
              endDate: filterMonth
                ? `${filterYear}-${String(filterMonth).padStart(2, '0')}-${new Date(filterYear, filterMonth, 0).getDate()}`
                : `${filterYear}-12-31`,
            }
          : null;
    setRecordFilters({
      ...EMPTY_CHEKI_RECORD_FILTERS,
      artistIds: [...selectedArtistIds],
      eventId: filterEventId ?? null,
      date,
    });
  }, [filterDate, filterEndDate, filterEventId, filterMonth, filterStartDate, filterYear, hasRecordDeepLink, selectedArtistIds]);

  const load = useCallback(async () => {
    const [chekis, manual, records, artists, events, config] = await Promise.all([
      db.cheki.findAll(),
      db.chekiManualEntries.findAll(),
      db.chekiRecords.findRecords(),
      db.artists.findAll(),
      db.events.findAll(),
      db.userConfig.getConfig(),
    ]);
    setChekiList(chekis);
    setManualEntries(manual);
    setRecordList(records);
    setArtistMap(new Map(artists.map((artist) => [artist.id, artist])));
    setEventMap(new Map(events.map((event) => [event.id, event])));
    setOshiArtistId(config.oshi_artist_id);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 收藏 / 单推范围：包含艺人本人 + 沿 parent_id 递归向上的所属团体
  const scopeArtistIds = useMemo<Set<string> | null>(() => {
    if (!scopeParam) return null;
    const ids = new Set<string>();
    const climb = (startId: string | null) => {
      let cursor = startId;
      while (cursor && !ids.has(cursor)) {
        ids.add(cursor);
        cursor = artistMap.get(cursor)?.parent_id ?? null;
      }
    };
    if (scopeParam === 'oshi') {
      climb(oshiArtistId);
    } else {
      for (const artist of artistMap.values()) {
        if (artist.is_favorite === 1) climb(artist.id);
      }
    }
    return ids;
  }, [scopeParam, oshiArtistId, artistMap]);

  const matchesScope = useCallback((artistId: string | null) => {
    if (!scopeArtistIds) return true;
    if (!artistId) return false;
    return scopeArtistIds.has(artistId);
  }, [scopeArtistIds]);

  // 指定艺人筛选：每个已选艺人都包含本人 + 沿 parent_id 递归向上的所属团体（与统计/单推口径一致）
  const filterArtistIds = useMemo<Set<string> | null>(() => {
    if (appliedArtistIds.length === 0) return null;
    const ids = new Set<string>();
    for (const selectedArtistId of appliedArtistIds) {
      let cursor: string | null = selectedArtistId;
      while (cursor && !ids.has(cursor)) {
        ids.add(cursor);
        cursor = artistMap.get(cursor)?.parent_id ?? null;
      }
    }
    return ids;
  }, [appliedArtistIds, artistMap]);

  const matchesArtist = useCallback((artistId: string | null) => {
    if (!filterArtistIds) return true;
    if (!artistId) return false;
    return filterArtistIds.has(artistId);
  }, [filterArtistIds]);

  const filteredChekiList = useMemo(
    () => chekiList.filter((cheki) => {
      if (!matchesArtist(cheki.artist_id)) return false;
      if (appliedEventId && cheki.event_id !== appliedEventId) return false;
      if (appliedDate && !matchesDateRange(cheki, appliedDate.startDate, appliedDate.endDate)) return false;
      if (!matchesChekiKeyword(cheki, keyword, artistMap)) return false;
      if (!isRecordMode) {
        if (itemFilters.specs.length > 0 && !itemFilters.specs.includes(normalizeChekiSpec(cheki.spec))) return false;
        if (itemFilters.hasLinkedEvent && !cheki.event_id) return false;
        if (itemFilters.hasNotes && !cheki.notes?.trim()) return false;
        if (itemFilters.isFavorite && cheki.is_favorite !== 1) return false;
        if (itemFilters.hasBackImage && !cheki.back_photo_uri) return false;
      }
      return true;
    }),
    [
      chekiList,
      matchesArtist,
      appliedEventId,
      appliedDate,
      keyword,
      artistMap,
      isRecordMode,
      itemFilters,
    ],
  );
  const filteredManualEntries = useMemo(
    () => manualEntries.filter((entry) => {
      if (!isRecordMode) return false;
      if (!matchesArtist(entry.artist_id)) return false;
      if (appliedEventId && entry.event_id !== appliedEventId) return false;
      if (appliedDate && !matchesDateRange(entry, appliedDate.startDate, appliedDate.endDate)) return false;
      if (!matchesChekiKeyword(entry, keyword, artistMap)) return false;
      if (recordFilters.hasLinkedEvent && !entry.event_id) return false;
      if (recordFilters.hasNotes) return false;
      if (recordFilters.hasBackImage) return false;
      return true;
    }),
    [
      manualEntries,
      isRecordMode,
      matchesArtist,
      appliedEventId,
      appliedDate,
      keyword,
      artistMap,
      recordFilters,
    ],
  );
  const filteredRecordList = useMemo(
    () => recordList.filter((record) => {
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

      const normalizedKeyword = keyword.trim().toLowerCase();
      if (!normalizedKeyword) return true;
      const artist = record.artist_id ? artistMap.get(record.artist_id) : null;
      const event = record.event_id ? eventMap.get(record.event_id) : null;
      const searchableText = [
        record.date,
        record.notes,
        artist ? getArtistSearchText(artist, artistMap) : '未关联艺人',
        event?.title,
        ...record.items.map((item) => item.notes),
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedKeyword);
    }),
    [
      recordList,
      matchesArtist,
      recordFilters,
      keyword,
      artistMap,
      eventMap,
    ],
  );

  const distinctYears = useMemo(() => {
    const years = new Set<string>();
    for (const record of recordList) years.add(recordYear(record));
    return [...years]
      .filter((year) => /^\d{4}$/.test(year))
      .sort((a, b) => b.localeCompare(a));
  }, [recordList]);

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
    () => groupChekiRecordsByArtist(filteredChekiList, filteredManualEntries, artistMap, oshiArtistId),
    [filteredChekiList, filteredManualEntries, artistMap, oshiArtistId],
  );
  const galleryItems = useMemo(() => {
    if (viewPreferences.browseMode === 'record') {
      return buildRecordMonthItems(filteredRecordList, viewPreferences.recordSortOrder);
    }

    if (viewPreferences.albumGrouping === 'none') {
      return buildAlbumGridItems(filteredChekiList, [], columns, viewPreferences.albumSortOrder);
    }

    if (viewPreferences.albumGrouping === 'date') {
      return buildDateGroupedAlbumGridItems(filteredChekiList, columns, viewPreferences.albumSortOrder);
    }

    const sortedGroups = groups.map((group) => ({
      ...group,
      chekis: sortChekiRecords(group.chekis, viewPreferences.albumSortOrder),
      manualEntries: [],
      totalCount: group.chekis.length,
    })).filter((group) => group.chekis.length > 0);
    return buildArtistGridItems(sortedGroups, columns);
  }, [
    columns,
    filteredChekiList,
    filteredManualEntries,
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
  const filterEvent = filterEventId ? eventMap.get(filterEventId) ?? null : null;
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
    const selected = new Set(draftArtistIds);
    const allSelected = batch.length > 0 && batch.every((id) => selected.has(id));
    for (const id of batch) {
      if (allSelected) selected.delete(id);
      else selected.add(id);
    }
    setDraftArtistIds([...selected]);
  }, [draftArtistIds, setDraftArtistIds]);
  const filterHeader = (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ marginBottom: 10, fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>日期</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([
          ['day', '日'],
          ['month', '月'],
          ['year', '年'],
          ['custom', '自定义'],
        ] as const).map(([mode, label]) => (
          <TouchableOpacity
            key={mode}
            onPress={() => {
              setFilterVisible(false);
              setDatePickerMode(mode);
            }}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: draftDate?.mode === mode ? colors.accent : colors.cardAlt }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: draftDate?.mode === mode ? colors.onAccent : colors.text }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {draftDate ? (
        <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>{formatChekiDateFilter(draftDate)}</Text>
      ) : null}
    </View>
  );

  const filterSections = useMemo<FilterSection[]>(() => {
    const result: FilterSection[] = [];
    // 日期之下统一为「其他条件」：正向开关 chips 横向排列、独立切换，规格放在最后一位
    const otherGroups: FilterChipGroup[] = [];
    if (isRecordMode) {
      otherGroups.push({
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

    // 艺人：单推 / 收藏艺人快捷 chip 放在选择器上方
    const oshiSelected = Boolean(oshiArtistId && draftArtistIds.includes(oshiArtistId));
    const favoritesSelected = favoriteArtistIds.length > 0 && favoriteArtistIds.every((id) => draftArtistIds.includes(id));
    result.push({
      key: 'artist',
      title: '艺人',
      value: null,
      values: draftArtistIds,
      multiple: true,
      onChange: (value) => setDraftArtistIds(value ? [value] : []),
      onValuesChange: setDraftArtistIds,
      allLabel: '全部艺人',
      search: { placeholder: '搜索艺人…' },
      beforeContent: (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => toggleArtistBatch(oshiArtistId ? [oshiArtistId] : [])}
            disabled={!oshiArtistId}
            accessibilityRole="button"
            accessibilityLabel="单推"
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 99,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: oshiSelected ? colors.accent : isDark ? colors.input : colors.cardAlt,
              borderColor: oshiSelected ? colors.accent : colors.inputBorder,
              opacity: oshiArtistId ? 1 : 0.4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: oshiSelected ? colors.onAccent : colors.textSecondary }}>单推</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleArtistBatch(favoriteArtistIds)}
            disabled={favoriteArtistIds.length === 0}
            accessibilityRole="button"
            accessibilityLabel="收藏艺人"
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 99,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: favoritesSelected ? colors.accent : isDark ? colors.input : colors.cardAlt,
              borderColor: favoritesSelected ? colors.accent : colors.inputBorder,
              opacity: favoriteArtistIds.length > 0 ? 1 : 0.4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: favoritesSelected ? colors.onAccent : colors.textSecondary }}>收藏艺人</Text>
          </TouchableOpacity>
        </View>
      ),
      options: sortArtistsWithOshi(distinctArtists, oshiArtistId).map((artist) => {
        const label = getArtistPrimaryName(artist);
        return {
          value: artist.id,
          label,
          searchText: getArtistSearchText(artist, artistMap),
          subtitle: label !== artist.name ? artist.name : undefined,
          artist,
          parentName: artist.parent_id ? artistMap.get(artist.parent_id)?.short_name || artistMap.get(artist.parent_id)?.name : undefined,
          isOshi: artist.id === oshiArtistId,
        };
      }),
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
  const hasAnyFilter = keyword.trim().length > 0 || activeFilterCount > 0;

  const clearFilter = useCallback(() => {
    setKeyword('');
    if (isRecordMode) setRecordFilters(cloneChekiRecordFilters(EMPTY_CHEKI_RECORD_FILTERS));
    else setItemFilters(cloneChekiItemFilters(EMPTY_CHEKI_ITEM_FILTERS));
  }, [isRecordMode]);

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

  const handleChangeSpecAspectRatio = useCallback((useSpecAspectRatio: boolean) => {
    persistViewPreferences({ ...viewPreferences, useSpecAspectRatio });
  }, [persistViewPreferences, viewPreferences]);

  const activeSearchFilters = useMemo(() => {
    const filters: Array<{ id: string; label: string; onPress: () => void }> = [];
    const dateLabel = formatChekiDateFilter(appliedDate);
    if (dateLabel) {
      filters.push({
        id: 'date',
        label: dateLabel,
        onPress: () => {
          if (isRecordMode) setRecordFilters((current) => ({ ...current, date: null }));
          else setItemFilters((current) => ({ ...current, date: null }));
        },
      });
    }
    if (appliedArtistIds.length > 0) {
      filters.push({
        id: 'artists',
        label: appliedArtistIds.length === 1
          ? getArtistPrimaryName(artistMap.get(appliedArtistIds[0])!)
          : `${appliedArtistIds.length} 位艺人`,
        onPress: () => {
          if (isRecordMode) setRecordFilters((current) => ({ ...current, artistIds: [] }));
          else setItemFilters((current) => ({ ...current, artistIds: [] }));
        },
      });
    }
    if (isRecordMode && recordFilters.imageStatus) {
      filters.push({
        id: 'image-status',
        label: recordFilters.imageStatus === 'none' ? '无图片' : recordFilters.imageStatus === 'partial' ? '部分有图' : '全部有图',
        onPress: () => setRecordFilters((current) => ({ ...current, imageStatus: null })),
      });
    }
    if (!isRecordMode && itemFilters.specs.length > 0) {
      filters.push({
        id: 'specs',
        label: itemFilters.specs.length === 1
          ? CHEKI_SPECS.find((spec) => spec.id === itemFilters.specs[0])!.label
          : `${itemFilters.specs.length} 种规格`,
        onPress: () => setItemFilters((current) => ({ ...current, specs: [] })),
      });
    }
    if (isRecordMode && recordFilters.eventId) {
      filters.push({
        id: 'event',
        label: `活动：${eventMap.get(recordFilters.eventId)?.title ?? '指定活动'}`,
        onPress: () => setRecordFilters((current) => ({ ...current, eventId: null })),
      });
    }
    const hasLinkedEvent = isRecordMode ? recordFilters.hasLinkedEvent : itemFilters.hasLinkedEvent;
    const hasNotes = isRecordMode ? recordFilters.hasNotes : itemFilters.hasNotes;
    if (hasLinkedEvent && (!isRecordMode || !recordFilters.eventId)) {
      filters.push({
        id: 'linked-event',
        label: '已关联活动',
        onPress: () => {
          if (isRecordMode) setRecordFilters((current) => ({ ...current, hasLinkedEvent: false }));
          else setItemFilters((current) => ({ ...current, hasLinkedEvent: false }));
        },
      });
    }
    if (hasNotes) {
      filters.push({
        id: 'notes',
        label: '有备注',
        onPress: () => {
          if (isRecordMode) setRecordFilters((current) => ({ ...current, hasNotes: false }));
          else setItemFilters((current) => ({ ...current, hasNotes: false }));
        },
      });
    }
    if (!isRecordMode && itemFilters.isFavorite) {
      filters.push({
        id: 'favorite',
        label: '已收藏',
        onPress: () => setItemFilters((current) => ({ ...current, isFavorite: false })),
      });
    }
    if (isRecordMode ? recordFilters.hasBackImage : itemFilters.hasBackImage) {
      filters.push({
        id: 'back-image',
        label: '有背签',
        onPress: () => {
          if (isRecordMode) setRecordFilters((current) => ({ ...current, hasBackImage: false }));
          else setItemFilters((current) => ({ ...current, hasBackImage: false }));
        },
      });
    }
    return filters;
  }, [
    appliedArtistIds,
    appliedDate,
    artistMap,
    eventMap,
    isRecordMode,
    itemFilters,
    recordFilters,
  ]);
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
            await db.cheki.delete(chekiId);
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
    const itemId = item.itemId ?? item.id;
    const update = (chekis: Cheki[], isFavorite: boolean): Cheki[] => {
      const favoriteValue: Cheki['is_favorite'] = isFavorite ? 1 : 0;
      return chekis.map((cheki) => (
        cheki.id === itemId ? { ...cheki, is_favorite: favoriteValue } : cheki
      ));
    };
    setChekiList((current) => update(current, nextFavorite));
    setViewerState((current) => current ? {
      ...current,
      chekis: update(current.chekis, nextFavorite),
    } : current);
    try {
      await db.cheki.setFavorite(itemId, nextFavorite);
    } catch {
      setChekiList((current) => update(current, !nextFavorite));
      setViewerState((current) => current ? {
        ...current,
        chekis: update(current.chekis, !nextFavorite),
      } : current);
      Alert.alert('无法更新收藏', '请稍后再试。');
    }
  }, [db]);

  const renderHeaderActions = useCallback(() => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 4 }}>
      <TouchableOpacity
        accessibilityLabel="电子切册显示选项"
        accessibilityRole="button"
        onPress={() => setViewSettingsVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <AppIcon name="settings" size={22} color={colors.accent} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="添加拍立得记录"
        accessibilityRole="button"
        onPress={openUnifiedCreate}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

    if (item.type === 'notice') {
      return (
        <View style={{
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
          backgroundColor: isDark ? colors.card : colors.accentSofter,
        }}>
          <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.textSecondary }}>
            {item.text}
          </Text>
        </View>
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
            <OshiAvatar source={groupAvatarSrc} size={isOshi ? 36 : 32} isOshi={isOshi} />
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

    if (item.type === 'manual') {
      return (
        <View style={{ marginBottom: 24 }}>
          <ChekiManualEntryList
            entries={item.entries}
            eventMap={eventMap}
            isDark={isDark}
            artistMap={artistMap}
            oshiArtistId={oshiArtistId}
            showArtistMeta={viewPreferences.albumGrouping !== 'artist'}
            onPressEntry={(entry) => router.push(`/cheki/records/${entry.id}`)}
          />
        </View>
      );
    }

    return (
      <View style={{ flexDirection: 'row', gap: CHEKI_GRID_GAP, marginBottom: item.isLastPhotoRow ? 24 : CHEKI_GRID_GAP }}>
        {item.chekis.map((cheki) => (
          <ChekiThumbnailButton
            key={cheki.id}
            cheki={cheki}
            viewerChekis={item.viewerChekis}
            width={chekiW}
            height={chekiH}
            colors={colors}
            onOpen={openViewer}
            useSpecAspectRatio={viewPreferences.useSpecAspectRatio}
          />
        ))}
      </View>
    );
  }, [
    artistNameMap,
    chekiH,
    chekiW,
    colors,
    columns,
    eventMap,
    isDark,
    openViewer,
    oshiArtistId,
    viewPreferences.albumGrouping,
    viewPreferences.showRecordThumbnails,
    viewPreferences.useSpecAspectRatio,
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
              placeholder={isRecordMode ? '搜索记录' : '搜索拍立得'}
              onOpenFilter={() => {
                if (isRecordMode) {
                  setRecordFilterDraft(cloneChekiRecordFilters(recordFilters));
                } else {
                  setItemFilterDraft(cloneChekiItemFilters(itemFilters));
                }
                setFilterVisible(true);
              }}
              activeFilters={activeSearchFilters}
              activeCount={activeFilterCount}
              isDark={isDark}
            />
          </View>
        </>
      }
      ListEmptyComponent={
        hasAnyFilter ? (
          <FilteredEmptyState
            title={isRecordMode ? '没有符合条件的记录' : '没有符合条件的拍立得'}
            message="尝试其他关键词或筛选条件。"
            onClear={clearFilter}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        >
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '800', color: colors.heading }}>
              浏览模式
            </Text>
            <View style={{ marginTop: 12 }}>
              <BrowseModeOptions
                colors={colors}
                value={viewPreferences.browseMode}
                onChange={handleChangeBrowseMode}
              />
            </View>
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
                    展示比例
                  </Text>
                  <SegmentedOptions
                    colors={colors}
                    options={[
                      { value: 'uniform', label: '统一比例' },
                      { value: 'spec', label: '按规格' },
                    ]}
                    value={viewPreferences.useSpecAspectRatio ? 'spec' : 'uniform'}
                    onChange={(value) => handleChangeSpecAspectRatio(value === 'spec')}
                  />
                </View>
              </View>
            )}
          </View>
        </BottomSheetDialog>
    </>
  );

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

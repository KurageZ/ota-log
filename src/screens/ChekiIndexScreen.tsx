import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Alert, Image, Switch, useWindowDimensions, ScrollView, AccessibilityInfo, Platform, type LayoutChangeEvent,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInUp,
  FadeOut,
  interpolate,
  Keyframe,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
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
import { ChekiStackPreviewCard } from '../components/ChekiStackPreviewCard';
import { ChekiRecordListItem } from '../components/ChekiRecordListItem';
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
  ChekiItemLayout,
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

function recordYear(record: { date: string | null; created_at: string }): string {
  return (record.date ?? record.created_at).slice(0, 4);
}

type ChekiGalleryItem =
  | { type: 'record'; key: string; record: ChekiRecordWithItems }
  | { type: 'header'; key: string; groupKey: string; group: ChekiArtistGroup }
  | { type: 'dateHeader'; key: string; date: string }
  | { type: 'row'; key: string; groupKey: string; chekis: Cheki[]; viewerChekis: Cheki[]; isLastPhotoRow: boolean }
  | { type: 'stack'; key: string; stackKey: string; title: string; chekis: Cheki[]; manualEntries: ChekiManualEntry[]; totalCount: number; totalPrice: number; artist: Artist | null }
  | { type: 'stackExpandedRow'; key: string; stackKey: string; chekis: Cheki[]; viewerChekis: Cheki[]; isLastPhotoRow: boolean; insideStackCard: boolean }
  | { type: 'stackExpandedManual'; key: string; stackKey: string; entries: ChekiManualEntry[]; hasPhotos: boolean; insideStackCard: boolean }
  | { type: 'manual'; key: string; groupKey: string; entries: ChekiManualEntry[] }
  | { type: 'notice'; key: string; text: string };

const CHEKI_GRID_GAP = 8;
const CHEKI_ASPECT_RATIO = 86 / 54;
const CHEKI_STACK_PREVIEW_LIMIT = 10;
const CHEKI_STACK_ANIMATION_MS = 260;
const CHEKI_STACK_REVEAL_MS = 190;
const CHEKI_FRAME_RADIUS = 11;
const CHEKI_BARE_THUMBNAIL_RADIUS = 10;
const CHEKI_GRID_DENSITY_LABELS: Record<ChekiGridDensity, string> = {
  large: '大图',
  medium: '中图',
  small: '小图',
};
const chekiStackLayoutTransition = LinearTransition
  .duration(220)
  .easing(Easing.out(Easing.cubic));
const chekiStackEntering = FadeIn
  .duration(CHEKI_STACK_REVEAL_MS)
  .easing(Easing.out(Easing.cubic));
const chekiStackExiting = FadeOut
  .duration(120)
  .easing(Easing.out(Easing.cubic));
const chekiStackContentEntering = FadeInUp
  .duration(CHEKI_STACK_REVEAL_MS)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ opacity: 0, transform: [{ translateY: -6 }] });
const chekiStackContentExiting = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: -6 }], easing: Easing.out(Easing.cubic) },
}).duration(110);

function getChekiFrameInsets(width: number): { side: number; top: number; bottom: number } {
  if (width < 76) return { side: 3, top: 3, bottom: 5 };
  if (width < 96) return { side: 4, top: 4, bottom: 7 };
  return { side: 5, top: 5, bottom: 9 };
}

type ChekiThumbnailChrome = 'framed' | 'bare';

function ChekiGridThumbnail({
  uri,
  width,
  height,
  colors,
  chrome = 'framed',
  imageRef,
  aspectRatio,
}: {
  uri: string;
  width: number;
  height: number;
  colors: ThemeColors;
  chrome?: ChekiThumbnailChrome;
  imageRef?: Ref<Image>;
  aspectRatio: number;
}) {
  const fitInside = (maxWidth: number, maxHeight: number) => {
    const widthFromHeight = maxHeight * aspectRatio;
    return widthFromHeight <= maxWidth
      ? { width: widthFromHeight, height: maxHeight }
      : { width: maxWidth, height: maxWidth / aspectRatio };
  };
  if (chrome === 'bare') {
    const fitted = fitInside(width, height);
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          ref={imageRef}
          source={{ uri }}
          resizeMethod="resize"
          resizeMode="contain"
          style={{
            ...fitted,
            borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
            backgroundColor: colors.cardAlt,
          }}
        />
      </View>
    );
  }

  const frameInsets = getChekiFrameInsets(width);
  const innerWidth = Math.max(1, width - frameInsets.side * 2);
  const innerHeight = Math.max(1, height - frameInsets.top - frameInsets.bottom);
  const fitted = fitInside(innerWidth, innerHeight);

  return (
    <View style={{
      width,
      height,
      paddingLeft: frameInsets.side,
      paddingRight: frameInsets.side,
      paddingTop: frameInsets.top,
      paddingBottom: frameInsets.bottom,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: CHEKI_FRAME_RADIUS,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.card,
    }}>
      <Image
        ref={imageRef}
        source={{ uri }}
        resizeMethod="resize"
        resizeMode="contain"
        style={{
          ...fitted,
          borderRadius: Math.max(6, CHEKI_FRAME_RADIUS - frameInsets.side),
          backgroundColor: colors.cardAlt,
        }}
      />
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
  chrome = 'framed',
}: {
  cheki: Cheki;
  viewerChekis: Cheki[];
  width: number;
  height: number;
  colors: ThemeColors;
  onOpen: (cheki: Cheki, chekis: Cheki[], origin: FullscreenImageTransitionOrigin | null) => void;
  chrome?: ChekiThumbnailChrome;
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

    const borderRadius = chrome === 'bare'
      ? CHEKI_BARE_THUMBNAIL_RADIUS
      : Math.max(6, CHEKI_FRAME_RADIUS - getChekiFrameInsets(width).side);
    cancelPendingMeasurementRef.current = measureImageTransitionOrigin(
      node,
      borderRadius,
      (origin) => {
        cancelPendingMeasurementRef.current = null;
        onOpen(cheki, viewerChekis, origin);
      },
    );
  }, [cheki, chrome, onOpen, viewerChekis, width]);

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
          chrome={chrome}
          imageRef={thumbnailImageRef}
          aspectRatio={getChekiSpecAspectRatio(normalizeChekiSpec(cheki.spec))}
        />
      </TouchableOpacity>
    </View>
  );
}

function ChekiDateSectionHeader({
  title,
  totalCount,
  expanded,
  colors,
  onPress,
}: {
  title: string;
  totalCount: number;
  expanded: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}，${totalCount}张拍立得，${expanded ? '收起' : '展开'}`}
      style={{ minHeight: 44, marginTop: 6, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent }} />
      <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 17, lineHeight: 35, fontWeight: '700', color: colors.heading }}>
        {title}
      </Text>
      <View style={{ borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.accentSofter }}>
        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '900', color: colors.accent }}>
          {totalCount}张
        </Text>
      </View>
      <AppIcon name="chevron" variant={expanded ? 'up' : 'down'} size={16} color={colors.accent} />
    </TouchableOpacity>
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

function buildManualArtistSummaries(
  entries: ChekiManualEntry[],
  artistMap: Map<string, Artist>,
  oshiArtistId: string | null,
) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.artist_id, (counts.get(entry.artist_id) ?? 0) + entry.count);
  }

  return Array.from(counts.entries())
    .map(([artistId, count]) => {
      const artist = artistMap.get(artistId);
      return artist ? {
        id: artist.id,
        name: getArtistPrimaryName(artist),
        avatarUri: artist.avatar_uri,
        isOshi: artist.id === oshiArtistId,
        count,
      } : null;
    })
    .filter((item): item is {
      id: string;
      name: string;
      avatarUri: string | null;
      isOshi: boolean;
      count: number;
    } => item !== null)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function appendExpandedStackItems(items: ChekiGalleryItem[], expandedStacks: Set<string>, columns: ChekiGridColumns): ChekiGalleryItem[] {
  const result: ChekiGalleryItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.type !== 'stack' || !expandedStacks.has(item.stackKey)) continue;

    const insideStackCard = item.stackKey.startsWith('artist:');

    chunkChekis(item.chekis, columns).forEach((row, rowIndex, rows) => {
      result.push({
        type: 'stackExpandedRow',
        key: `${item.stackKey}:expanded-row:${rowIndex}`,
        stackKey: item.stackKey,
        chekis: row,
        viewerChekis: item.chekis,
        isLastPhotoRow: rowIndex === rows.length - 1 && item.manualEntries.length === 0,
        insideStackCard,
      });
    });

    if (item.manualEntries.length > 0) {
      result.push({
        type: 'stackExpandedManual',
        key: `${item.stackKey}:expanded-manual`,
        stackKey: item.stackKey,
        entries: item.manualEntries,
        hasPhotos: item.chekis.length > 0,
        insideStackCard,
      });
    }
  }
  return result;
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
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 34,
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

type ChekiStackGalleryItem = Extract<ChekiGalleryItem, { type: 'stack' }>;

function AnimatedChekiStackPhoto({
  cheki,
  index,
  total,
  columns,
  cardWidth,
  cardHeight,
  areaWidth,
  previewScale,
  progress,
  colors,
  isDark,
  expanded,
  renderImage,
  onPress,
}: {
  cheki: Cheki;
  index: number;
  total: number;
  columns: ChekiGridColumns;
  cardWidth: number;
  cardHeight: number;
  areaWidth: number;
  previewScale: number;
  progress: SharedValue<number>;
  colors: ThemeColors;
  isDark: boolean;
  expanded: boolean;
  renderImage: boolean;
  onPress: () => void;
}) {
  const previewCount = Math.min(total, CHEKI_STACK_PREVIEW_LIMIT);
  const previewIndex = Math.min(index, Math.max(0, previewCount - 1));
  const previewStep = previewCount > 1
    ? Math.min(42, Math.max(12, (areaWidth - cardWidth * previewScale) / (previewCount - 0.2)))
    : 0;
  const previewWidth = cardWidth * previewScale + previewStep * Math.max(0, previewCount - 1);
  const previewStart = Math.max(0, (areaWidth - previewWidth) / 2);
  const collapsedX = previewStart + previewIndex * previewStep;
  const collapsedY = 9;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const gridX = column * (cardWidth + CHEKI_GRID_GAP);
  const gridY = row * (cardHeight + CHEKI_GRID_GAP);
  const hiddenInStack = index >= previewCount;
  const extraCount = index === previewCount - 1 ? total - previewCount : 0;

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = hiddenInStack
      ? interpolate(progress.value, [0, 0.18, 1], [0, 0, 1], Extrapolation.CLAMP)
      : 1;
    return {
      opacity,
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [collapsedX, gridX]) },
        { translateY: interpolate(progress.value, [0, 1], [collapsedY, gridY]) },
        { scale: interpolate(progress.value, [0, 1], [previewScale, 1]) },
      ],
    };
  }, [
    collapsedX,
    collapsedY,
    gridX,
    gridY,
    hiddenInStack,
    previewScale,
  ]);

  return (
    <Animated.View
      pointerEvents={hiddenInStack && !expanded ? 'none' : 'auto'}
      style={[{
        position: 'absolute',
        left: 0,
        top: 0,
        width: cardWidth,
        height: cardHeight,
        zIndex: expanded ? 1 : CHEKI_STACK_PREVIEW_LIMIT - previewIndex,
      }, animatedStyle]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        style={{
          width: cardWidth,
          height: cardHeight,
        }}
      >
        {renderImage ? (
          <ChekiGridThumbnail
            uri={cheki.photo_uri}
            width={cardWidth}
            height={cardHeight}
            colors={colors}
            aspectRatio={getChekiSpecAspectRatio(normalizeChekiSpec(cheki.spec))}
          />
        ) : null}
        {!expanded && extraCount > 0 ? (
          <View style={{
            position: 'absolute',
            right: 5,
            bottom: 7,
            borderRadius: 999,
            paddingHorizontal: 7,
            paddingVertical: 2,
            backgroundColor: isDark ? withAlpha(colors.heading, 0.84) : withAlpha(colors.text, 0.84),
          }}>
            <Text style={{ fontSize: 10, lineHeight: 13, fontWeight: '900', color: colors.card }}>
              +{extraCount}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

function ChekiSpreadStackCard({
  item,
  expanded,
  columns,
  cardWidth,
  cardHeight,
  colors,
  isDark,
  oshiArtistId,
  onToggle,
}: {
  item: ChekiStackGalleryItem;
  expanded: boolean;
  columns: ChekiGridColumns;
  cardWidth: number;
  cardHeight: number;
  colors: ThemeColors;
  isDark: boolean;
  oshiArtistId: string | null;
  onToggle: () => void;
}) {
  const reducedMotion = useReducedMotionEnabled();
  const progress = useSharedValue(expanded ? 1 : 0);
  const previewChekis = useMemo(
    () => item.chekis.slice(0, CHEKI_STACK_PREVIEW_LIMIT),
    [item.chekis],
  );
  const areaWidth = columns * cardWidth + (columns - 1) * CHEKI_GRID_GAP;
  const previewScale = Math.min(0.78, Math.max(0.48, 78 / cardWidth));
  const previewHeight = cardHeight * previewScale;
  const collapsedAreaHeight = item.chekis.length > 0 ? previewHeight + 20 : 0;
  const areaHeight = collapsedAreaHeight;
  const groupAvatarSrc = item.artist ? resolveAvatarSource(item.artist.avatar_uri) : null;
  const isOshi = item.artist?.id === oshiArtistId;
  const hasExpandedContent = expanded && (item.chekis.length > 0 || item.manualEntries.length > 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: reducedMotion ? 1 : CHEKI_STACK_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress, reducedMotion]);

  return (
    <View style={{
      borderRadius: 18,
      borderBottomLeftRadius: hasExpandedContent ? 0 : 18,
      borderBottomRightRadius: hasExpandedContent ? 0 : 18,
      backgroundColor: colors.card,
      marginBottom: hasExpandedContent ? 0 : 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 14,
      elevation: 3,
    }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}，${expanded ? '收起拍立得堆叠' : '展开拍立得堆叠'}`}
        style={{
          minHeight: 74,
          paddingHorizontal: 14,
          paddingTop: 13,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View style={{ width: 40, height: 40 }}>
          <OshiAvatar source={groupAvatarSrc} size={isOshi ? 40 : 36} isOshi={isOshi} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, lineHeight: 30, fontWeight: '800', color: colors.heading }}>
              {item.title}
            </Text>
            {isOshi ? <OshiBadge /> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          <View style={{ borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.accentSofter }}>
            <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '900', color: colors.accent }}>
              {item.totalCount}张
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '800', color: colors.accent }}>
              {expanded ? '收起' : '展开'}
            </Text>
            <AppIcon name="chevron" variant={expanded ? 'up' : 'down'} size={15} color={colors.accent} />
          </View>
        </View>
      </TouchableOpacity>

      {item.chekis.length > 0 && !expanded ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <Animated.View style={{ width: areaWidth, height: areaHeight, position: 'relative', overflow: 'visible' }}>
            {previewChekis.map((cheki, index) => (
              <AnimatedChekiStackPhoto
                key={cheki.id}
                cheki={cheki}
                index={index}
                total={item.chekis.length}
                columns={columns}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                areaWidth={areaWidth}
                previewScale={previewScale}
                progress={progress}
                colors={colors}
                isDark={isDark}
                expanded={expanded}
                renderImage
                onPress={onToggle}
              />
            ))}
          </Animated.View>
        </View>
      ) : item.chekis.length === 0 ? (
        <TouchableOpacity
          activeOpacity={1}
          onPress={onToggle}
          style={{ paddingHorizontal: 14, paddingBottom: 14 }}
        >
          <View style={{
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: colors.accentSofter,
          }}>
            <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.textSecondary }}>
              这一组只有记录。
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

    </View>
  );
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
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());
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
      aspectRatio: CHEKI_ASPECT_RATIO,
    }),
    [galleryAvailableHeight, galleryContentWidth, viewPreferences.density],
  );
  const columns = gridLayout.columns;
  const chekiW = gridLayout.itemWidth;
  const chekiH = gridLayout.itemHeight;
  const stackContentWidth = Math.max(1, screenWidth - 32 - 28);
  const stackChekiW = Math.floor((stackContentWidth - CHEKI_GRID_GAP * (columns - 1)) / columns);
  const stackChekiH = Math.round(stackChekiW * CHEKI_ASPECT_RATIO);

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
      return sortChekiRecords(filteredRecordList, viewPreferences.sortOrder).map((record) => ({
        type: 'record' as const,
        key: `record:${record.id}`,
        record,
      }));
    }

    if (viewPreferences.itemLayout === 'album') {
      return buildAlbumGridItems(filteredChekiList, filteredManualEntries, columns, viewPreferences.sortOrder);
    }

    return buildArtistGridItems(groups, columns);
  }, [
    columns,
    filteredChekiList,
    filteredManualEntries,
    filteredRecordList,
    groups,
    viewPreferences.browseMode,
    viewPreferences.itemLayout,
    viewPreferences.sortOrder,
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
          ['custom', '自定范围'],
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
          { value: 'partial', label: '部分添加' },
          { value: 'complete', label: '已完整' },
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
      { value: 'with_notes', label: '已有备注' },
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
    setExpandedStacks(new Set());
    void saveChekiViewPreferences(nextPreferences);
  }, []);

  const handleChangeBrowseMode = useCallback((browseMode: ChekiBrowseMode) => {
    persistViewPreferences({
      ...viewPreferences,
      browseMode,
    });
  }, [persistViewPreferences, viewPreferences]);

  const handleChangeItemLayout = useCallback((itemLayout: ChekiItemLayout) => {
    persistViewPreferences({ ...viewPreferences, itemLayout });
  }, [persistViewPreferences, viewPreferences]);

  const handleChangeSortOrder = useCallback((sortOrder: ChekiSortOrder) => {
    persistViewPreferences({ ...viewPreferences, sortOrder });
  }, [persistViewPreferences, viewPreferences]);

  const handleChangeDensity = useCallback((density: ChekiGridDensity) => {
    persistViewPreferences({ ...viewPreferences, density });
  }, [persistViewPreferences, viewPreferences]);

  const handleChangeRecordThumbnails = useCallback((showRecordThumbnails: boolean) => {
    persistViewPreferences({ ...viewPreferences, showRecordThumbnails });
  }, [persistViewPreferences, viewPreferences]);

  const toggleStack = useCallback((stackKey: string) => {
    setExpandedStacks((current) => {
      const next = new Set(current);
      if (next.has(stackKey)) next.delete(stackKey);
      else next.add(stackKey);
      return next;
    });
  }, []);

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
          : `艺人 ${appliedArtistIds.length} 位`,
        onPress: () => {
          if (isRecordMode) setRecordFilters((current) => ({ ...current, artistIds: [] }));
          else setItemFilters((current) => ({ ...current, artistIds: [] }));
        },
      });
    }
    if (isRecordMode && recordFilters.imageStatus) {
      filters.push({
        id: 'image-status',
        label: recordFilters.imageStatus === 'none' ? '无图片' : recordFilters.imageStatus === 'partial' ? '部分添加' : '已完整',
        onPress: () => setRecordFilters((current) => ({ ...current, imageStatus: null })),
      });
    }
    if (!isRecordMode && itemFilters.specs.length > 0) {
      filters.push({
        id: 'specs',
        label: itemFilters.specs.length === 1
          ? CHEKI_SPECS.find((spec) => spec.id === itemFilters.specs[0])!.label
          : `规格 ${itemFilters.specs.length} 种`,
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
        label: '已有备注',
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
    Alert.alert('删除拍立得', '确认删除这张拍立得？', [
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
      Alert.alert('收藏失败', '暂时无法更新收藏状态，请稍后重试。');
    }
  }, [db]);

  const renderHeaderActions = useCallback(() => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 4 }}>
      <TouchableOpacity
        accessibilityLabel="切册显示设置"
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
        还没有记录哦
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
        可以先记录数量，也可以同时添加图片
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.push('/artists/new')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: isDark ? colors.card : colors.accentSofter,
          }}
        >
          <AppIcon name="addPerson" size={16} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>添加艺人</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openUnifiedCreate}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.accent }}
        >
          <AppIcon name="add" size={16} color={colors.onAccent} />
          <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 14 }}>添加记录</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [colors, isDark, openUnifiedCreate]);

  const renderGalleryItem = useCallback(({ item }: { item: ChekiGalleryItem }) => {
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
      return (
        <Text style={{ marginTop: 6, marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
          {item.date}
        </Text>
      );
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
                {item.group.totalCount}张
              </Text>
            </View>
          </View>
          {item.group.artist ? <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} /> : null}
        </TouchableOpacity>
      );
    }

    if (item.type === 'stack') {
      const expanded = expandedStacks.has(item.stackKey);
      if (item.stackKey.startsWith('artist:')) {
        return (
          <ChekiSpreadStackCard
            item={item}
            expanded={expanded}
            columns={columns}
            cardWidth={stackChekiW}
            cardHeight={stackChekiH}
            colors={colors}
            isDark={isDark}
            oshiArtistId={oshiArtistId}
            onToggle={() => toggleStack(item.stackKey)}
          />
        );
      }

      if (expanded) {
        return (
          <Animated.View
            entering={reducedMotion ? undefined : chekiStackEntering}
            exiting={reducedMotion ? undefined : chekiStackExiting}
            layout={reducedMotion ? undefined : chekiStackLayoutTransition}
          >
            <ChekiDateSectionHeader
              title={item.title}
              totalCount={item.totalCount}
              expanded
              colors={colors}
              onPress={() => toggleStack(item.stackKey)}
            />
          </Animated.View>
        );
      }

      const manualCount = Math.max(0, item.totalCount - item.chekis.length);

      return (
        <Animated.View
          entering={reducedMotion ? undefined : chekiStackEntering}
          exiting={reducedMotion ? undefined : chekiStackExiting}
          layout={reducedMotion ? undefined : chekiStackLayoutTransition}
        >
          <ChekiDateSectionHeader
            title={item.title}
            totalCount={item.totalCount}
            expanded={false}
            colors={colors}
            onPress={() => toggleStack(item.stackKey)}
          />
          <ChekiStackPreviewCard
            chekis={item.chekis}
            manualCount={manualCount}
            manualArtistSummaries={buildManualArtistSummaries(item.manualEntries, artistMap, oshiArtistId)}
            areaWidth={galleryContentWidth}
            thumbnailWidth={chekiW}
            thumbnailHeight={chekiH}
            columns={columns}
            onPress={() => toggleStack(item.stackKey)}
            activeOpacity={1}
            accessibilityLabel={`${item.title}，${item.totalCount}张拍立得，${expanded ? '收起' : '展开'}`}
            chrome="bare"
          />
        </Animated.View>
      );
    }

    if (item.type === 'stackExpandedRow') {
      const rowBottomRadius = item.insideStackCard && item.isLastPhotoRow ? 18 : 0;
      const rowChekiW = item.insideStackCard ? stackChekiW : chekiW;
      const rowChekiH = item.insideStackCard ? stackChekiH : chekiH;
      return (
        <Animated.View
          entering={reducedMotion ? undefined : chekiStackContentEntering}
          exiting={reducedMotion ? undefined : chekiStackContentExiting}
          layout={reducedMotion ? undefined : chekiStackLayoutTransition}
          style={{
            paddingHorizontal: item.insideStackCard ? 14 : 0,
            paddingBottom: item.insideStackCard
              ? (item.isLastPhotoRow ? 14 : CHEKI_GRID_GAP)
              : 0,
            marginBottom: item.insideStackCard
              ? (item.isLastPhotoRow ? 12 : 0)
              : (item.isLastPhotoRow ? 20 : CHEKI_GRID_GAP),
            flexDirection: 'row',
            gap: CHEKI_GRID_GAP,
            backgroundColor: item.insideStackCard ? colors.card : 'transparent',
            borderBottomLeftRadius: rowBottomRadius,
            borderBottomRightRadius: rowBottomRadius,
          }}
        >
          {item.chekis.map((cheki) => (
            <ChekiThumbnailButton
              key={cheki.id}
              cheki={cheki}
              viewerChekis={item.viewerChekis}
              width={rowChekiW}
              height={rowChekiH}
              colors={colors}
              onOpen={openViewer}
            />
          ))}
        </Animated.View>
      );
    }

    if (item.type === 'stackExpandedManual') {
      return (
        <Animated.View
          entering={reducedMotion ? undefined : chekiStackContentEntering}
          exiting={reducedMotion ? undefined : chekiStackContentExiting}
          layout={reducedMotion ? undefined : chekiStackLayoutTransition}
          style={{
            paddingHorizontal: item.insideStackCard ? 14 : 0,
            paddingTop: item.hasPhotos ? 4 : 0,
            paddingBottom: item.insideStackCard ? 14 : 0,
            marginBottom: item.insideStackCard ? 12 : 20,
            backgroundColor: item.insideStackCard ? colors.card : 'transparent',
            borderBottomLeftRadius: item.insideStackCard ? 18 : 0,
            borderBottomRightRadius: item.insideStackCard ? 18 : 0,
          }}
        >
          <ChekiManualEntryList
            entries={item.entries}
            eventMap={eventMap}
            isDark={isDark}
            artistMap={artistMap}
            oshiArtistId={oshiArtistId}
            showArtistMeta
            onPressEntry={(entry) => router.push(`/cheki/records/${entry.id}`)}
          />
        </Animated.View>
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
            showArtistMeta={viewPreferences.itemLayout !== 'artist'}
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
            chrome={item.groupKey === '__album__' ? 'bare' : 'framed'}
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
    expandedStacks,
    galleryContentWidth,
    isDark,
    openViewer,
    oshiArtistId,
    reducedMotion,
    stackContentWidth,
    stackChekiH,
    stackChekiW,
    toggleStack,
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
              placeholder="输入关键词搜索"
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
            title="没有符合条件的记录"
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
          title="视图设置"
          onClose={() => setViewSettingsVisible(false)}
          maxHeightRatio={0.52}
          scrollable
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        >
          <View style={{ marginBottom: 16 }}>
            <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
              浏览内容
            </Text>
            <SegmentedOptions
              colors={colors}
              options={[
                { value: 'item', label: '拍立得' },
                { value: 'record', label: '记录' },
              ]}
              value={viewPreferences.browseMode}
              onChange={(value) => handleChangeBrowseMode(value as ChekiBrowseMode)}
            />
          </View>

          {viewPreferences.browseMode === 'item' ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                拍立得布局
              </Text>
              <SegmentedOptions
                colors={colors}
                options={[
                  { value: 'artist', label: '按艺人' },
                  { value: 'album', label: '相册' },
                ]}
                value={viewPreferences.itemLayout}
                onChange={(value) => handleChangeItemLayout(value as ChekiItemLayout)}
              />
            </View>
          ) : null}

          <View style={{ marginBottom: 16 }}>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                排序
              </Text>
              <SegmentedOptions
                colors={colors}
                options={[
                  { value: 'desc', label: '最新在前' },
                  { value: 'asc', label: '最早在前' },
                ]}
                value={viewPreferences.sortOrder}
                onChange={(value) => handleChangeSortOrder(value as ChekiSortOrder)}
              />
            </View>
          </View>

          {viewPreferences.browseMode === 'record' ? (
            <View>
              <Text style={{ marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textMuted }}>
                记录
              </Text>
              <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.text }}>
                    显示缩略图
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                    关闭后显示艺人头像
                  </Text>
                </View>
                <Switch
                  key={viewPreferences.showRecordThumbnails ? 'record-thumbnails-on' : 'record-thumbnails-off'}
                  value={viewPreferences.showRecordThumbnails}
                  onValueChange={handleChangeRecordThumbnails}
                  accessibilityLabel="显示缩略图"
                  trackColor={{ false: colors.inputBorder, true: withAlpha(colors.accent, 0.38) }}
                  thumbColor={viewPreferences.showRecordThumbnails ? colors.accent : colors.card}
                />
              </View>
            </View>
          ) : (
            <View>
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
          )}
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
          accessibilityLabel="切册视图设置"
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

import { Artist, Cheki, ChekiManualEntry, Event } from '../types/models';
import { ChekiViewerItem } from '../types/chekiViewer';
import { normalizeChekiSpec, type ChekiSpec } from '../domain/chekiSpec';
import { getArtistPrimaryName } from './artistDisplay';
import { getArtistSearchText } from './filter';

type DatedRecord = {
  date: string | null;
  created_at: string;
};

export interface ChekiArtistGroup {
  artist: Artist | null;
  chekis: Cheki[];
  manualEntries: ChekiManualEntry[];
  totalCount: number;
  totalPrice: number;
  maxDate: string;
}

export interface ChekiDateGroup {
  date: string;
  chekis: Cheki[];
  manualEntries: ChekiManualEntry[];
  totalCount: number;
  totalPrice: number;
}

export type ChekiGridColumns = number;
export type ChekiGridDensity = 'large' | 'medium' | 'small';

const CHEKI_GRID_BASE_COLUMNS: Record<ChekiGridDensity, number> = {
  large: 3,
  medium: 4,
  small: 5,
};

const CHEKI_GRID_TARGET_ROWS: Record<ChekiGridDensity, number> = {
  large: 3,
  medium: 4,
  small: 5,
};

const CHEKI_GRID_WIDTH_BASIS = 360;
const CHEKI_GRID_EXTRA_COLUMN_WIDTH = 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getChekiGridTargetRows(density: ChekiGridDensity): number {
  return CHEKI_GRID_TARGET_ROWS[density];
}

export function calculateChekiGridLayout({
  density,
  availableWidth,
  gap,
  aspectRatio,
  minColumns = 2,
  maxColumns = 10,
  minItemWidth = 54,
}: {
  density: ChekiGridDensity;
  availableWidth: number;
  availableHeight: number;
  gap: number;
  aspectRatio: number;
  minColumns?: number;
  maxColumns?: number;
  minItemWidth?: number;
}): { columns: ChekiGridColumns; itemWidth: number; itemHeight: number; targetRows: number } {
  const targetRows = getChekiGridTargetRows(density);
  const safeWidth = Math.max(1, availableWidth);
  const responsiveExtraColumns = Math.max(
    0,
    Math.floor((safeWidth - CHEKI_GRID_WIDTH_BASIS) / CHEKI_GRID_EXTRA_COLUMN_WIDTH),
  );
  const targetColumns = CHEKI_GRID_BASE_COLUMNS[density] + responsiveExtraColumns;
  const widthLimitedMaxColumns = Math.max(
    minColumns,
    Math.floor((safeWidth + gap) / (minItemWidth + gap)),
  );
  const maxAllowedColumns = Math.min(maxColumns, widthLimitedMaxColumns);
  const columns = clamp(targetColumns, minColumns, maxAllowedColumns);
  const itemWidth = Math.floor((safeWidth - gap * (columns - 1)) / columns);
  const itemHeight = Math.round(itemWidth * aspectRatio);

  return {
    columns,
    itemWidth,
    itemHeight,
    targetRows,
  };
}

export function getChekiSortValue(record: DatedRecord): string {
  return record.date ?? record.created_at;
}

export function compareChekiDesc<T extends DatedRecord>(
  a: T,
  b: T,
): number {
  const primary = getChekiSortValue(b).localeCompare(getChekiSortValue(a));
  if (primary !== 0) return primary;
  return b.created_at.localeCompare(a.created_at);
}

export function sortChekisDesc<T extends DatedRecord>(records: T[]): T[] {
  return [...records].sort(compareChekiDesc);
}

export function chunkChekis<T>(records: T[], columns: ChekiGridColumns): T[][] {
  const rows: T[][] = [];
  const safeColumns = Math.max(1, Math.floor(columns));
  for (let index = 0; index < records.length; index += safeColumns) {
    rows.push(records.slice(index, index + safeColumns));
  }
  return rows;
}

export function getChekiAlbumColumnSpan(spec: ChekiSpec | undefined, displayMode: 'portrait' | 'original'): number {
  return displayMode === 'portrait'
    && (spec === 'five_inch_portrait' || spec === 'five_inch_landscape') ? 2 : 1;
}

/** Pack in display order without moving later photos into leftover slots. */
export function chunkChekiAlbumRows<T extends { spec?: ChekiSpec }>(
  records: T[],
  columns: ChekiGridColumns,
  displayMode: 'portrait' | 'original',
): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let occupied = 0;
  for (const record of records) {
    const span = getChekiAlbumColumnSpan(record.spec, displayMode);
    if (occupied + span > columns && row.length > 0) {
      rows.push(row);
      row = [];
      occupied = 0;
    }
    row.push(record);
    occupied += span;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

/** All frames share the scale of a 54 × 86 three-inch portrait. */
export function getChekiAlbumFrame(spec: ChekiSpec | undefined, width: number, rowHeight?: number): { width: number; height: number } {
  const scale = width / 54;
  if (rowHeight !== undefined) {
    const physical = getChekiAlbumFrame(spec, width);
    return { width: rowHeight * physical.width / physical.height, height: rowHeight };
  }
  switch (spec) {
    case 'three_inch_landscape': return { width: 86 * scale, height: 54 * scale };
    case 'five_inch_portrait': return { width: 86 * scale, height: 108 * scale };
    case 'five_inch_landscape': return { width: 108 * scale, height: 86 * scale };
    case 'square': return { width, height: width };
    default: return { width, height: 86 * scale };
  }
}

/** Justify a complete row; keep an incomplete final row at the target height. */
export function getChekiJustifiedRowHeight(
  row: { spec?: ChekiSpec }[], columns: ChekiGridColumns, itemWidth: number, gap: number, isLast: boolean,
): number {
  const availableWidth = columns * itemWidth + (columns - 1) * gap;
  const ratios = row.reduce((sum, item) => {
    const frame = getChekiAlbumFrame(item.spec, itemWidth);
    return sum + frame.width / frame.height;
  }, 0);
  const height = (availableWidth - (row.length - 1) * gap) / ratios;
  return isLast ? Math.min(height, itemWidth * 86 / 54) : height;
}

/** Fill each row with the earliest remaining photos that fit, retaining the order of deferred photos. */
export function chunkChekiPhysicalRows<T extends { spec?: ChekiSpec }>(
  records: T[],
  columns: ChekiGridColumns,
  displayMode: 'portrait' | 'original',
  itemWidth = 54,
  gap = 8,
  tidy = false,
  fillGaps = true,
): T[][] {
  if (displayMode === 'original') return chunkChekis(records, columns);
  const availableWidth = columns * itemWidth + (columns - 1) * gap;
  const rows: T[][] = [];
  if (tidy) {
    const targetHeight = itemWidth * 86 / 54;
    let start = 0;
    while (start < records.length) {
      let ratioSum = 0;
      let previousHeight = Infinity;
      let end = start;
      for (; end < records.length; end++) {
        const frame = getChekiAlbumFrame(records[end].spec, itemWidth);
        ratioSum += frame.width / frame.height;
        const height = (availableWidth - (end - start) * gap) / ratioSum;
        if (height <= targetHeight) {
          if (end === start || targetHeight - height <= previousHeight - targetHeight) end++;
          break;
        }
        previousHeight = height;
      }
      rows.push(records.slice(start, end));
      start = end;
    }
    return rows;
  }
  let remaining = records;
  while (remaining.length) {
    const row: T[] = [];
    const deferred: T[] = [];
    let occupied = 0;
    for (const record of remaining) {
      const width = getChekiAlbumFrame(record.spec, itemWidth).width;
      const required = width + (row.length ? gap : 0);
      if ((fillGaps || deferred.length === 0) && (occupied + required <= availableWidth || row.length === 0)) {
        row.push(record);
        occupied += required;
      } else {
        deferred.push(record);
      }
    }
    rows.push(row);
    remaining = deferred;
  }
  return rows;
}

export function calculateChekiStackPreview({
  total,
  columns,
  visibleLimit,
}: {
  total: number;
  columns: number;
  visibleLimit: number;
}): { shouldStack: boolean; visibleCount: number; hiddenCount: number } {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeColumns = Math.max(1, Math.floor(columns));
  const safeVisibleLimit = Math.max(1, Math.floor(visibleLimit));
  const shouldStack = safeTotal > safeColumns;
  const visibleCount = shouldStack
    ? Math.min(safeTotal, safeVisibleLimit)
    : Math.min(safeTotal, safeColumns);

  return {
    shouldStack,
    visibleCount,
    hiddenCount: Math.max(0, safeTotal - visibleCount),
  };
}

export function getChekiManualCount(entries: ChekiManualEntry[]): number {
  return entries.reduce((total, entry) => total + entry.count, 0);
}

export function getChekiManualPrice(entries: ChekiManualEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.total_price ?? 0), 0);
}

export function getChekiPhotoPrice(chekis: Cheki[]): number {
  return chekis.reduce((total, cheki) => total + (cheki.price ?? 0), 0);
}

export function getChekiTotalCount(chekis: Cheki[], manualEntries: ChekiManualEntry[]): number {
  return chekis.length + getChekiManualCount(manualEntries);
}

export function getChekiTotalPrice(chekis: Cheki[], manualEntries: ChekiManualEntry[]): number {
  return getChekiPhotoPrice(chekis) + getChekiManualPrice(manualEntries);
}

export function calculateManualChekiTotalPrice(count: number, unitPrice: number): number | null {
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return null;
  }

  return Math.round((count * unitPrice + Number.EPSILON) * 100) / 100;
}

export function matchesChekiKeyword(
  record: { artist_id: string | null; notes?: string | null },
  query: string,
  artistMap: Map<string, Artist>,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  if (record.notes?.toLowerCase().includes(normalizedQuery)) return true;
  if (!record.artist_id) return false;

  const artist = artistMap.get(record.artist_id);
  return artist
    ? getArtistSearchText(artist, artistMap).toLowerCase().includes(normalizedQuery)
    : false;
}

export function groupChekiRecordsByArtist(
  chekiList: Cheki[],
  manualEntries: ChekiManualEntry[],
  artistMap: Map<string, Artist>,
  oshiArtistId: string | null,
): ChekiArtistGroup[] {
  const groupedChekis = new Map<string | null, Cheki[]>();
  for (const cheki of chekiList) {
    const key = cheki.artist_id ?? null;
    if (!groupedChekis.has(key)) groupedChekis.set(key, []);
    groupedChekis.get(key)!.push(cheki);
  }

  const groupedManualEntries = new Map<string, ChekiManualEntry[]>();
  for (const entry of manualEntries) {
    if (!groupedManualEntries.has(entry.artist_id)) groupedManualEntries.set(entry.artist_id, []);
    groupedManualEntries.get(entry.artist_id)!.push(entry);
  }

  for (const chekis of groupedChekis.values()) {
    chekis.sort(compareChekiDesc);
  }
  for (const entries of groupedManualEntries.values()) {
    entries.sort(compareChekiDesc);
  }

  const keys = new Set<string | null>([
    ...groupedChekis.keys(),
    ...groupedManualEntries.keys(),
  ]);

  const groups = Array.from(keys).map((key) => {
    const chekis = groupedChekis.get(key) ?? [];
    const artist = key ? artistMap.get(key) ?? null : null;
    const entries = key ? (groupedManualEntries.get(key) ?? []) : [];
    const datedValues = [...chekis, ...entries].map(getChekiSortValue);

    return {
      artist,
      chekis,
      manualEntries: entries,
      totalCount: getChekiTotalCount(chekis, entries),
      totalPrice: getChekiTotalPrice(chekis, entries),
      maxDate: datedValues.sort().at(-1) ?? '',
    };
  });

  const artistGroups = groups
    .filter((group) => group.artist !== null)
    .sort((a, b) => {
      if (a.artist?.id === oshiArtistId) return -1;
      if (b.artist?.id === oshiArtistId) return 1;
      const favoriteDiff = (b.artist?.is_favorite ?? 0) - (a.artist?.is_favorite ?? 0);
      if (favoriteDiff !== 0) return favoriteDiff;
      if (a.maxDate !== b.maxDate) return b.maxDate.localeCompare(a.maxDate);
      return (a.artist?.name ?? '').localeCompare(b.artist?.name ?? '');
    });

  const nullGroup = groups.find((group) => group.artist === null) ?? null;
  return nullGroup ? [...artistGroups, nullGroup] : artistGroups;
}

function getChekiDateKey(record: DatedRecord): string {
  return getChekiSortValue(record).slice(0, 10);
}

export function groupChekiRecordsByDate(
  chekiList: Cheki[],
  manualEntries: ChekiManualEntry[],
): ChekiDateGroup[] {
  const groupedChekis = new Map<string, Cheki[]>();
  for (const cheki of chekiList) {
    const key = getChekiDateKey(cheki);
    if (!groupedChekis.has(key)) groupedChekis.set(key, []);
    groupedChekis.get(key)!.push(cheki);
  }

  const groupedManualEntries = new Map<string, ChekiManualEntry[]>();
  for (const entry of manualEntries) {
    const key = getChekiDateKey(entry);
    if (!groupedManualEntries.has(key)) groupedManualEntries.set(key, []);
    groupedManualEntries.get(key)!.push(entry);
  }

  const keys = new Set<string>([
    ...groupedChekis.keys(),
    ...groupedManualEntries.keys(),
  ]);

  return Array.from(keys)
    .sort((left, right) => right.localeCompare(left))
    .map((date) => {
      const chekis = sortChekisDesc(groupedChekis.get(date) ?? []);
      const entries = sortChekisDesc(groupedManualEntries.get(date) ?? []);
      return {
        date,
        chekis,
        manualEntries: entries,
        totalCount: getChekiTotalCount(chekis, entries),
        totalPrice: getChekiTotalPrice(chekis, entries),
      };
    });
}

export function buildChekiViewerItems(
  chekis: Cheki[],
  artistMap: Map<string, Artist>,
  eventMap: Map<string, Event>,
): ChekiViewerItem[] {
  // 只做数据映射，保留调用方传入顺序：调用方数组就是界面当前展示顺序（缩略图/列表）。
  // 不要在内部再次按 created_at 排序，否则同一记录内的多张拍立得会被二次倒序，
  // 且电子切册的“最早在前”等用户选择的排序也会被覆盖。
  return chekis.map((cheki) => {
    const shared = {
      itemId: cheki.id,
      date: cheki.date,
      price: cheki.price,
      notes: cheki.notes,
      isFavorite: cheki.is_favorite === 1,
      spec: normalizeChekiSpec(cheki.spec),
      artistId: cheki.artist_id,
      artistName: cheki.artist_id ? (artistMap.get(cheki.artist_id) ? getArtistPrimaryName(artistMap.get(cheki.artist_id)!) : '未知艺人') : null,
      eventId: cheki.event_id,
      eventTitle: cheki.event_id ? (eventMap.get(cheki.event_id)?.title ?? '未命名活动') : null,
    };
    return {
      ...shared,
      id: cheki.id,
      photoUri: cheki.front_photo_uri ?? cheki.back_photo_uri ?? cheki.photo_uri,
      frontPhotoUri: cheki.front_photo_uri,
      backPhotoUri: cheki.back_photo_uri,
      side: cheki.front_photo_uri ? 'front' as const : cheki.back_photo_uri ? 'back' as const : undefined,
    };
  });
}

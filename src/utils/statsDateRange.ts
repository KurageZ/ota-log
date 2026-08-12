import { isValidISODate, toISODate } from './date';

export type StatsPeriodPreset = 'week' | 'month' | 'year' | 'all' | 'custom';

export interface StatsDateRange {
  preset: StatsPeriodPreset;
  startDate: string | null;
  endDate: string | null;
}

export interface StatsTrendBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface StatsRangeDayMark {
  date: string;
  isRangeStart: boolean;
  isRangeEnd: boolean;
}

function localDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function daysInRange(startDate: string, endDate: string): number {
  const start = localDate(startDate);
  const end = localDate(endDate);
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
    - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000) + 1;
}

export function getSystemFirstDayOfWeek(): number {
  try {
    const locale = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
      weekInfo?: { firstDay: number };
      getWeekInfo?: () => { firstDay: number };
    };
    const firstDay = locale.weekInfo?.firstDay ?? locale.getWeekInfo?.().firstDay;
    if (firstDay != null) return firstDay % 7;
  } catch {
    // Fall back to Monday for runtimes without Intl.Locale week information.
  }
  return 1;
}

export function createPresetStatsRange(
  preset: Exclude<StatsPeriodPreset, 'custom'>,
  now = new Date(),
): StatsDateRange {
  if (preset === 'all') return { preset, startDate: null, endDate: null };

  const year = now.getFullYear();
  const month = now.getMonth();
  if (preset === 'month') {
    return {
      preset,
      startDate: toISODate(new Date(year, month, 1)),
      endDate: toISODate(new Date(year, month + 1, 0)),
    };
  }
  if (preset === 'year') {
    return {
      preset,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  const firstDay = getSystemFirstDayOfWeek();
  const offset = (now.getDay() - firstDay + 7) % 7;
  const start = addDays(now, -offset);
  return {
    preset,
    startDate: toISODate(start),
    endDate: toISODate(addDays(start, 6)),
  };
}

export function createStatsRangeForDate(
  preset: 'week' | 'month' | 'year',
  date: Date,
): StatsDateRange {
  return createPresetStatsRange(preset, date);
}

export function shiftStatsDateRange(range: StatsDateRange, amount: number): StatsDateRange {
  if (!range.startDate || range.preset === 'all' || range.preset === 'custom') return range;

  const start = localDate(range.startDate);
  if (range.preset === 'week') return createPresetStatsRange('week', addDays(start, amount * 7));
  if (range.preset === 'month') {
    return createPresetStatsRange('month', new Date(start.getFullYear(), start.getMonth() + amount, 1));
  }
  return createPresetStatsRange('year', new Date(start.getFullYear() + amount, 0, 1));
}

export function createCustomStatsRange(startDate: string, endDate: string): StatsDateRange | null {
  if (!isValidISODate(startDate) || !isValidISODate(endDate) || startDate > endDate) return null;
  return { preset: 'custom', startDate, endDate };
}

export function getStatsRangeDaysForMonth(
  startDate: string,
  endDate: string,
  visibleMonth: string,
): StatsRangeDayMark[] {
  if (
    !isValidISODate(startDate)
    || !isValidISODate(endDate)
    || startDate > endDate
    || !/^\d{4}-\d{2}$/.test(visibleMonth)
  ) return [];

  const [year, month] = visibleMonth.split('-').map(Number);
  const firstVisibleDate = `${visibleMonth}-01`;
  const lastVisibleDate = toISODate(new Date(year, month, 0));
  const intersectionStart = startDate > firstVisibleDate ? startDate : firstVisibleDate;
  const intersectionEnd = endDate < lastVisibleDate ? endDate : lastVisibleDate;
  if (intersectionStart > intersectionEnd) return [];

  const marks: StatsRangeDayMark[] = [];
  for (
    let cursor = localDate(intersectionStart);
    toISODate(cursor) <= intersectionEnd;
    cursor = addDays(cursor, 1)
  ) {
    const date = toISODate(cursor);
    marks.push({
      date,
      isRangeStart: date === startDate,
      isRangeEnd: date === endDate,
    });
  }
  return marks;
}

export function formatStatsDateRange(range: StatsDateRange): string {
  if (!range.startDate || !range.endDate) return '全部时间';
  return `${range.startDate.replaceAll('-', '/')} – ${range.endDate.replaceAll('-', '/')}`;
}

export function formatStatsPeriodLabel(range: StatsDateRange): string {
  if (!range.startDate || !range.endDate) return '全部时间';

  const year = Number(range.startDate.slice(0, 4));
  const month = Number(range.startDate.slice(5, 7));
  if (range.preset === 'month') return `${year} 年 ${month} 月`;
  if (range.preset === 'year') return `${year} 年`;
  return formatStatsDateRange(range);
}

export function buildStatsTrendBuckets(range: StatsDateRange): StatsTrendBucket[] {
  if (!range.startDate || !range.endDate) return [];
  const span = daysInRange(range.startDate, range.endDate);
  const buckets: StatsTrendBucket[] = [];

  if (span <= 31) {
    for (let cursor = localDate(range.startDate); toISODate(cursor) <= range.endDate; cursor = addDays(cursor, 1)) {
      const key = toISODate(cursor);
      buckets.push({ key, label: `${cursor.getMonth() + 1}/${cursor.getDate()}`, startDate: key, endDate: key });
    }
    return buckets;
  }

  if (span <= 366) {
    let cursor = new Date(localDate(range.startDate).getFullYear(), localDate(range.startDate).getMonth(), 1);
    while (toISODate(cursor).slice(0, 7) <= range.endDate.slice(0, 7)) {
      const key = toISODate(cursor).slice(0, 7);
      const monthEnd = toISODate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
      buckets.push({
        key,
        label: `${cursor.getMonth() + 1}月`,
        startDate: key === range.startDate.slice(0, 7) ? range.startDate : `${key}-01`,
        endDate: key === range.endDate.slice(0, 7) ? range.endDate : monthEnd,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return buckets;
  }

  for (let year = Number(range.startDate.slice(0, 4)); year <= Number(range.endDate.slice(0, 4)); year += 1) {
    const key = String(year);
    buckets.push({
      key,
      label: `${year}年`,
      startDate: year === Number(range.startDate.slice(0, 4)) ? range.startDate : `${year}-01-01`,
      endDate: year === Number(range.endDate.slice(0, 4)) ? range.endDate : `${year}-12-31`,
    });
  }
  return buckets;
}

export function getTrendLabelIndices(length: number): Set<number> {
  if (length <= 0) return new Set();
  if (length <= 7) return new Set(Array.from({ length }, (_, index) => index));
  return new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round((length - 1) * ratio)));
}

export function parseStatsRangeParams(params: {
  preset?: string | string[];
  startDate?: string | string[];
  endDate?: string | string[];
  year?: string | string[];
  month?: string | string[];
}): StatsDateRange | null {
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const preset = single(params.preset);
  const startDate = single(params.startDate);
  const endDate = single(params.endDate);
  if (startDate && endDate) {
    const range = createCustomStatsRange(startDate, endDate);
    if (range) return { ...range, preset: preset === 'week' || preset === 'month' || preset === 'year' ? preset : 'custom' };
  }
  if (preset === 'all') return createPresetStatsRange('all');
  if (preset === 'week' || preset === 'month' || preset === 'year') return createPresetStatsRange(preset);

  const legacyYear = Number(single(params.year));
  const legacyMonth = Number(single(params.month));
  if (Number.isInteger(legacyYear) && legacyYear >= 1900) {
    if (Number.isInteger(legacyMonth) && legacyMonth >= 1 && legacyMonth <= 12) {
      return {
        preset: 'custom',
        startDate: `${legacyYear}-${String(legacyMonth).padStart(2, '0')}-01`,
        endDate: toISODate(new Date(legacyYear, legacyMonth, 0)),
      };
    }
    return { preset: 'custom', startDate: `${legacyYear}-01-01`, endDate: `${legacyYear}-12-31` };
  }
  return null;
}

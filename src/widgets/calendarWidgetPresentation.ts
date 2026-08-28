import type { WidgetTimelineEntry } from 'expo-widgets';
import type { ChekiCalendarDaySummary } from '../types/models';
import type { CalendarGridWeekStart } from '../utils/calendarWeeks';
import { monthGridLeadingBlankCount, reorderWeekdayLabels } from '../utils/calendarWeeks';
import { toISODate } from '../utils/date';
import type {
  CalendarWidgetDayProps,
  CalendarWidgetPalette,
  CalendarWidgetProps,
} from './CalendarWidget';

export const CALENDAR_WIDGET_TIMELINE_ENTRY_COUNT = 45;

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

export interface CalendarWidgetMonthData {
  summaries: ChekiCalendarDaySummary[];
}

export interface CalendarWidgetThemePalettes {
  light: CalendarWidgetPalette;
  dark: CalendarWidgetPalette;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function nextLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function buildCalendarDays(
  displayDate: Date,
  today: string,
  weekStart: CalendarGridWeekStart,
  monthData: CalendarWidgetMonthData | undefined,
  cachedImageUris: ReadonlyMap<string, string>,
): CalendarWidgetDayProps[] {
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth() + 1;
  const leading = monthGridLeadingBlankCount(year, month, weekStart);
  const firstCellDate = new Date(year, month - 1, 1 - leading);
  const summaryMap = new Map((monthData?.summaries ?? []).map((summary) => [summary.date, summary]));

  return Array.from({ length: 42 }, (_, index) => {
    const date = addLocalDays(firstCellDate, index);
    const dateString = toISODate(date);
    const inMonth = date.getFullYear() === year && date.getMonth() === month - 1;
    const summary = inMonth ? summaryMap.get(dateString) : undefined;
    const sourceUri = summary?.latestPhotoUri ?? summary?.fallbackArtistAvatarUri ?? null;
    const imageUri = sourceUri ? cachedImageUris.get(sourceUri) : undefined;
    return {
      date: dateString,
      day: date.getDate(),
      inMonth,
      isToday: dateString === today,
      imageUri,
      isAvatar: Boolean(summary && !summary.latestPhotoUri && summary.fallbackArtistAvatarUri),
      count: summary?.totalCount ?? 0,
    };
  });
}

export function createCalendarWidgetTimeline(
  monthData: ReadonlyMap<string, CalendarWidgetMonthData>,
  cachedImageUris: ReadonlyMap<string, string>,
  palettes: CalendarWidgetThemePalettes,
  weekStart: CalendarGridWeekStart,
  now = new Date(),
): WidgetTimelineEntry<CalendarWidgetProps>[] {
  const firstMidnight = nextLocalMidnight(now);
  const entryDates = Array.from(
    { length: CALENDAR_WIDGET_TIMELINE_ENTRY_COUNT },
    (_, index) => index === 0 ? new Date(now) : addLocalDays(firstMidnight, index - 1),
  );
  const weekdays = reorderWeekdayLabels(WEEKDAY_LABELS, weekStart);

  return entryDates.map((entryDate) => {
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth() + 1;
    return {
      date: entryDate,
      props: {
        title: `${year}年${month}月`,
        weekdays,
        days: buildCalendarDays(
          entryDate,
          toISODate(entryDate),
          weekStart,
          monthData.get(monthKey(entryDate)),
          cachedImageUris,
        ),
        light: palettes.light,
        dark: palettes.dark,
        deepLink: 'otalog:///calendar',
      },
    };
  });
}

export function calendarWidgetTimelineMonthKeys(
  now = new Date(),
  entryCount = CALENDAR_WIDGET_TIMELINE_ENTRY_COUNT,
): string[] {
  const firstMidnight = nextLocalMidnight(now);
  const keys = new Set<string>([monthKey(now)]);
  for (let index = 1; index < entryCount; index += 1) {
    keys.add(monthKey(addLocalDays(firstMidnight, index - 1)));
  }
  return [...keys];
}

import { Event } from '../types/models';
import { EventCardOshiBadge } from './oshiMatch';

type TimelineSourceItem = {
  event: Event;
  oshiBadge: EventCardOshiBadge;
};

export interface HomeTimelineItem {
  event: Event;
  oshiBadge: EventCardOshiBadge;
  dayLabel: string;
  monthLabel: string;
}

export interface HomeTimelineGroup {
  key: string;
  title: string;
  rangeLabel: string;
  items: HomeTimelineItem[];
}

export function buildHomeTimelineGroups(
  items: TimelineSourceItem[],
  now: Date = new Date(),
): HomeTimelineGroup[] {
  const today = startOfDay(now);
  const currentWeekStart = startOfWeek(today);
  const currentWeekEnd = addDays(currentWeekStart, 6);
  const nextWeekStart = addDays(currentWeekEnd, 1);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const currentMonthEnd = endOfMonth(today);

  const groups = new Map<string, HomeTimelineGroup>();

  for (const item of items) {
    const eventDate = parseISODate(item.event.event_date);
    const timelineItem: HomeTimelineItem = {
      event: item.event,
      oshiBadge: item.oshiBadge,
      dayLabel: String(eventDate.getDate()),
      monthLabel: formatMonthLabel(eventDate.getMonth() + 1),
    };

    if (isWithinRange(eventDate, currentWeekStart, currentWeekEnd)) {
      pushGroup(groups, {
        key: 'current-week',
        title: '本周',
        rangeLabel: formatRangeLabel(currentWeekStart, currentWeekEnd, today.getFullYear()),
        items: [timelineItem],
      });
      continue;
    }

    if (isWithinRange(eventDate, nextWeekStart, nextWeekEnd)) {
      pushGroup(groups, {
        key: 'next-week',
        title: '下周',
        rangeLabel: formatRangeLabel(nextWeekStart, nextWeekEnd, today.getFullYear()),
        items: [timelineItem],
      });
      continue;
    }

    if (isSameMonth(eventDate, today)) {
      pushGroup(groups, {
        key: 'later-this-month',
        title: '本月稍后',
        rangeLabel: formatRangeLabel(nextWeekEnd < currentMonthEnd ? addDays(nextWeekEnd, 1) : currentMonthEnd, currentMonthEnd, today.getFullYear()),
        items: [timelineItem],
      });
      continue;
    }

    const monthStart = startOfMonth(eventDate);
    const monthEnd = endOfMonth(eventDate);
    const key = `month-${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;

    pushGroup(groups, {
      key,
      title: formatMonthTitle(eventDate, today.getFullYear()),
      rangeLabel: formatRangeLabel(monthStart, monthEnd, today.getFullYear()),
      items: [timelineItem],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort(compareTimelineItems),
    }))
    .sort(compareGroups(today));
}

function pushGroup(
  groups: Map<string, HomeTimelineGroup>,
  group: HomeTimelineGroup,
) {
  const existing = groups.get(group.key);
  if (!existing) {
    groups.set(group.key, group);
    return;
  }

  existing.items.push(...group.items);
}

function compareGroups(today: Date) {
  const fixedOrder = ['current-week', 'next-week', 'later-this-month'];
  return (a: HomeTimelineGroup, b: HomeTimelineGroup) => {
    const aFixedIndex = fixedOrder.indexOf(a.key);
    const bFixedIndex = fixedOrder.indexOf(b.key);

    if (aFixedIndex !== -1 || bFixedIndex !== -1) {
      if (aFixedIndex === -1) return 1;
      if (bFixedIndex === -1) return -1;
      return aFixedIndex - bFixedIndex;
    }

    return extractMonthGroupDate(a.key, today).getTime() - extractMonthGroupDate(b.key, today).getTime();
  };
}

function compareTimelineItems(a: HomeTimelineItem, b: HomeTimelineItem) {
  const dateCompare = a.event.event_date.localeCompare(b.event.event_date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (a.event.event_time ?? '').localeCompare(b.event.event_time ?? '');
}

function extractMonthGroupDate(key: string, today: Date) {
  const match = /^month-(\d{4})-(\d{2})$/.exec(key);
  if (!match) {
    return today;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function formatMonthTitle(date: Date, currentYear: number) {
  const month = date.getMonth() + 1;
  if (date.getFullYear() === currentYear) {
    return `${month}月`;
  }

  return `${date.getFullYear()}年${month}月`;
}

function formatRangeLabel(start: Date, end: Date, currentYear: number) {
  if (start.getTime() > end.getTime()) {
    return '';
  }

  const startPrefix = start.getFullYear() === currentYear
    ? `${start.getMonth() + 1}月${start.getDate()}日`
    : `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`;
  const endPrefix = end.getFullYear() === currentYear
    ? `${end.getMonth() + 1}月${end.getDate()}日`
    : `${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;

  return `${startPrefix}-${endPrefix}`;
}

function isWithinRange(target: Date, start: Date, end: Date) {
  return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatMonthLabel(month: number) {
  const labels = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  return labels[month - 1] ?? `${month}月`;
}

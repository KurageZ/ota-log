import { DateItemAnniversaryKind } from '../types/models';
import { toISODate } from './date';

const DAY_MS = 86_400_000;

export type DateItemRelativeState = 'future' | 'today' | 'past';

export interface DateItemRelativeCopy {
  state: DateItemRelativeState;
  days: number;
  text: string;
}

export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getLocalDayDifference(targetISODate: string, todayISODate = toISODate(new Date())): number {
  const target = parseLocalDate(targetISODate);
  const today = parseLocalDate(todayISODate);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export function getDateItemRelativeCopy(targetISODate: string, todayISODate = toISODate(new Date())): DateItemRelativeCopy {
  const difference = getLocalDayDifference(targetISODate, todayISODate);
  if (difference > 0) {
    return { state: 'future', days: difference, text: `还有 ${difference} 天` };
  }
  if (difference < 0) {
    return { state: 'past', days: Math.abs(difference), text: `已过去 ${Math.abs(difference)} 天` };
  }
  return { state: 'today', days: 0, text: '就是今天' };
}

export function addDateItemAnniversaryDate(
  baseISODate: string,
  kind: DateItemAnniversaryKind,
  value: number,
): string {
  const base = parseLocalDate(baseISODate);
  if (kind === 'day') {
    const next = new Date(base);
    next.setDate(base.getDate() + value - 1);
    return toISODate(next);
  }

  const next = new Date(base);
  if (kind === 'month') {
    const targetMonthIndex = base.getMonth() + value;
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    next.setMonth(base.getMonth() + value);
    if (next.getMonth() !== targetMonth) {
      next.setDate(0);
    }
  } else {
    next.setFullYear(base.getFullYear() + value);
    if (next.getMonth() !== base.getMonth()) {
      next.setDate(0);
    }
  }
  return toISODate(next);
}

export function formatDateItemAnniversaryLabel(kind: DateItemAnniversaryKind, value: number): string {
  if (kind === 'day') return `第 ${value} 天`;
  if (kind === 'month') return `第 ${value} 个月`;
  return `${value} 年`;
}

export function formatDateItemAnniversaryRuleLabel(kind: DateItemAnniversaryKind, value: number): string {
  if (kind === 'day' && value === 100) return '每 100 天';
  if (kind === 'month' && value === 1) return '每月';
  if (kind === 'year' && value === 1) return '每年';
  return formatDateItemAnniversaryLabel(kind, value);
}

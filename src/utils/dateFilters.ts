export type DateFilterMode = 'day' | 'month' | 'year' | 'custom';

export type DateFilter = {
  mode: DateFilterMode;
  startDate: string;
  endDate: string;
} | null;

export function formatDateFilter(filter: DateFilter): string | null {
  if (!filter) return null;
  if (filter.mode === 'day') return filter.startDate;
  if (filter.mode === 'month') return filter.startDate.slice(0, 7).replace('-', '.');
  if (filter.mode === 'year') return filter.startDate.slice(0, 4);
  return `${filter.startDate} – ${filter.endDate}`;
}

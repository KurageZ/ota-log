import { sortChekisDesc } from './cheki';
import type { ChekiSortOrder } from './chekiViewPreferences';

type DatedItem = {
  date: string | null;
  created_at: string;
};

export type ChekiDatedSection<T> = {
  key: string;
  items: T[];
};

function sortItems<T extends DatedItem>(items: T[], sortOrder: ChekiSortOrder): T[] {
  const sorted = sortChekisDesc(items);
  return sortOrder === 'asc' ? sorted.reverse() : sorted;
}

function buildSections<T extends DatedItem>(
  items: T[],
  sortOrder: ChekiSortOrder,
  getKey: (date: string) => string,
): ChekiDatedSection<T>[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = item.date ? getKey(item.date) : '__undated__';
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  const datedKeys = [...buckets.keys()]
    .filter((key) => key !== '__undated__')
    .sort((left, right) => sortOrder === 'desc' ? right.localeCompare(left) : left.localeCompare(right));
  const keys = buckets.has('__undated__') ? [...datedKeys, '__undated__'] : datedKeys;

  return keys.map((key) => ({
    key,
    items: sortItems(buckets.get(key) ?? [], sortOrder),
  }));
}

export function buildChekiMonthSections<T extends DatedItem>(
  items: T[],
  sortOrder: ChekiSortOrder,
): ChekiDatedSection<T>[] {
  return buildSections(items, sortOrder, (date) => date.slice(0, 7));
}

export function buildChekiDateSections<T extends DatedItem>(
  items: T[],
  sortOrder: ChekiSortOrder,
): ChekiDatedSection<T>[] {
  return buildSections(items, sortOrder, (date) => date.slice(0, 10));
}

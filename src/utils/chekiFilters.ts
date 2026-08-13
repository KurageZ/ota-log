import type { ChekiSpec } from '../domain/chekiSpec';

export type ChekiDateFilter =
  | { mode: 'day'; startDate: string; endDate: string }
  | { mode: 'month'; startDate: string; endDate: string }
  | { mode: 'year'; startDate: string; endDate: string }
  | { mode: 'custom'; startDate: string; endDate: string }
  | null;

export type ChekiRecordImageStatus = 'none' | 'partial' | 'complete' | null;

export interface ChekiRecordFilters {
  date: ChekiDateFilter;
  artistIds: string[];
  eventId: string | null;
  imageStatus: ChekiRecordImageStatus;
  hasLinkedEvent: boolean;
  hasNotes: boolean;
  hasBackImage: boolean;
}

export interface ChekiItemFilters {
  date: ChekiDateFilter;
  artistIds: string[];
  specs: ChekiSpec[];
  hasLinkedEvent: boolean;
  hasNotes: boolean;
  isFavorite: boolean;
  hasBackImage: boolean;
}

export const EMPTY_CHEKI_RECORD_FILTERS: ChekiRecordFilters = {
  date: null,
  artistIds: [],
  eventId: null,
  imageStatus: null,
  hasLinkedEvent: false,
  hasNotes: false,
  hasBackImage: false,
};

export const EMPTY_CHEKI_ITEM_FILTERS: ChekiItemFilters = {
  date: null,
  artistIds: [],
  specs: [],
  hasLinkedEvent: false,
  hasNotes: false,
  isFavorite: false,
  hasBackImage: false,
};

export function cloneChekiRecordFilters(filters: ChekiRecordFilters): ChekiRecordFilters {
  return { ...filters, date: filters.date ? { ...filters.date } : null, artistIds: [...filters.artistIds] };
}

export function cloneChekiItemFilters(filters: ChekiItemFilters): ChekiItemFilters {
  return {
    ...filters,
    date: filters.date ? { ...filters.date } : null,
    artistIds: [...filters.artistIds],
    specs: [...filters.specs],
  };
}

export function countChekiRecordFilterCategories(filters: ChekiRecordFilters): number {
  return Number(filters.date != null)
    + Number(filters.artistIds.length > 0)
    + Number(filters.eventId != null)
    + Number(filters.imageStatus != null)
    + Number(filters.hasLinkedEvent && filters.eventId == null)
    + Number(filters.hasNotes)
    + Number(filters.hasBackImage);
}

export function countChekiItemFilterCategories(filters: ChekiItemFilters): number {
  return Number(filters.date != null)
    + Number(filters.artistIds.length > 0)
    + Number(filters.specs.length > 0)
    + Number(filters.hasLinkedEvent)
    + Number(filters.hasNotes)
    + Number(filters.isFavorite)
    + Number(filters.hasBackImage);
}

export function formatChekiDateFilter(filter: ChekiDateFilter): string | null {
  if (!filter) return null;
  if (filter.mode === 'day') return filter.startDate;
  if (filter.mode === 'month') return filter.startDate.slice(0, 7).replace('-', '.');
  if (filter.mode === 'year') return filter.startDate.slice(0, 4);
  return `${filter.startDate} – ${filter.endDate}`;
}

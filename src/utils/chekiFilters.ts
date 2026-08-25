import type { ChekiSpec } from '../domain/chekiSpec';
import type { ChekiBrowseItem } from '../repositories/ChekiRecordRepository';
import type { DateFilter } from './dateFilters';

export type ChekiDateFilter = DateFilter;

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

export function matchesChekiItemFilters(
  item: ChekiBrowseItem,
  filters: ChekiItemFilters,
): boolean {
  const { record } = item;
  const effectiveDate = (record.date ?? record.created_at).slice(0, 10);

  if (filters.artistIds.length > 0) {
    if (!record.artist_id || !filters.artistIds.includes(record.artist_id)) return false;
  }
  if (filters.date) {
    if (effectiveDate < filters.date.startDate || effectiveDate > filters.date.endDate) return false;
  }
  if (filters.specs.length > 0 && !filters.specs.includes(item.spec)) return false;
  if (filters.hasLinkedEvent && !record.event_id) return false;
  if (filters.hasNotes && !item.notes?.trim()) return false;
  if (filters.isFavorite && item.is_favorite !== 1) return false;
  if (filters.hasBackImage && !item.images.some((image) => image.side === 'back')) return false;

  return true;
}

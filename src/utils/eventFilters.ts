import type { EventStatus } from '../types/models';
import type { DateFilter } from './dateFilters';

export type EventDateFilter = DateFilter;

export interface EventListFilters {
  date: EventDateFilter;
  statuses: EventStatus[];
  artistIds: string[];
  artistScope: 'favorite' | 'oshi' | null;
  minScore: number | null;
  hasNotes: boolean;
  hasSetlist: boolean;
  hasTimetable: boolean;
  hasPhotos: boolean;
  hasCheki: boolean;
}

export const EMPTY_EVENT_LIST_FILTERS: EventListFilters = {
  date: null,
  statuses: [],
  artistIds: [],
  artistScope: null,
  minScore: null,
  hasNotes: false,
  hasSetlist: false,
  hasTimetable: false,
  hasPhotos: false,
  hasCheki: false,
};

export function cloneEventListFilters(filters: EventListFilters): EventListFilters {
  return {
    ...filters,
    date: filters.date ? { ...filters.date } : null,
    statuses: [...filters.statuses],
    artistIds: [...filters.artistIds],
  };
}

export function countEventFilterCategories(filters: EventListFilters): number {
  return Number(filters.date != null)
    + Number(filters.statuses.length > 0)
    + Number(filters.artistIds.length > 0 || filters.artistScope != null)
    + Number(filters.minScore != null)
    + Number(filters.hasNotes)
    + Number(filters.hasSetlist)
    + Number(filters.hasTimetable)
    + Number(filters.hasPhotos)
    + Number(filters.hasCheki);
}

export interface EventFilterRouteParams {
  keyword?: string | string[];
  city?: string | string[];
  venue?: string | string[];
  status?: string | string[];
  artist_id?: string | string[];
  year?: string | string[];
  month?: string | string[];
  startDate?: string | string[];
  endDate?: string | string[];
  min_score?: string | string[];
  scope?: string | string[];
}

const EVENT_STATUSES: EventStatus[] = ['wishlist', 'planned', 'completed', 'cancelled'];

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function listParam(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean))];
}

function monthEnd(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function buildEventDeepLinkState(
  params: EventFilterRouteParams,
  context: { favoriteArtistIds: string[]; oshiArtistId: string | null; selectableArtistIds: string[] },
): { hasDeepLink: boolean; keyword: string; filters: EventListFilters } {
  const rawValues = [
    params.keyword,
    params.city,
    params.venue,
    params.status,
    params.artist_id,
    params.year,
    params.month,
    params.startDate,
    params.endDate,
    params.min_score,
    params.scope,
  ].flatMap((value) => Array.isArray(value) ? value : [value]);
  const hasDeepLink = rawValues.some((value) => typeof value === 'string' && value.trim().length > 0);
  const filters = cloneEventListFilters(EMPTY_EVENT_LIST_FILTERS);

  const startDate = firstParam(params.startDate);
  const endDate = firstParam(params.endDate);
  const year = Number(firstParam(params.year));
  const month = Number(firstParam(params.month));
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    filters.date = { mode: startDate === endDate ? 'day' : 'custom', startDate, endDate };
  } else if (Number.isInteger(year) && year > 0) {
    filters.date = Number.isInteger(month) && month >= 1 && month <= 12
      ? { mode: 'month', startDate: `${year}-${String(month).padStart(2, '0')}-01`, endDate: monthEnd(year, month) }
      : { mode: 'year', startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }

  filters.statuses = listParam(params.status).filter((value): value is EventStatus => EVENT_STATUSES.includes(value as EventStatus));
  const selectable = new Set(context.selectableArtistIds);
  const routeArtistIds = listParam(params.artist_id);
  const scope = firstParam(params.scope);
  filters.artistScope = scope === 'favorite' || scope === 'oshi' ? scope : null;
  const scopeArtistIds = scope === 'favorite'
    ? context.favoriteArtistIds.filter((artistId) => selectable.has(artistId))
    : scope === 'oshi' && context.oshiArtistId && selectable.has(context.oshiArtistId)
      ? [context.oshiArtistId]
      : [];
  filters.artistIds = [...new Set([...routeArtistIds, ...scopeArtistIds])];

  const minScore = Number(firstParam(params.min_score));
  filters.minScore = Number.isInteger(minScore) && minScore >= 1 && minScore <= 5 ? minScore : null;

  const keyword = [firstParam(params.keyword), firstParam(params.city), firstParam(params.venue)]
    .filter(Boolean)
    .join(' ');
  return { hasDeepLink, keyword, filters };
}

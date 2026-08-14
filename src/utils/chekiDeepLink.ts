import {
  EMPTY_CHEKI_ITEM_FILTERS,
  EMPTY_CHEKI_RECORD_FILTERS,
  type ChekiItemFilters,
  type ChekiRecordFilters,
} from './chekiFilters';
import type { ChekiBrowseMode } from './chekiViewPreferences';
import type { DateFilter } from './dateFilters';

type RouteParam = string | string[] | undefined;

export const CHEKI_DEEP_LINK_PARAM_KEYS = [
  'artist_id',
  'event_id',
  'year',
  'month',
  'date',
  'startDate',
  'endDate',
  'preset',
  'browse',
] as const;

type ChekiDeepLinkParamKey = typeof CHEKI_DEEP_LINK_PARAM_KEYS[number];

export type ChekiFilterRouteParams = Partial<Record<ChekiDeepLinkParamKey, RouteParam>>;

export type ChekiDeepLinkState =
  | { hasDeepLink: false; targetMode: ChekiBrowseMode }
  | {
      hasDeepLink: true;
      targetMode: ChekiBrowseMode;
      filterAction: 'preserve' | 'clearDate';
    }
  | {
      hasDeepLink: true;
      targetMode: 'album';
      filterAction: 'replace';
      filters: ChekiItemFilters;
    }
  | {
      hasDeepLink: true;
      targetMode: 'record';
      filterAction: 'replace';
      filters: ChekiRecordFilters;
    };

export function getChekiDeepLinkSignature(params: ChekiFilterRouteParams): string {
  return JSON.stringify(CHEKI_DEEP_LINK_PARAM_KEYS.map((key) => params[key]));
}

export function createClearedChekiDeepLinkParams(): Record<ChekiDeepLinkParamKey, ''> {
  return Object.fromEntries(
    CHEKI_DEEP_LINK_PARAM_KEYS.map((key) => [key, '']),
  ) as Record<ChekiDeepLinkParamKey, ''>;
}

function firstParam(value: RouteParam): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const normalized = first?.trim();
  return normalized || undefined;
}

function parseArtistIds(value: RouteParam): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean))];
}

function parseDateParam(value: RouteParam): string | undefined {
  const date = firstParam(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

function parseDateFilter(params: ChekiFilterRouteParams): DateFilter {
  const date = parseDateParam(params.date);
  if (date) return { mode: 'day', startDate: date, endDate: date };

  const startDate = parseDateParam(params.startDate);
  const endDate = parseDateParam(params.endDate);
  if (startDate && endDate) return { mode: 'custom', startDate, endDate };

  const yearParam = firstParam(params.year);
  if (!yearParam || !/^\d{4}$/.test(yearParam)) return null;
  const year = Number(yearParam);
  const monthParam = firstParam(params.month);
  const month = monthParam && /^\d{1,2}$/.test(monthParam) ? Number(monthParam) : undefined;
  if (month && month >= 1 && month <= 12) {
    const paddedMonth = String(month).padStart(2, '0');
    return {
      mode: 'month',
      startDate: `${year}-${paddedMonth}-01`,
      endDate: `${year}-${paddedMonth}-${new Date(year, month, 0).getDate()}`,
    };
  }
  return { mode: 'year', startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export function buildChekiDeepLinkState(
  params: ChekiFilterRouteParams,
  previousMode: ChekiBrowseMode,
): ChekiDeepLinkState {
  const artistIds = parseArtistIds(params.artist_id);
  const eventId = firstParam(params.event_id) ?? null;
  const preset = firstParam(params.preset);
  const clearsDate = preset === 'all';
  const date = clearsDate ? null : parseDateFilter(params);
  const browse = firstParam(params.browse);
  const requestedMode = browse === 'album' || browse === 'record' ? browse : null;
  const hasDeepLink = artistIds.length > 0
    || eventId !== null
    || date !== null
    || preset === 'all'
    || requestedMode !== null;

  if (!hasDeepLink) return { hasDeepLink: false, targetMode: previousMode };

  // Exact event filtering currently belongs to Record mode and takes precedence
  // over a conflicting explicit browse request.
  const targetMode: ChekiBrowseMode = eventId ? 'record' : requestedMode ?? previousMode;
  const replacesFilters = artistIds.length > 0 || eventId !== null || date !== null;
  if (!replacesFilters) {
    return {
      hasDeepLink: true,
      targetMode,
      filterAction: clearsDate ? 'clearDate' : 'preserve',
    };
  }

  if (targetMode === 'record') {
    return {
      hasDeepLink: true,
      targetMode,
      filterAction: 'replace',
      filters: {
        ...EMPTY_CHEKI_RECORD_FILTERS,
        artistIds,
        eventId,
        date,
      },
    };
  }

  return {
    hasDeepLink: true,
    targetMode,
    filterAction: 'replace',
    filters: {
      ...EMPTY_CHEKI_ITEM_FILTERS,
      artistIds,
      date,
    },
  };
}

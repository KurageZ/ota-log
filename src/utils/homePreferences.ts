import AsyncStorage from '@react-native-async-storage/async-storage';

export const HOME_PREFERENCES_STORAGE_KEY = 'ota-log.home-preferences.v1';
export const MAX_FEATURED_ARTISTS_PER_HOME_CARD = 5;
export const MIN_RECENT_COMPLETED_DISPLAY_LIMIT = 1;
export const MAX_RECENT_COMPLETED_DISPLAY_LIMIT = 20;
export const DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT = 5;
export const RECENT_COMPLETED_DISPLAY_ALL = 'all';

export type RecentCompletedDisplayLimit = number | typeof RECENT_COMPLETED_DISPLAY_ALL;
export type HomePinnedInfoType = 'nextEvent' | 'featuredArtist' | 'monthSummary';

export type HomePinnedInfoConfig =
  | { type: 'nextEvent' }
  | { type: 'featuredArtist'; artistId: string | null }
  | { type: 'monthSummary' };

export type HomePreferences = {
  pinnedInfo: HomePinnedInfoConfig;
  cards: HomeCardConfig[];
};

export type HomeSingletonCardType = 'featuredArtist' | 'recentCompleted' | 'monthOverview' | 'chekiOverview' | 'importantDates';
export type HomeCardType = 'futureActivity' | HomeSingletonCardType;

export type HomeCardConfig =
  | { type: 'futureActivity'; visible: boolean }
  | { type: 'featuredArtist'; visible: boolean; artistIds: string[] }
  | { type: 'recentCompleted'; visible: boolean; displayLimit: RecentCompletedDisplayLimit }
  | { type: 'importantDates'; visible: boolean; dateItemIds: string[] }
  | { type: 'monthOverview' | 'chekiOverview'; visible: boolean };

const SINGLETON_CARD_TYPES: HomeSingletonCardType[] = ['featuredArtist', 'recentCompleted', 'monthOverview', 'chekiOverview', 'importantDates'];

export const HOME_CARD_LABELS: Record<HomeCardType, string> = {
  futureActivity: '未来活动',
  recentCompleted: '最近完成',
  monthOverview: '本月概览',
  chekiOverview: '拍立得',
  featuredArtist: '关注艺人',
  importantDates: '重要日期',
};

export const HOME_PINNED_INFO_LABELS: Record<HomePinnedInfoType, string> = {
  nextEvent: '下一场活动',
  featuredArtist: '关注艺人',
  monthSummary: '本月概览',
};

export function createDefaultHomePinnedInfo(): HomePinnedInfoConfig {
  return { type: 'nextEvent' };
}

export function createDefaultHomeCards(oshiArtistId?: string | null): HomeCardConfig[] {
  return [
    { type: 'futureActivity', visible: true },
    { type: 'recentCompleted', visible: true, displayLimit: DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT },
    { type: 'chekiOverview', visible: true },
    { type: 'featuredArtist', visible: false, artistIds: oshiArtistId ? [oshiArtistId] : [] },
    { type: 'monthOverview', visible: false },
    { type: 'importantDates', visible: false, dateItemIds: [] },
  ];
}

export function createDefaultHomePreferences(oshiArtistId?: string | null): HomePreferences {
  return {
    pinnedInfo: createDefaultHomePinnedInfo(),
    cards: createDefaultHomeCards(oshiArtistId),
  };
}

export function getHomeCardKey(card: HomeCardConfig): string {
  return card.type;
}

export function sanitizeHomePinnedInfo(
  value: unknown,
  options: {
    validArtistIds?: Set<string>;
  } = {},
): HomePinnedInfoConfig {
  if (!value || typeof value !== 'object' || !('type' in value)) return createDefaultHomePinnedInfo();

  if (value.type === 'featuredArtist') {
    const rawArtistId = 'artistId' in value ? value.artistId : null;
    const artistId = typeof rawArtistId === 'string' && rawArtistId.trim() ? rawArtistId : null;
    return {
      type: 'featuredArtist',
      artistId: artistId && (!options.validArtistIds || options.validArtistIds.has(artistId)) ? artistId : null,
    };
  }

  if (value.type === 'monthSummary') return { type: 'monthSummary' };

  return createDefaultHomePinnedInfo();
}

export function sanitizeHomeCards(
  value: unknown,
  options: {
    validArtistIds?: Set<string>;
    validDateItemIds?: Set<string>;
  } = {},
): HomeCardConfig[] {
  if (!Array.isArray(value)) return createDefaultHomeCards();

  const cards: HomeCardConfig[] = [];
  const seenSingletons = new Set<HomeSingletonCardType>();
  let hasFutureActivity = false;

  value.forEach((item) => {
    if (!item || typeof item !== 'object' || !('type' in item)) return;
    const type = item.type;

    if (type === 'futureActivity') {
      if (hasFutureActivity) return;
      hasFutureActivity = true;
      cards.push({
        type: 'futureActivity',
        visible: 'visible' in item && typeof item.visible === 'boolean' ? item.visible : true,
      });
      return;
    }

    if (type === 'featuredArtist') {
      const artistIds = extractFeaturedArtistIds(item, options.validArtistIds);
      const existing = cards.find((card): card is Extract<HomeCardConfig, { type: 'featuredArtist' }> => card.type === 'featuredArtist');

      if (existing) {
        artistIds.forEach((artistId) => {
          if (existing.artistIds.length >= MAX_FEATURED_ARTISTS_PER_HOME_CARD) return;
          if (!existing.artistIds.includes(artistId)) existing.artistIds.push(artistId);
        });
        return;
      }

      seenSingletons.add('featuredArtist');
      cards.push({
        type: 'featuredArtist',
        visible: 'visible' in item && typeof item.visible === 'boolean' ? item.visible : true,
        artistIds,
      });
      return;
    }

    if (type === 'importantDates') {
      if (seenSingletons.has('importantDates')) return;
      seenSingletons.add('importantDates');
      cards.push({
        type: 'importantDates',
        visible: 'visible' in item && typeof item.visible === 'boolean' ? item.visible : true,
        dateItemIds: extractImportantDateIds(item, options.validDateItemIds),
      });
      return;
    }

    if (isSingletonCardType(type) && !seenSingletons.has(type)) {
      seenSingletons.add(type);
      cards.push(createSanitizedSingletonCard(type, item));
    }
  });

  if (!hasFutureActivity) {
    cards.unshift({ type: 'futureActivity', visible: true });
  }

  SINGLETON_CARD_TYPES.forEach((type) => {
    if (!seenSingletons.has(type)) {
      cards.push(createMissingSingletonCard(type));
    }
  });

  return cards;
}

export async function loadHomeCards(options: {
  oshiArtistId?: string | null;
  validArtistIds?: Set<string>;
  validDateItemIds?: Set<string>;
} = {}): Promise<HomeCardConfig[]> {
  const preferences = await loadHomePreferences(options);
  return preferences.cards;
}

export async function loadHomePreferences(options: {
  oshiArtistId?: string | null;
  validArtistIds?: Set<string>;
  validDateItemIds?: Set<string>;
} = {}): Promise<HomePreferences> {
  try {
    const raw = await AsyncStorage.getItem(HOME_PREFERENCES_STORAGE_KEY);
    if (!raw) return createDefaultHomePreferences(options.oshiArtistId);
    return sanitizeHomePreferences(JSON.parse(raw), options);
  } catch {
    return createDefaultHomePreferences(options.oshiArtistId);
  }
}

export async function saveHomeCards(cards: HomeCardConfig[]): Promise<void> {
  const existingPreferences = await loadHomePreferences();
  await saveHomePreferences({
    pinnedInfo: existingPreferences.pinnedInfo,
    cards,
  });
}

export async function saveHomePreferences(preferences: HomePreferences): Promise<void> {
  await AsyncStorage.setItem(
    HOME_PREFERENCES_STORAGE_KEY,
    JSON.stringify({
      pinnedInfo: sanitizeHomePinnedInfo(preferences.pinnedInfo),
      cards: sanitizeHomeCards(preferences.cards),
    }),
  );
}

export function sanitizeHomePreferences(
  value: unknown,
  options: {
    oshiArtistId?: string | null;
    validArtistIds?: Set<string>;
    validDateItemIds?: Set<string>;
  } = {},
): HomePreferences {
  if (Array.isArray(value)) {
    return {
      pinnedInfo: createDefaultHomePinnedInfo(),
      cards: applyOshiToEmptyFeaturedArtist(
        sanitizeHomeCards(value, { validArtistIds: options.validArtistIds, validDateItemIds: options.validDateItemIds }),
        options.oshiArtistId,
        options.validArtistIds,
      ),
    };
  }

  if (!value || typeof value !== 'object') return createDefaultHomePreferences(options.oshiArtistId);

  const rawCards = 'cards' in value ? value.cards : undefined;
  return {
    pinnedInfo: sanitizeHomePinnedInfo('pinnedInfo' in value ? value.pinnedInfo : undefined, {
      validArtistIds: options.validArtistIds,
    }),
    cards: applyOshiToEmptyFeaturedArtist(
      sanitizeHomeCards(rawCards, { validArtistIds: options.validArtistIds, validDateItemIds: options.validDateItemIds }),
      options.oshiArtistId,
      options.validArtistIds,
    ),
  };
}

function isSingletonCardType(type: unknown): type is HomeSingletonCardType {
  return type === 'featuredArtist' || type === 'recentCompleted' || type === 'monthOverview' || type === 'chekiOverview' || type === 'importantDates';
}

function createSanitizedSingletonCard(type: HomeSingletonCardType, item: object): Extract<HomeCardConfig, { type: HomeSingletonCardType }> {
  const visible = 'visible' in item && typeof item.visible === 'boolean' ? item.visible : true;
  if (type === 'featuredArtist') {
    return { type, visible, artistIds: [] };
  }
  if (type === 'recentCompleted') {
    return {
      type,
      visible,
      displayLimit: sanitizeRecentCompletedDisplayLimit('displayLimit' in item ? item.displayLimit : undefined),
    };
  }
  if (type === 'importantDates') return { type, visible, dateItemIds: extractImportantDateIds(item) };
  return { type, visible };
}

function createMissingSingletonCard(type: HomeSingletonCardType): Extract<HomeCardConfig, { type: HomeSingletonCardType }> {
  if (type === 'featuredArtist') return { type, visible: false, artistIds: [] };
  if (type === 'recentCompleted') {
    return { type, visible: true, displayLimit: DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT };
  }
  if (type === 'chekiOverview') return { type, visible: true };
  if (type === 'importantDates') return { type, visible: false, dateItemIds: [] };
  return { type, visible: false };
}

function extractFeaturedArtistIds(item: object, validArtistIds?: Set<string>): string[] {
  const rawArtistIds = 'artistIds' in item && Array.isArray(item.artistIds)
    ? item.artistIds
    : 'artistId' in item
      ? [item.artistId]
      : [];
  const artistIds: string[] = [];

  rawArtistIds.forEach((rawArtistId) => {
    const artistId = typeof rawArtistId === 'string' && rawArtistId.trim() ? rawArtistId : null;
    if (!artistId) return;
    if (validArtistIds && !validArtistIds.has(artistId)) return;
    if (artistIds.includes(artistId)) return;
    if (artistIds.length >= MAX_FEATURED_ARTISTS_PER_HOME_CARD) return;
    artistIds.push(artistId);
  });

  return artistIds;
}

export function sanitizeRecentCompletedDisplayLimit(value: unknown): RecentCompletedDisplayLimit {
  if (value === RECENT_COMPLETED_DISPLAY_ALL) return RECENT_COMPLETED_DISPLAY_ALL;
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_RECENT_COMPLETED_DISPLAY_LIMIT;
  return Math.min(
    MAX_RECENT_COMPLETED_DISPLAY_LIMIT,
    Math.max(MIN_RECENT_COMPLETED_DISPLAY_LIMIT, Math.trunc(numericValue)),
  );
}

function extractImportantDateIds(item: object, validDateItemIds?: Set<string>): string[] {
  const rawIds = 'dateItemIds' in item && Array.isArray(item.dateItemIds) ? item.dateItemIds : [];
  const dateItemIds: string[] = [];

  rawIds.forEach((rawId) => {
    const dateItemId = typeof rawId === 'string' && rawId.trim() ? rawId : null;
    if (!dateItemId) return;
    if (validDateItemIds && !validDateItemIds.has(dateItemId)) return;
    if (dateItemIds.includes(dateItemId)) return;
    dateItemIds.push(dateItemId);
  });

  return dateItemIds;
}

function applyOshiToEmptyFeaturedArtist(
  cards: HomeCardConfig[],
  oshiArtistId?: string | null,
  validArtistIds?: Set<string>,
): HomeCardConfig[] {
  if (!oshiArtistId || (validArtistIds && !validArtistIds.has(oshiArtistId))) return cards;
  if (cards.some((card) => card.type === 'featuredArtist' && card.artistIds.includes(oshiArtistId))) return cards;

  let didApply = false;
  return cards.map((card) => {
    if (didApply || card.type !== 'featuredArtist' || !card.visible || card.artistIds.length > 0) return card;
    didApply = true;
    return { ...card, artistIds: [oshiArtistId] };
  });
}

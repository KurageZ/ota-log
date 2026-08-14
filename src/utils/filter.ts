import { Artist } from '../types/models';
import {
  normalizeArtistComparisonText,
  normalizeArtistSearchText,
} from './artistName';

export function sortArtistsWithOshi(artists: Artist[], oshiArtistId?: string | null): Artist[] {
  if (!oshiArtistId) return artists;
  return [...artists].sort((a, b) => {
    if (a.id === oshiArtistId) return -1;
    if (b.id === oshiArtistId) return 1;
    return 0;
  });
}

type ArtistLookup = Map<string, Artist> | Artist[];

function toArtistMap(artists?: ArtistLookup): Map<string, Artist> | null {
  if (!artists) return null;
  return artists instanceof Map ? artists : new Map(artists.map((artist) => [artist.id, artist]));
}

function collectParentChainIds(artistId: string, artistMap: Map<string, Artist> | null): Set<string> {
  const ids = new Set<string>();
  let cursor: string | null | undefined = artistId;
  while (cursor && !ids.has(cursor)) {
    ids.add(cursor);
    const current: Artist | undefined = artistMap?.get(cursor);
    if (!current) break;
    cursor = current.parent_id;
  }
  return ids;
}

export type ArtistTypePreference = 'group' | 'person' | null;

export function sortArtistsByPreference(
  artists: Artist[],
  oshiArtistId?: string | null,
  typePreference?: ArtistTypePreference,
  lookup?: ArtistLookup,
): Artist[] {
  const hasPreference = oshiArtistId != null
    || typePreference != null
    || artists.some((artist) => artist.is_favorite === 1);
  if (!hasPreference) return artists;

  const chainLookup = lookup ?? artists;
  const chainMap = toArtistMap(chainLookup);
  const chainArtists = chainMap ? [...chainMap.values()] : [];
  const oshiChain = oshiArtistId
    ? collectParentChainIds(oshiArtistId, chainMap)
    : new Set<string>();
  const favoriteChain = new Set<string>();
  for (const artist of chainArtists) {
    if (artist.is_favorite === 1) {
      collectParentChainIds(artist.id, chainMap).forEach((id) => favoriteChain.add(id));
    }
  }
  const parentIdSet = new Set<string>();
  for (const artist of chainArtists) {
    if (artist.parent_id) parentIdSet.add(artist.parent_id);
  }
  const artistTypeOf = (artistId: string): 'group' | 'person' | null => {
    const current = chainMap?.get(artistId);
    if (!current) return null;
    if (current.artist_type === 'group' || current.artist_type === 'person') return current.artist_type;
    // 未设置类型时按结构推断：被其他艺人当作所属团体的视为团体，有所属团体的视为个人
    if (parentIdSet.has(artistId)) return 'group';
    if (current.parent_id) return 'person';
    return null;
  };

  return [...artists].sort((a, b) => rankOf(a, oshiArtistId, oshiChain, favoriteChain, typePreference, artistTypeOf)
    - rankOf(b, oshiArtistId, oshiChain, favoriteChain, typePreference, artistTypeOf));
}

function rankOf(
  artist: Artist,
  oshiArtistId: string | null | undefined,
  oshiChain: Set<string>,
  favoriteChain: Set<string>,
  typePreference: ArtistTypePreference | undefined,
  artistTypeOf: (artistId: string) => 'group' | 'person' | null,
): number {
  // 单推艺人永远第一
  if (oshiArtistId != null && artist.id === oshiArtistId) return 0;

  if (typePreference === 'group') {
    // 单推所属团体 > 收藏团体（及其所属团体） > 其他团体 > 收藏个人 > 其他个人 > 未设置类型
    if (oshiArtistId != null && oshiChain.has(artist.id)) return 1;
    const type = artistTypeOf(artist.id);
    if (type === 'group') return favoriteChain.has(artist.id) ? 2 : 3;
    if (type === 'person') return favoriteChain.has(artist.id) ? 4 : 5;
    return 6;
  }

  if (typePreference === 'person') {
    // 收藏个人 > 其他个人 > 团体 > 未设置类型
    const type = artistTypeOf(artist.id);
    if (type === 'person') return favoriteChain.has(artist.id) ? 1 : 2;
    if (type === 'group') return 3;
    return 4;
  }

  // 不区分类型：单推及其所属团体 > 收藏及其所属团体 > 其他
  if (oshiChain.has(artist.id)) return 0;
  if (favoriteChain.has(artist.id)) return 1;
  return 2;
}

export function getArtistSearchText(artist: Artist, artists?: ArtistLookup): string {
  const artistMap = toArtistMap(artists);
  const terms = [
    artist.name,
    artist.short_name,
  ];
  const seen = new Set<string>([artist.id]);
  let cursor = artist.parent_id;

  while (artistMap && cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const parent = artistMap.get(cursor);
    if (!parent) break;
    terms.push(parent.name, parent.short_name);
    cursor = parent.parent_id;
  }

  return [
    ...terms,
  ].filter((value): value is string => Boolean(value?.trim())).join(' ');
}

export function filterArtistsByQuery(
  artists: Artist[],
  query: string,
  oshiArtistId?: string | null,
  lookup?: ArtistLookup,
): Artist[] {
  const searchQuery = normalizeArtistSearchText(query);
  const aliasQuery = normalizeArtistComparisonText(query);
  const artistMap = toArtistMap(lookup ?? artists);
  const filtered = !searchQuery ? artists : artists.filter((artist) => {
    const searchText = getArtistSearchText(artist, artistMap ?? undefined);
    if (normalizeArtistSearchText(searchText).includes(searchQuery)) return true;
    return aliasQuery !== ''
      && normalizeArtistComparisonText(searchText).includes(aliasQuery);
  });
  return sortArtistsWithOshi(filtered, oshiArtistId);
}

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

export function filterArtistsByQuery(artists: Artist[], query: string, oshiArtistId?: string | null): Artist[] {
  const searchQuery = normalizeArtistSearchText(query);
  const aliasQuery = normalizeArtistComparisonText(query);
  const artistMap = toArtistMap(artists);
  const filtered = !searchQuery ? artists : artists.filter((artist) => {
    const searchText = getArtistSearchText(artist, artistMap ?? undefined);
    if (normalizeArtistSearchText(searchText).includes(searchQuery)) return true;
    return aliasQuery !== ''
      && normalizeArtistComparisonText(searchText).includes(aliasQuery);
  });
  return sortArtistsWithOshi(filtered, oshiArtistId);
}

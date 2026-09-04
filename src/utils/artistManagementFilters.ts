import type { Artist } from '../types/models';

export type ArtistGroupFilter = 'has_parent' | 'no_parent' | null;

export function matchesArtistGroupFilter(
  artist: Artist,
  groupFilter: ArtistGroupFilter,
  hasCurrentGroup: boolean,
): boolean {
  const hasGroup = Boolean(artist.parent_id || hasCurrentGroup);
  if (groupFilter === 'has_parent' && !hasGroup) return false;
  if (groupFilter === 'no_parent' && (artist.artist_type === 'group' || hasGroup)) return false;
  return true;
}

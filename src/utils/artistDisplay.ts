import { Artist } from '../types/models';

export type ArtistDisplayMode = 'compact' | 'management';

interface ArtistDisplayInput {
  artist: Artist;
  parentName?: string | null;
  mode?: ArtistDisplayMode;
}

export interface ArtistDisplayText {
  title: string;
  subtitle: string | null;
}

export function getArtistPrimaryName(artist: Artist): string {
  return artist.short_name?.trim() || artist.name;
}

export function getArtistDisplayText({
  artist,
  parentName,
  mode = 'compact',
}: ArtistDisplayInput): ArtistDisplayText {
  const shortName = artist.short_name?.trim() || null;
  const parent = parentName?.trim() || null;

  if (mode === 'management') {
    return {
      title: shortName || artist.name,
      subtitle: parent,
    };
  }

  return {
    title: shortName || artist.name,
    subtitle: null,
  };
}

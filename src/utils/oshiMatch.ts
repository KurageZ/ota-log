import { Artist, EventStatus } from '../types/models';

export type OshiMatchSource = 'direct' | 'member-of-oshi' | 'oshi-member-group' | null;
export type EventCardOshiBadge =
  | { visible: false }
  | { visible: true; artistName: string };

export function getOshiMatchSource(
  eventArtists: Artist[],
  oshiArtistId: string,
  oshiArtist: Artist | null,
  isAttributed = false,
): OshiMatchSource {
  if (eventArtists.some((artist) => artist.id === oshiArtistId)) {
    return 'direct';
  }

  if (isAttributed && oshiArtist?.artist_type === 'person') {
    return 'oshi-member-group';
  }

  return null;
}

export function getEventCardOshiBadge(
  status: EventStatus,
  oshiArtistName: string | null | undefined,
): EventCardOshiBadge {
  if (status !== 'planned' || !oshiArtistName) {
    return { visible: false };
  }

  return { visible: true, artistName: oshiArtistName };
}

import type { EventFormValues } from '../components/EventForm';
import type { Artist } from '../types/models';
import { matchArtistsFromMentions, type ArtistCandidate } from './artistMatching';
import type { ParsedAnnouncement } from './parseAnnouncement';

export interface ParsedEventDraftResult {
  fields: Partial<EventFormValues>;
  matchedIds: string[];
  candidates: ArtistCandidate[];
  shouldConfirmArtists: boolean;
}

export function buildParsedEventDraft(
  announcementText: string,
  parsed: ParsedAnnouncement,
  allArtists: Array<Pick<Artist, 'id' | 'name' | 'short_name'>>,
  extraFields: Partial<EventFormValues> = {},
): ParsedEventDraftResult {
  const { matchedIds, candidates } = matchArtistsFromMentions(
    parsed.artist_mentions,
    allArtists,
    { announcementText },
  );

  const fields: Partial<EventFormValues> = {
    details: announcementText,
    ...(parsed.title ? { title: parsed.title } : {}),
    ...(parsed.event_date ? { event_date: parsed.event_date } : {}),
    ...(parsed.event_time ? { event_time: parsed.event_time } : {}),
    ...(parsed.city ? { city: parsed.city } : {}),
    ...(parsed.venue ? { venue: parsed.venue } : {}),
    ...(parsed.ticket_price != null ? { ticket_price: String(parsed.ticket_price) } : {}),
    ...extraFields,
  };

  return {
    fields,
    matchedIds,
    candidates,
    shouldConfirmArtists: candidates.length > 0,
  };
}

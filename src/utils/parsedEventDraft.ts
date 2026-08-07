import type { EventFormPrefill } from '../components/EventForm';
import type { Artist } from '../types/models';
import { matchArtistsFromMentions, type ArtistCandidate } from './artistMatching';
import type { ParsedAnnouncement } from './parseAnnouncement';

export interface ParsedEventDraftResult {
  fields: EventFormPrefill;
  matchedIds: string[];
  candidates: ArtistCandidate[];
  shouldConfirmArtists: boolean;
}

export function buildParsedEventDraft(
  announcementText: string,
  parsed: ParsedAnnouncement,
  allArtists: Array<Pick<Artist, 'id' | 'name' | 'short_name'>>,
  extraFields: EventFormPrefill = {},
): ParsedEventDraftResult {
  const { matchedIds, candidates } = matchArtistsFromMentions(
    parsed.artist_mentions,
    allArtists,
    { announcementText },
  );
  const hasStructuredTime = Boolean(parsed.open_time || parsed.start_time || parsed.end_time);

  const fields: EventFormPrefill = {
    details: announcementText,
    ...(parsed.title ? { title: parsed.title } : {}),
    ...(hasStructuredTime ? {
      sessions: [{
        key: 'parsed-session',
        title: '',
        session_date: parsed.event_date ?? '',
        end_date: '',
        open_time: parsed.open_time ?? '',
        start_time: parsed.start_time ?? '',
        end_time: parsed.end_time ?? '',
        city: parsed.city ?? '',
        venue: parsed.venue ?? '',
        timetable: [],
      }],
    } : {
      ...(parsed.event_date ? { event_date: parsed.event_date } : {}),
      ...(parsed.event_time ? { event_time: parsed.event_time } : {}),
      ...(parsed.city ? { city: parsed.city } : {}),
      ...(parsed.venue ? { venue: parsed.venue } : {}),
    }),
    ...extraFields,
  };

  return {
    fields,
    matchedIds,
    candidates,
    shouldConfirmArtists: candidates.length > 0,
  };
}

import type { EventFormPrefill } from '../components/EventForm';
import type { Artist } from '../types/models';
import type { ImportedEventPage } from './ievent/importEvent';
import {
  appendImportedEventMedia,
  type RemoteFileDownloader,
} from './importedEventMedia';
import { matchArtistsFromMentions } from './artistMatching';
import { normalizeArtistComparisonText } from './artistName';
import type { ParsedEventDraftResult } from './parsedEventDraft';

export interface ImportedEventDraftHandoff {
  draft: ParsedEventDraftResult;
  photoUris: string[];
  mediaDownloadFailed: boolean;
}

export async function prepareImportedEventDraft(
  event: ImportedEventPage,
  allArtists: Array<Pick<Artist, 'id' | 'name' | 'short_name'>>,
  existingPhotoUris: string[],
  downloader?: RemoteFileDownloader,
): Promise<ImportedEventDraftHandoff> {
  const media = await appendImportedEventMedia(
    existingPhotoUris,
    event.photoUrls,
    downloader,
  );
  const { matchedIds, matches, candidates } = matchArtistsFromMentions(
    event.parsed.artist_mentions,
    allArtists,
    { announcementText: event.details },
  );
  const matchedByName = new Map(matches.map((match) => [
    normalizeArtistComparisonText(match.rawName),
    match.artistId,
  ]));
  const fields: EventFormPrefill = {
    title: event.parsed.title ?? '',
    sessions: event.sessions.map((session, sessionIndex) => ({
      key: `ievent-session-${session.sourceEventId}-${sessionIndex}`,
      title: session.title,
      session_date: session.sessionDate,
      end_date: session.endDate ?? '',
      open_time: session.openTime ?? '',
      start_time: session.startTime ?? '',
      end_time: session.endTime ?? '',
      city: session.city ?? '',
      venue: session.venue ?? '',
      timetable: session.timetable.map((entry, entryIndex) => ({
        key: `ievent-entry-${session.sourceEventId}-${entryIndex}`,
        source_artist_name: entry.artistName ?? undefined,
        title: entry.title,
        artist_id: entry.artistName
          ? matchedByName.get(normalizeArtistComparisonText(entry.artistName)) ?? ''
          : '',
        start_time: entry.startTime ?? '',
        end_time: entry.endTime ?? '',
        notes: entry.notes ?? '',
      })),
    })),
    actual_expense: event.parsed.ticket_price == null ? '' : String(event.parsed.ticket_price),
    details: event.details,
    url: event.sourceUrl,
  };

  return {
    draft: {
      fields,
      matchedIds,
      candidates,
      shouldConfirmArtists: candidates.length > 0,
    },
    photoUris: media.photoUris,
    mediaDownloadFailed: media.downloadFailed,
  };
}

export function applyImportedTimetableArtistResolutions(
  fields: EventFormPrefill,
  resolutions: Map<string, string>,
): EventFormPrefill {
  if (!fields.sessions || resolutions.size === 0) return fields;
  const normalizedResolutions = new Map(
    [...resolutions].map(([name, artistId]) => [normalizeArtistComparisonText(name), artistId]),
  );
  return {
    ...fields,
    sessions: fields.sessions.map((session) => ({
      ...session,
      timetable: session.timetable.map((entry) => ({
        ...entry,
        artist_id: entry.source_artist_name
          ? normalizedResolutions.get(normalizeArtistComparisonText(entry.source_artist_name))
            ?? entry.artist_id
          : entry.artist_id,
      })),
    })),
  };
}

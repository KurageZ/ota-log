import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Repositories } from '../context/DBContext';
import type {
  AnnouncementArtistCatalogEntry,
  AnnouncementCase,
  AnnouncementCaseFixture,
} from '../types/announcementCases';
import type { Artist, Event } from '../types/models';

interface EventArtistRow {
  event_id: string;
  artist_id: string;
}

type AnnouncementArtistInput = Pick<Artist, 'id' | 'name' | 'short_name'>;
interface AnnouncementEventInput {
  id: Event['id'];
  title: Event['title'];
  event_date: Event['event_date'] | null;
  event_time: Event['event_time'];
  city: Event['city'];
  venue: Event['venue'];
  ticket_price: Event['ticket_price'];
  details: Event['details'];
  created_at: Event['created_at'];
}

function getReferenceYear(eventDate: string | null, now: Date): number {
  const eventYear = eventDate ? Number.parseInt(eventDate.slice(0, 4), 10) : Number.NaN;
  if (Number.isInteger(eventYear) && eventYear >= 2000) {
    return eventYear;
  }

  return now.getFullYear();
}

function compareEventsDesc(left: AnnouncementEventInput, right: AnnouncementEventInput): number {
  return (
    String(right.event_date ?? '').localeCompare(String(left.event_date ?? '')) ||
    String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')) ||
    String(right.id).localeCompare(String(left.id))
  );
}

export function buildAnnouncementCaseFixture(
  artists: AnnouncementArtistInput[],
  events: AnnouncementEventInput[],
  eventArtists: EventArtistRow[],
  now: Date = new Date(),
): AnnouncementCaseFixture {
  const artistCatalog: AnnouncementArtistCatalogEntry[] = artists
    .map((artist) => ({
      id: artist.id,
      name: artist.name,
      short_name: artist.short_name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const artistMap = new Map(artistCatalog.map((artist) => [artist.id, artist]));
  const linkedArtistIdsByEventId = new Map<string, string[]>();

  for (const row of eventArtists) {
    const linkedArtistIds = linkedArtistIdsByEventId.get(row.event_id) ?? [];
    if (!linkedArtistIds.includes(row.artist_id)) {
      linkedArtistIds.push(row.artist_id);
      linkedArtistIdsByEventId.set(row.event_id, linkedArtistIds);
    }
  }

  const cases: AnnouncementCase[] = events
    .filter((event) => typeof event.details === 'string' && event.details.trim() !== '')
    .sort(compareEventsDesc)
    .map((event) => {
      const linkedArtistIds = [...(linkedArtistIdsByEventId.get(event.id) ?? [])];
      return {
        id: event.id,
        referenceYear: getReferenceYear(event.event_date, now),
        rawText: event.details!.trim(),
        baseline: {
          title: event.title,
          event_date: event.event_date,
          event_time: event.event_time,
          city: event.city,
          venue: event.venue,
          ticket_price: event.ticket_price,
          linkedArtistIds,
        },
        expected: {
          parsed: {
            title: event.title,
            event_date: event.event_date,
            event_time: event.event_time,
            city: event.city,
            venue: event.venue,
            artist: null,
            ticket_price: event.ticket_price,
          },
          match: {
            matchedArtistIds: linkedArtistIds,
            unmatchedArtistNames: [],
          },
        },
        notes: '',
      };
    });

  return {
    draft: true,
    generated_at: now.toISOString(),
    artistCatalog,
    cases,
  };
}

export async function exportAnnouncementCasesJson(db: Repositories): Promise<{
  fileUri: string;
  filename: string;
  caseCount: number;
}> {
  const [artists, events, eventArtists] = await Promise.all([
    db.artists.findAll(),
    db.events.findAll(),
    db.rawDb.getAllAsync<EventArtistRow>('SELECT event_id, artist_id FROM event_artists'),
  ]);

  const now = new Date();
  const fixture = buildAnnouncementCaseFixture(artists, events, eventArtists, now);
  const filename = `announcement_cases_${now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_')}.json`;
  const file = new File(Paths.cache, filename);
  file.write(JSON.stringify(fixture, null, 2));

  return {
    fileUri: file.uri,
    filename: file.name,
    caseCount: fixture.cases.length,
  };
}

export async function shareAnnouncementCasesJson(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('导出失败，请稍后重试');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: '导出解析样本 JSON',
  });
}

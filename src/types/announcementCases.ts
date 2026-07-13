import type { ParsedAnnouncement } from '../utils/parseAnnouncement';
import type { Artist } from './models';

export type AnnouncementArtistCatalogEntry = Pick<Artist, 'id' | 'name' | 'short_name'>;

export interface AnnouncementCaseBaseline {
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  city: string | null;
  venue: string | null;
  ticket_price: number | null;
  linkedArtistIds: string[];
}

export interface AnnouncementCaseExpected {
  parsed: Partial<ParsedAnnouncement>;
  match: {
    matchedArtistIds: string[];
    unmatchedArtistNames: string[];
  };
}

export interface AnnouncementCase {
  id: string;
  referenceYear: number;
  rawText: string;
  baseline: AnnouncementCaseBaseline;
  expected: AnnouncementCaseExpected;
  notes: string;
}

export interface AnnouncementCaseFixture {
  draft: boolean;
  generated_at: string;
  artistCatalog: AnnouncementArtistCatalogEntry[];
  cases: AnnouncementCase[];
}

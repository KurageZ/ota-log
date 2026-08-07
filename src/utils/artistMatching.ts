import { Artist } from '../types/models';
import type { ArtistMention } from './parseAnnouncement';
import {
  normalizeArtistComparisonText,
  normalizeArtistSurfaceText,
  normalizeArtistVisualComparisonText,
  splitArtistHandle,
} from './artistName';

export type ArtistMatchConfidence =
  | 'exact'
  | 'normalized-exact'
  | 'alias-exact'
  | 'visual-exact'
  | 'contains';

export interface ArtistMatchSuggestion {
  artistId: string;
  name: string;
  short_name: string | null;
  confidence: ArtistMatchConfidence;
  matchedField: 'name' | 'short_name';
}

export interface ArtistCandidate {
  rawName: string;
  name: string;
  short_name: string | null;
  editName: string;
  resolution: 'create' | 'skip' | string;
  suggestions: ArtistMatchSuggestion[];
}

export interface ArtistMatch {
  rawName: string;
  artistId: string;
  confidence: ArtistMatchConfidence;
  matchedField: 'name' | 'short_name';
}

interface ScoredArtist {
  artist: Pick<Artist, 'id' | 'name' | 'short_name'>;
  score: number;
  confidence: ArtistMatchConfidence;
  matchedField: 'name' | 'short_name';
}

const ULTIMATUM_GAME_EMOJI_ARTISTS: Array<[string, string]> = [
  ['⛩️', 'FixtureArtist040'],
  ['💎', 'FixtureArtist023'],
  ['🌋', 'FixtureArtist030'],
  ['🌀', 'FixtureArtist011'],
];

function getFieldMatch(
  rawName: string,
  fieldValue: string,
  matchedField: ScoredArtist['matchedField'],
): Omit<ScoredArtist, 'artist'> | null {
  const rawTrimmed = rawName.trim();
  const fieldTrimmed = fieldValue.trim();
  if (!rawTrimmed || !fieldTrimmed) return null;

  if (rawTrimmed === fieldTrimmed) {
    return { score: 400, confidence: 'exact', matchedField };
  }

  const normalizedRaw = normalizeArtistSurfaceText(rawTrimmed);
  const normalizedField = normalizeArtistSurfaceText(fieldTrimmed);
  if (normalizedRaw === normalizedField) {
    return { score: 300, confidence: 'normalized-exact', matchedField };
  }

  const comparisonRaw = normalizeArtistComparisonText(rawTrimmed);
  const comparisonField = normalizeArtistComparisonText(fieldTrimmed);
  if (!comparisonRaw || !comparisonField) return null;
  if (comparisonRaw === comparisonField) {
    return { score: 200, confidence: 'alias-exact', matchedField };
  }

  const visualRaw = normalizeArtistVisualComparisonText(rawTrimmed);
  const visualField = normalizeArtistVisualComparisonText(fieldTrimmed);
  if (visualRaw && visualRaw === visualField) {
    return { score: 150, confidence: 'visual-exact', matchedField };
  }

  if (
    comparisonRaw.length >= 3 &&
    comparisonField.length >= 3 &&
    (comparisonRaw.includes(comparisonField) || comparisonField.includes(comparisonRaw))
  ) {
    return {
      score: 100 + Math.min(comparisonRaw.length, comparisonField.length),
      confidence: 'contains',
      matchedField,
    };
  }

  return null;
}

function scoreArtist(
  rawName: string,
  artist: Pick<Artist, 'id' | 'name' | 'short_name'>,
): ScoredArtist | null {
  const matches = [
    getFieldMatch(rawName, artist.name, 'name'),
    artist.short_name ? getFieldMatch(rawName, artist.short_name, 'short_name') : null,
  ].filter((match): match is Omit<ScoredArtist, 'artist'> => match != null);
  if (matches.length === 0) return null;

  const best = matches.sort((left, right) => right.score - left.score)[0];
  return { artist, ...best };
}

function buildCandidate(rawName: string, suggestions: ScoredArtist[]): ArtistCandidate {
  const { name, short_name } = splitArtistHandle(rawName);
  return {
    rawName,
    name,
    short_name,
    editName: rawName,
    resolution: 'skip',
    suggestions: suggestions.map(({ artist, confidence, matchedField }) => ({
      artistId: artist.id,
      name: artist.name,
      short_name: artist.short_name ?? null,
      confidence,
      matchedField,
    })),
  };
}

export function enrichArtistMentions(
  mentions: ArtistMention[],
  announcementText?: string,
): Array<ArtistMention | { rawName: string; source: 'inferred'; order: number }> {
  if (!announcementText || !/ultimatum game/i.test(announcementText)) return mentions;

  const inferredNames: string[] = [];
  const hasKnownEmoji = ULTIMATUM_GAME_EMOJI_ARTISTS.some(([emoji]) => announcementText.includes(emoji));
  for (const [emoji, artistName] of ULTIMATUM_GAME_EMOJI_ARTISTS) {
    if (!hasKnownEmoji || announcementText.includes(emoji)) inferredNames.push(artistName);
  }

  return [
    ...mentions,
    ...inferredNames.map((rawName, index) => ({
      rawName,
      source: 'inferred' as const,
      order: mentions.length + index,
    })),
  ];
}

export function matchArtistsFromMentions(
  artistMentions: ArtistMention[],
  availableArtists: Array<Pick<Artist, 'id' | 'name' | 'short_name'>>,
  options: { announcementText?: string } = {},
): {
  matchedIds: string[];
  matches: ArtistMatch[];
  candidates: ArtistCandidate[];
} {
  const matchedIds: string[] = [];
  const matches: ArtistMatch[] = [];
  const candidates: ArtistCandidate[] = [];
  const seenMentionKeys = new Set<string>();
  const seenArtistIds = new Set<string>();

  for (const mention of enrichArtistMentions(artistMentions, options.announcementText)) {
    const rawName = mention.rawName.trim();
    const mentionKey = normalizeArtistComparisonText(rawName) || normalizeArtistSurfaceText(rawName);
    if (!mentionKey || seenMentionKeys.has(mentionKey)) continue;
    seenMentionKeys.add(mentionKey);

    const scored = availableArtists
      .map((artist) => scoreArtist(rawName, artist))
      .filter((match): match is ScoredArtist => match != null)
      .sort((left, right) => right.score - left.score || left.artist.name.localeCompare(right.artist.name));

    if (scored.length === 0) {
      candidates.push(buildCandidate(rawName, []));
      continue;
    }

    const topScore = scored[0].score;
    const topMatches = scored.filter((match) => match.score === topScore);
    if (
      topMatches.length > 1
      || topMatches[0].confidence === 'contains'
      || topMatches[0].confidence === 'visual-exact'
    ) {
      candidates.push(buildCandidate(rawName, topMatches));
      continue;
    }

    const best = topMatches[0];
    matches.push({
      rawName,
      artistId: best.artist.id,
      confidence: best.confidence,
      matchedField: best.matchedField,
    });
    if (!seenArtistIds.has(best.artist.id)) {
      seenArtistIds.add(best.artist.id);
      matchedIds.push(best.artist.id);
    }
  }

  return { matchedIds, matches, candidates };
}

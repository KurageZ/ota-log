import type { Artist } from '../types/models';
import { normalizeArtistComparisonText } from './artistName';

export interface ArtistNameRecommendationSource {
  name: string;
  short_name?: string | null;
}

export interface ArtistNameRecommendation {
  artistId: string;
  matchedText: string;
  score: number;
}

const GENERIC_NAME_TOKENS = new Set([
  'official',
  'idol',
  'idols',
  'girl',
  'girls',
  'group',
  'project',
  'member',
  '偶像',
  '少女',
  '女子',
  '组合',
  '組合',
  '团体',
  '團體',
]);

interface NamePart {
  normalized: string;
  display: string;
}

function aliasesOf(source: ArtistNameRecommendationSource): string[] {
  return [source.name, source.short_name]
    .filter((value): value is string => Boolean(value?.trim()));
}

function isCjkToken(value: string): boolean {
  return /^[\u3040-\u30ff\u3400-\u9fff]+$/.test(value);
}

function isMeaningfulToken(value: string): boolean {
  if (GENERIC_NAME_TOKENS.has(value)) return false;
  const length = Array.from(value).length;
  return isCjkToken(value) ? length >= 2 : length >= 3;
}

function isMeaningfulPartialToken(value: string): boolean {
  if (!isMeaningfulToken(value)) return false;
  return isCjkToken(value) || Array.from(value).length >= 4;
}

function nameParts(value: string): NamePart[] {
  const surface = value.normalize('NFKC').trim();
  const matches = surface.match(/[a-z0-9\u00c0-\u024f]+|[\u3040-\u30ff\u3400-\u9fff]+/gi) ?? [];
  return matches
    .map((display) => ({
      normalized: normalizeArtistComparisonText(display),
      display,
    }))
    .filter((part) => isMeaningfulToken(part.normalized));
}

function matchAliases(
  sourceAliases: string[],
  candidateAliases: string[],
): { matchedText: string; score: number } | null {
  let best: { matchedText: string; score: number } | null = null;

  for (const sourceAlias of sourceAliases) {
    const sourceCompact = normalizeArtistComparisonText(sourceAlias);
    if (!sourceCompact) continue;

    for (const candidateAlias of candidateAliases) {
      const candidateCompact = normalizeArtistComparisonText(candidateAlias);
      if (!candidateCompact) continue;

      const shorter = sourceCompact.length <= candidateCompact.length
        ? { normalized: sourceCompact, display: sourceAlias.trim() }
        : { normalized: candidateCompact, display: candidateAlias.trim() };
      if (
        isMeaningfulToken(shorter.normalized)
        && (sourceCompact.includes(candidateCompact) || candidateCompact.includes(sourceCompact))
      ) {
        const score = 300 + Array.from(shorter.normalized).length;
        if (!best || score > best.score) best = { matchedText: shorter.display, score };
      }

      const sourceParts = nameParts(sourceAlias);
      const candidateParts = nameParts(candidateAlias);
      for (const sourcePart of sourceParts) {
        for (const candidatePart of candidateParts) {
          const exact = candidatePart.normalized === sourcePart.normalized;
          const shorterPart = sourcePart.normalized.length <= candidatePart.normalized.length
            ? sourcePart
            : candidatePart;
          const overlaps = exact || (
            isMeaningfulPartialToken(shorterPart.normalized)
            && (sourcePart.normalized.includes(candidatePart.normalized)
              || candidatePart.normalized.includes(sourcePart.normalized))
          );
          if (!overlaps) continue;
          const score = (exact ? 200 : 180) + Array.from(shorterPart.normalized).length;
          if (!best || score > best.score) {
            best = { matchedText: shorterPart.display, score };
          }
        }
      }
    }
  }

  return best;
}

export function getArtistNameRecommendations(
  source: ArtistNameRecommendationSource,
  candidates: Artist[],
  limit = 3,
): ArtistNameRecommendation[] {
  const sourceAliases = aliasesOf(source);
  if (sourceAliases.length === 0 || limit <= 0) return [];

  return candidates
    .map((candidate, index) => {
      const match = matchAliases(sourceAliases, aliasesOf(candidate));
      return match ? { artistId: candidate.id, index, ...match } : null;
    })
    .filter((item): item is ArtistNameRecommendation & { index: number } => item != null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ artistId, matchedText, score }) => ({ artistId, matchedText, score }));
}

export function promoteArtistNameRecommendations(
  artists: Artist[],
  recommendations: ArtistNameRecommendation[],
): Artist[] {
  if (recommendations.length === 0) return artists;
  const rankById = new Map(
    recommendations.map((recommendation, index) => [recommendation.artistId, index]),
  );
  return artists
    .map((artist, index) => ({ artist, index }))
    .sort((a, b) => {
      const aRank = rankById.get(a.artist.id);
      const bRank = rankById.get(b.artist.id);
      if (aRank != null && bRank != null) return aRank - bRank;
      if (aRank != null) return -1;
      if (bRank != null) return 1;
      return a.index - b.index;
    })
    .map(({ artist }) => artist);
}

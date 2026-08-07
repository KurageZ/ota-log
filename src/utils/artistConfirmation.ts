import type { ArtistConfirmationMode } from '../types/models';
import type { ArtistCandidate } from './artistMatching';

export const DEFAULT_ARTIST_CONFIRMATION_MODE: ArtistConfirmationMode = 'always';

export const ARTIST_CONFIRMATION_MODE_LABELS: Record<ArtistConfirmationMode, string> = {
  always: '每次询问',
  matches_only: '仅在可能匹配时询问',
  never: '不再询问',
};

export const ARTIST_CONFIRMATION_MODE_SUMMARIES: Record<ArtistConfirmationMode, string> = {
  always: '每次',
  matches_only: '可能匹配时',
  never: '不询问',
};

export const ARTIST_CONFIRMATION_MODE_DESCRIPTIONS: Record<ArtistConfirmationMode, string> = {
  always: '识别到未收录的出演者时，让我确认是否添加。',
  matches_only: '只确认可能是艺人库中已有艺人的出演者。',
  never: '保留自动匹配结果，不添加其他出演者。',
};

export function normalizeArtistConfirmationMode(value: unknown): ArtistConfirmationMode {
  return value === 'matches_only' || value === 'never' ? value : DEFAULT_ARTIST_CONFIRMATION_MODE;
}

export function getArtistCandidatesForConfirmation(
  candidates: ArtistCandidate[],
  mode: ArtistConfirmationMode,
): ArtistCandidate[] {
  if (mode === 'never') return [];
  const visibleCandidates = mode === 'matches_only'
    ? candidates.filter((candidate) => candidate.suggestions.length > 0)
    : candidates;
  return visibleCandidates.map((candidate) => ({ ...candidate, resolution: 'skip' }));
}

export function selectAllArtistCandidates(candidates: ArtistCandidate[]): ArtistCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, resolution: 'create' }));
}

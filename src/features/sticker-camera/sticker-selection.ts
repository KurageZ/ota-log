export type StickerSortMode = 'none' | 'oshi' | 'favorite';

export interface StickerCandidate {
  id: string;
  uri: string;
  artistId: string | null;
  isFavorite: boolean;
}

export function sortStickerCandidates(
  candidates: StickerCandidate[],
  mode: StickerSortMode,
  oshiArtistId: string | null,
): StickerCandidate[] {
  if (mode === 'none') return [...candidates];

  const isPriority = (candidate: StickerCandidate): boolean => (
    mode === 'oshi'
      ? oshiArtistId != null && candidate.artistId === oshiArtistId
      : candidate.isFavorite
  );

  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const priorityDifference = Number(isPriority(right.candidate)) - Number(isPriority(left.candidate));
      return priorityDifference || left.index - right.index;
    })
    .map(({ candidate }) => candidate);
}

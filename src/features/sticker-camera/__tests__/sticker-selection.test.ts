import { sortStickerCandidates, type StickerCandidate } from '../sticker-selection';

const candidates: StickerCandidate[] = [
  { id: 'newest', uri: 'newest.jpg', artistId: 'artist-b', isFavorite: false },
  { id: 'oshi-new', uri: 'oshi-new.jpg', artistId: 'artist-a', isFavorite: false },
  { id: 'favorite', uri: 'favorite.jpg', artistId: 'artist-b', isFavorite: true },
  { id: 'oshi-old', uri: 'oshi-old.jpg', artistId: 'artist-a', isFavorite: false },
];

describe('sticker candidate sorting', () => {
  test('keeps repository recency order without a priority', () => {
    expect(sortStickerCandidates(candidates, 'none', 'artist-a').map(({ id }) => id)).toEqual([
      'newest',
      'oshi-new',
      'favorite',
      'oshi-old',
    ]);
  });

  test('moves the direct oshi artist matches first while preserving both groups', () => {
    expect(sortStickerCandidates(candidates, 'oshi', 'artist-a').map(({ id }) => id)).toEqual([
      'oshi-new',
      'oshi-old',
      'newest',
      'favorite',
    ]);
  });

  test('moves favorite items first and leaves the source array unchanged', () => {
    expect(sortStickerCandidates(candidates, 'favorite', 'artist-a').map(({ id }) => id)).toEqual([
      'favorite',
      'newest',
      'oshi-new',
      'oshi-old',
    ]);
    expect(candidates.map(({ id }) => id)).toEqual(['newest', 'oshi-new', 'favorite', 'oshi-old']);
  });
});

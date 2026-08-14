import {
  buildSearchIndex,
  matchesSearchIndex,
  normalizeSearchText,
  tokenizeSearchQuery,
} from '../searchText';

describe('searchText', () => {
  test('normalizes width, case, whitespace, and supported date queries', () => {
    expect(normalizeSearchText('  ＡＢＣ  Live ')).toBe('abc live');
    expect(tokenizeSearchQuery('２０２６年８月１４日')).toEqual(['2026-08-14']);
  });

  test('matches all tokens across aggregate fields', () => {
    const index = buildSearchIndex(['Summer Live', 'ＯＳＡＫＡ', '蓝色队列']);
    expect(matchesSearchIndex(index, tokenizeSearchQuery('summer osaka 蓝色'))).toBe(true);
    expect(matchesSearchIndex(index, tokenizeSearchQuery('summer tokyo'))).toBe(false);
  });
});

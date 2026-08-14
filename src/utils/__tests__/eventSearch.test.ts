import {
  buildEventSearchIndex,
  matchesEventSearchIndex,
  normalizeEventSearchText,
  tokenizeEventSearchQuery,
} from '../eventSearch';

describe('eventSearch', () => {
  test('normalizes width, case, whitespace, and supported date queries', () => {
    expect(normalizeEventSearchText('  ＡＢＣ  Live ')).toBe('abc live');
    expect(tokenizeEventSearchQuery('２０２６年８月１４日')).toEqual(['2026-08-14']);
  });

  test('matches all tokens across aggregate fields', () => {
    const index = buildEventSearchIndex(['Summer Live', 'ＯＳＡＫＡ', '蓝色队列']);
    expect(matchesEventSearchIndex(index, 'summer osaka 蓝色')).toBe(true);
    expect(matchesEventSearchIndex(index, 'summer tokyo')).toBe(false);
  });
});

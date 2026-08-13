import {
  buildChekiSearchIndex,
  buildChekiItemSearchIndex,
  buildChekiRecordSearchIndex,
  matchesChekiSearchIndex,
  normalizeChekiSearchText,
  tokenizeChekiSearchQuery,
} from '../chekiSearch';

describe('chekiSearch', () => {
  test('normalizes width, case, and repeated whitespace', () => {
    expect(normalizeChekiSearchText('  ＡＢＣ   Live  ')).toBe('abc live');
  });

  test.each([
    ['2026-08-13', '2026-08-13'],
    ['2026/8/13', '2026-08-13'],
    ['2026.08.13', '2026-08-13'],
    ['2026年8月13日', '2026-08-13'],
    ['2026-8', '2026-08'],
    ['2026年8月', '2026-08'],
    ['２０２６／８／１３', '2026-08-13'],
    ['2026', '2026'],
  ])('canonicalizes supported date query %s', (query, expected) => {
    expect(tokenizeChekiSearchQuery(query)).toEqual([expected]);
  });

  test('uses AND matching across fields in the combined index', () => {
    const index = buildChekiSearchIndex(['Member Name', 'Summer Live', '签售']);
    expect(matchesChekiSearchIndex(index, tokenizeChekiSearchQuery('member 签售'))).toBe(true);
    expect(matchesChekiSearchIndex(index, tokenizeChekiSearchQuery('member 不存在'))).toBe(false);
  });

  test('item search combines parent record fields with only the current item notes', () => {
    const firstItem = buildChekiItemSearchIndex({
      date: '2026-08-13',
      recordNotes: '整场签售',
      itemNotes: '蓝色签名',
      artistText: 'Member Name Group Name',
      eventTitle: 'Summer Live',
    });
    const secondItem = buildChekiItemSearchIndex({
      date: '2026-08-13',
      recordNotes: '整场签售',
      itemNotes: '红色签名',
      artistText: 'Member Name Group Name',
      eventTitle: 'Summer Live',
    });

    expect(matchesChekiSearchIndex(firstItem, tokenizeChekiSearchQuery('summer 签售'))).toBe(true);
    expect(matchesChekiSearchIndex(secondItem, tokenizeChekiSearchQuery('summer 签售'))).toBe(true);
    expect(matchesChekiSearchIndex(firstItem, tokenizeChekiSearchQuery('蓝色'))).toBe(true);
    expect(matchesChekiSearchIndex(secondItem, tokenizeChekiSearchQuery('蓝色'))).toBe(false);
  });

  test('record search includes notes from every item in the record', () => {
    const index = buildChekiRecordSearchIndex({
      date: '2026-08-13',
      recordNotes: null,
      artistText: 'Member Name',
      eventTitle: 'Summer Live',
      itemNotes: ['蓝色签名', '红色签名'],
    });
    expect(matchesChekiSearchIndex(index, tokenizeChekiSearchQuery('member 红色'))).toBe(true);
  });

  test('does not interpret unsupported natural-language dates', () => {
    expect(tokenizeChekiSearchQuery('8月')).toEqual(['8月']);
  });
});

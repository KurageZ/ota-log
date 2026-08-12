import { buildArtistShareSegments, formatSharePercentage, prepareArtistShareColors } from '../artistShare';

describe('artistShare', () => {
  test('keeps the top three artists and groups the remainder', () => {
    expect(buildArtistShareSegments([
      { id: 'a', name: 'A', value: 40 },
      { id: 'b', name: 'B', value: 30 },
      { id: 'c', name: 'C', value: 20 },
      { id: 'd', name: 'D', value: 10 },
    ], 100)).toEqual([
      { id: 'a', name: 'A', value: 40, isOther: false },
      { id: 'b', name: 'B', value: 30, isOther: false },
      { id: 'c', name: 'C', value: 20, isOther: false },
      { id: null, name: '其他', value: 10, isOther: true },
    ]);
  });

  test('does not add an empty other segment', () => {
    expect(buildArtistShareSegments([
      { id: 'a', name: 'A', value: 2 },
      { id: 'b', name: 'B', value: 1 },
    ], 3)).toHaveLength(2);
  });

  test('keeps unlinked records in other instead of using an artist slot', () => {
    expect(buildArtistShareSegments([
      { id: null, name: '未关联艺人', value: 9 },
      { id: 'a', name: 'A', value: 8 },
      { id: 'b', name: 'B', value: 7 },
      { id: 'c', name: 'C', value: 6 },
      { id: 'd', name: 'D', value: 5 },
    ], 35)).toEqual([
      { id: 'a', name: 'A', value: 8, isOther: false },
      { id: 'b', name: 'B', value: 7, isOther: false },
      { id: 'c', name: 'C', value: 6, isOther: false },
      { id: null, name: '其他', value: 14, isOther: true },
    ]);
  });

  test('formats readable percentages without rounding small shares to zero', () => {
    expect(formatSharePercentage(1, 3)).toBe('33.3%');
    expect(formatSharePercentage(1, 2000)).toBe('<0.1%');
    expect(formatSharePercentage(0, 10)).toBe('0%');
  });

  test('tunes extracted colors for the active theme and separates similar colors', () => {
    const colors = prepareArtistShareColors(
      ['#220033', '#240035', null],
      ['#db2777', '#7c3aed', '#2563eb'],
      true,
    );

    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
    expect(colors.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
  });
});

import { chunkChekiAlbumRows } from '../cheki';
import type { ChekiSpec } from '../../domain/chekiSpec';

const photos = (...specs: ChekiSpec[]) => specs.map((spec, id) => ({ id, spec }));
const three = 'three_inch_portrait';
const five = 'five_inch_portrait';

test('leaves the final slot empty without pulling a later photo forward', () => {
  const items = photos(three, three, five, three);
  expect(chunkChekiAlbumRows(items, 3, 'portrait')).toEqual([
    items.slice(0, 2), items.slice(2),
  ]);
});

test('packs both five-inch orientations into two slots', () => {
  const items = photos(five, 'five_inch_landscape', three);
  expect(chunkChekiAlbumRows(items, 4, 'portrait')).toEqual([
    items.slice(0, 2), items.slice(2),
  ]);
});

test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])('preserves every photo and order at %i columns', (columns) => {
  const items = photos(three, five, five, three, 'five_inch_landscape', three, three);
  const rows = chunkChekiAlbumRows(items, columns, 'portrait');
  expect(rows.flat()).toEqual(items);
  for (const row of rows) {
    expect(row.reduce((sum, item) => sum + (item.spec.startsWith('five_') ? 2 : 1), 0)).toBeLessThanOrEqual(columns);
  }
});

test('original mode keeps one slot per photo and empty albums have no rows', () => {
  const items = photos(five, five, three, three);
  expect(chunkChekiAlbumRows(items, 3, 'original')).toEqual([items.slice(0, 3), items.slice(3)]);
  expect(chunkChekiAlbumRows([], 3, 'portrait')).toEqual([]);
});

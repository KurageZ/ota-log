import { chunkChekiPhysicalRows, getChekiAlbumFrame, getChekiJustifiedRowHeight } from '../cheki';
import type { ChekiSpec } from '../../domain/chekiSpec';

const photos = (...specs: ChekiSpec[]) => specs.map((spec, id) => ({ id, spec }));
const three = 'three_inch_portrait';
const five = 'five_inch_portrait';

test('fills leftover space with a later photo and defers the skipped photo', () => {
  const items = photos(three, three, five, three);
  expect(chunkChekiPhysicalRows(items, 3, 'portrait')).toEqual([
    [items[0], items[1], items[3]], [items[2]],
  ]);
});

test('packs five-inch orientations by their physical widths', () => {
  const items = photos(five, 'five_inch_landscape', three);
  expect(chunkChekiPhysicalRows(items, 4, 'portrait')).toEqual([items.slice(0, 2), items.slice(2)]);
});

test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])('preserves all photos, prioritizes earlier photos, and fits %i columns', (columns) => {
  const items = photos(three, five, five, three, 'five_inch_landscape', three, three);
  const rows = chunkChekiPhysicalRows(items, columns, 'portrait');
  expect(rows.flat().map(({ id }) => id).sort((a, b) => a - b)).toEqual(items.map(({ id }) => id));
  let pending = [...items];
  for (const row of rows) {
    expect(row[0]).toBe(pending[0]);
    expect(row.map(({ id }) => id)).toEqual(row.map(({ id }) => id).sort((a, b) => a - b));
    const occupied = row.reduce((sum, item) => sum + getChekiAlbumFrame(item.spec, 54).width, 0) + (row.length - 1) * 8;
    expect(occupied).toBeLessThanOrEqual(columns * 54 + (columns - 1) * 8);
    pending = pending.filter((item) => !row.includes(item));
    for (const item of pending) {
      expect(occupied + 8 + getChekiAlbumFrame(item.spec, 54).width).toBeGreaterThan(columns * 54 + (columns - 1) * 8);
    }
  }
});

test('original mode keeps one slot per photo and empty albums have no rows', () => {
  const items = photos(five, five, three, three);
  expect(chunkChekiPhysicalRows(items, 3, 'original')).toEqual([items.slice(0, 3), items.slice(3)]);
  expect(chunkChekiPhysicalRows([], 3, 'portrait')).toEqual([]);
});

test('uses one scale for all physical frames', () => {
  expect(getChekiAlbumFrame(three, 108)).toEqual({ width: 108, height: 172 });
  expect(getChekiAlbumFrame('three_inch_landscape', 108)).toEqual({ width: 172, height: 108 });
  expect(getChekiAlbumFrame(five, 108)).toEqual({ width: 172, height: 216 });
  expect(getChekiAlbumFrame('five_inch_landscape', 108)).toEqual({ width: 216, height: 172 });
  expect(getChekiAlbumFrame('square', 108)).toEqual({ width: 108, height: 108 });
});

test('packs mixed frames using pixel widths and real gaps', () => {
  const items = photos('three_inch_landscape', five, three);
  expect(chunkChekiPhysicalRows(items, 4, 'portrait', 80, 8)).toEqual([items.slice(0, 2), items.slice(2)]);
  expect(chunkChekiPhysicalRows(items, 5, 'portrait', 80, 8)).toEqual([items]);
});

test('deferred photos retain their order while the earliest fitting photo fills the gap', () => {
  const items = photos(three, three, five, 'five_inch_landscape', three, three);
  expect(chunkChekiPhysicalRows(items, 3, 'portrait')).toEqual([
    [items[0], items[1], items[4]], [items[2], items[5]], [items[3]],
  ]);
});

test.each([2, 3, 4, 5, 8, 10])('justified rows preserve order, aspect ratios, and fill the width at %i columns', (columns) => {
  const items = photos(three, 'three_inch_landscape', five, 'five_inch_landscape', 'square', three, five, three);
  const rows = chunkChekiPhysicalRows(items, columns, 'portrait', 80, 8, true);
  expect(rows.flat()).toEqual(items);
  rows.forEach((row, index) => {
    const last = index === rows.length - 1;
    const height = getChekiJustifiedRowHeight(row, columns, 80, 8, last);
    const frames = row.map((item) => getChekiAlbumFrame(item.spec, 80, height));
    const occupied = frames.reduce((sum, frame) => sum + frame.width, 0) + (row.length - 1) * 8;
    if (last) {
      expect(occupied).toBeLessThanOrEqual(columns * 80 + (columns - 1) * 8 + 0.000001);
      expect(height).toBeLessThanOrEqual(80 * 86 / 54);
    } else {
      expect(occupied).toBeCloseTo(columns * 80 + (columns - 1) * 8);
    }
    frames.forEach((frame, i) => {
      const original = getChekiAlbumFrame(row[i].spec, 80);
      expect(frame.height).toBe(height);
      expect(frame.width / frame.height).toBeCloseTo(original.width / original.height);
    });
  });
});

test('an incomplete final row stays at target height and square mode is unchanged', () => {
  const items = photos(three);
  expect(getChekiJustifiedRowHeight(items, 3, 54, 8, true)).toBe(86);
  expect(chunkChekiPhysicalRows(items, 3, 'original', 54, 8, true)).toEqual([items]);
});

test('strict physical sorting leaves gaps without moving later photos forward', () => {
  const items = photos(three, three, five, three);
  expect(chunkChekiPhysicalRows(items, 3, 'portrait', 54, 8, false, false)).toEqual([items.slice(0, 2), items.slice(2)]);
  expect(chunkChekiPhysicalRows(items, 3, 'portrait', 54, 8, false, true)).toEqual([[items[0], items[1], items[3]], [items[2]]]);
});

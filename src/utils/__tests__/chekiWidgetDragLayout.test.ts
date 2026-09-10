import { buildChekiDragFrames, findChekiDragTarget, moveChekiWidgetItem } from '../chekiWidgetDragLayout';

const items = [
  { id: 'a', spec: 'three_inch_portrait' as const },
  { id: 'b', spec: 'five_inch_portrait' as const },
  { id: 'c', spec: 'five_inch_landscape' as const },
  { id: 'd', spec: 'three_inch_portrait' as const },
];

test('mixed widths leave a slot empty and keep photo order', () => {
  const frames = buildChekiDragFrames(items, 4, 80, 128, 8);
  expect(frames.map(({ id, x, y, width }) => ({ id, x, y, width }))).toEqual([
    { id: 'a', x: 0, y: 0, width: 80 },
    { id: 'b', x: 88, y: 0, width: 168 },
    { id: 'c', x: 0, y: 136, width: 168 },
    { id: 'd', x: 176, y: 136, width: 80 },
  ]);
  expect(findChekiDragTarget(frames, 250, 64)).toBe(1);
  expect(findChekiDragTarget(frames, 330, 64)).toBe(1);
  expect(findChekiDragTarget(frames, 160, 190)).toBe(2);
  expect(findChekiDragTarget(frames, 220, 190)).toBe(3);
});

test('inserts in either direction and preserves unavailable ids', () => {
  expect(moveChekiWidgetItem(['a', 'missing', 'b', 'c'], 'a', 'c')).toEqual(['missing', 'b', 'c', 'a']);
  expect(moveChekiWidgetItem(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  expect(moveChekiWidgetItem(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
});

test.each([2, 3, 4, 5, 8, 10])('frames fit %i columns after reordering', (columns) => {
  const frames = buildChekiDragFrames([items[2], items[0], items[1], items[3]], columns, 80, 128, 8);
  for (const frame of frames) expect(frame.x + frame.width).toBeLessThanOrEqual(columns * 88 - 8);
  expect(frames.map(({ id }) => id)).toEqual(['c', 'a', 'b', 'd']);
});

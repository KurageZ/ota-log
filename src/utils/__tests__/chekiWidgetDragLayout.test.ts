import { getChekiDragPreviewIndex, buildChekiDragFrames, findChekiDragTarget, moveChekiWidgetItem } from '../chekiWidgetDragLayout';

const items = [
  { id: 'a', spec: 'three_inch_portrait' as const },
  { id: 'b', spec: 'five_inch_portrait' as const },
  { id: 'c', spec: 'five_inch_landscape' as const },
  { id: 'd', spec: 'three_inch_portrait' as const },
];

test('all photo specs occupy one square cell and wrap in order', () => {
  const frames = buildChekiDragFrames(items, 3, 80, 80, 4);
  expect(frames).toEqual([
    { id: 'a', x: 0, y: 0, width: 80, height: 80 },
    { id: 'b', x: 84, y: 0, width: 80, height: 80 },
    { id: 'c', x: 168, y: 0, width: 80, height: 80 },
    { id: 'd', x: 0, y: 84, width: 80, height: 80 },
  ]);
  expect(findChekiDragTarget(frames, 120, 40)).toBe(1);
  expect(findChekiDragTarget(frames, 200, 40)).toBe(2);
  expect(findChekiDragTarget(frames, 40, 120)).toBe(3);
  expect(findChekiDragTarget(frames, 40, 83)).toBe(3);
});

test('inserts in either direction and preserves unavailable ids', () => {
  expect(moveChekiWidgetItem(['a', 'missing', 'b', 'c'], 'a', 'c')).toEqual(['missing', 'b', 'c', 'a']);
  expect(moveChekiWidgetItem(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  expect(moveChekiWidgetItem(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
});

test.each([2, 3, 4, 5, 8, 10])('frames fit %i columns after reordering', (columns) => {
  const frames = buildChekiDragFrames([items[2], items[0], items[1], items[3]], columns, 80, 80, 4);
  for (const frame of frames) expect(frame.x + frame.width).toBeLessThanOrEqual(columns * 84 - 4);
  expect(frames.map(({ id }) => id)).toEqual(['c', 'a', 'b', 'd']);
});

test('previews insertion forward, backward, and back at the starting cell', () => {
  const indices = [0, 1, 2, 3];
  expect(indices.map((index) => getChekiDragPreviewIndex(index, 0, 2))).toEqual([2, 0, 1, 3]);
  expect(indices.map((index) => getChekiDragPreviewIndex(index, 3, 1))).toEqual([0, 2, 3, 1]);
  expect(indices.map((index) => getChekiDragPreviewIndex(index, 1, 1))).toEqual(indices);
  expect(indices.map((index) => getChekiDragPreviewIndex(index, -1, -1))).toEqual(indices);
});

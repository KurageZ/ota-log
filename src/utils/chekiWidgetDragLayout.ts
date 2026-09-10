import type { ChekiSpec } from '../domain/chekiSpec';
import { chunkChekiAlbumRows, getChekiAlbumColumnSpan } from './cheki';

export interface ChekiDragFrame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function buildChekiDragFrames(
  items: { id: string; spec: ChekiSpec }[],
  columns: number,
  width: number,
  height: number,
  gap: number,
): ChekiDragFrame[] {
  return chunkChekiAlbumRows(items, columns, 'portrait').flatMap((row, rowIndex) => {
    let x = 0;
    return row.map((item) => {
      const itemWidth = getChekiAlbumColumnSpan(item.spec, 'portrait') === 2 ? width * 2 + gap : width;
      const frame = { id: item.id, x, y: rowIndex * (height + gap), width: itemWidth, height };
      x += itemWidth + gap;
      return frame;
    });
  });
}

/** Distance to the actual rectangle, including the second slot of a five-inch photo. */
export function findChekiDragTarget(frames: ChekiDragFrame[], x: number, y: number): number {
  'worklet';
  let target = -1;
  let distance = Infinity;
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    const dx = Math.max(frame.x - x, 0, x - frame.x - frame.width);
    const dy = Math.max(frame.y - y, 0, y - frame.y - frame.height);
    const nextDistance = dx * dx + dy * dy;
    if (nextDistance < distance) {
      distance = nextDistance;
      target = index;
    }
  }
  return target;
}

export function moveChekiWidgetItem(itemIds: string[], id: string, targetId: string): string[] {
  const next = [...itemIds];
  const from = next.indexOf(id);
  const to = next.indexOf(targetId);
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

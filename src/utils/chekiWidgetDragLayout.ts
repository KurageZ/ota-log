import type { ChekiSpec } from '../domain/chekiSpec';

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
  return items.map((item, index) => ({
    id: item.id,
    x: (index % columns) * (width + gap),
    y: Math.floor(index / columns) * (height + gap),
    width,
    height,
  }));
}

/** Distance to each grid cell, including gaps between cells. */
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

/** Preview insertion while keeping the dragged photo attached to the finger. */
export function getChekiDragPreviewIndex(index: number, from: number, to: number): number {
  'worklet';
  if (from < 0 || to < 0) return index;
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (from > to && index >= to && index < from) return index + 1;
  return index;
}

export function moveChekiWidgetItem(itemIds: string[], id: string, targetId: string): string[] {
  const next = [...itemIds];
  const from = next.indexOf(id);
  const to = next.indexOf(targetId);
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

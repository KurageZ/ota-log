export interface ChekiWidgetGridPosition {
  index: number;
}

/** Convert the DnD grid's final positions into the persisted item order. */
export function orderChekiWidgetItemIds(
  itemIds: string[],
  positions: Record<string, ChekiWidgetGridPosition>,
): string[] {
  return [...itemIds].sort((left, right) => (
    (positions[left]?.index ?? itemIds.length + itemIds.indexOf(left))
      - (positions[right]?.index ?? itemIds.length + itemIds.indexOf(right))
  ));
}

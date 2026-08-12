export const STATS_SECTION_SORTABLE_ITEM_HEIGHT = 70;
// react-native-reanimated-dnd 2.0.0 calculates vertical auto-scroll against a
// 500px default viewport. A shorter container can produce a negative scroll
// target while dragging toward the disabled section and clip the active row.
export const STATS_SECTION_SORTABLE_MIN_HEIGHT = 500;

export function getStatsSortableHeight(itemCount: number): number {
  return Math.max(
    STATS_SECTION_SORTABLE_MIN_HEIGHT,
    itemCount * STATS_SECTION_SORTABLE_ITEM_HEIGHT,
  );
}

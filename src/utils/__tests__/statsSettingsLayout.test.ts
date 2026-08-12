import {
  STATS_SECTION_SORTABLE_ITEM_HEIGHT,
  getStatsSortableHeight,
} from '../statsSettingsLayout';

describe('getStatsSortableHeight', () => {
  it('keeps the stats sortable at least as tall as the drag library viewport', () => {
    const statsSectionCountWithDivider = 6;

    expect(getStatsSortableHeight(statsSectionCountWithDivider)).toBe(500);
  });

  it('allows content taller than the minimum drag viewport', () => {
    const tallItemCount = 8;

    expect(getStatsSortableHeight(tallItemCount)).toBe(
      tallItemCount * STATS_SECTION_SORTABLE_ITEM_HEIGHT,
    );
  });
});

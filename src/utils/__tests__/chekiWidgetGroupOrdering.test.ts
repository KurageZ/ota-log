import { orderChekiWidgetItemIds } from '../chekiWidgetGroupOrdering';

describe('orderChekiWidgetItemIds', () => {
  test('maps final grid positions to ordered IDs', () => {
    expect(orderChekiWidgetItemIds(['a', 'b', 'c'], {
      a: { index: 2 }, b: { index: 0 }, c: { index: 1 },
    })).toEqual(['b', 'c', 'a']);
  });

  test('keeps items without a reported position in their current relative order', () => {
    expect(orderChekiWidgetItemIds(['a', 'b', 'c'], { c: { index: 0 } })).toEqual(['c', 'a', 'b']);
  });
});

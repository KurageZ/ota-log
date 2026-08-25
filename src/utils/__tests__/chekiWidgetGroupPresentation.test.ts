import {
  countChekiWidgetFilterCategories,
  createEmptyChekiWidgetFilterRules,
  describeChekiWidgetFilterRules,
} from '../chekiWidgetGroupPresentation';

describe('chekiWidgetGroupPresentation', () => {
  test('describes active filter categories with user-facing names', () => {
    const rules = createEmptyChekiWidgetFilterRules();
    rules.artistIds = ['artist-1', 'artist-2'];
    rules.favoriteOnly = true;
    rules.date = { preset: 'current_month' };
    rules.specs = ['square'];

    expect(countChekiWidgetFilterCategories(rules)).toBe(4);
    expect(describeChekiWidgetFilterRules(
      rules,
      new Map([['artist-1', 'Alice'], ['artist-2', 'Bob']]),
      new Map(),
    )).toBe('本月 · 已收藏 · Alice等 2 个艺人 · 方形');
  });

  test('describes an empty filter as unconfigured', () => {
    expect(describeChekiWidgetFilterRules(
      createEmptyChekiWidgetFilterRules(),
      new Map(),
      new Map(),
    )).toBe('尚未设置筛选条件');
  });
});

import { createStatsRangeSessionStore } from '../statsRangeSession';
import type { StatsDateRange } from '../statsDateRange';

describe('statsRangeSession', () => {
  const customRange: StatsDateRange = {
    preset: 'custom',
    startDate: '2026-07-20',
    endDate: '2026-08-12',
  };

  test('remembers a route-provided custom range without replacing the applied preset', () => {
    const store = createStatsRangeSessionStore();
    const monthRange: StatsDateRange = {
      preset: 'month',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    };

    store.rememberApplied(monthRange);
    store.rememberCustom(customRange);

    expect(store.getCurrent()).toEqual(monthRange);
    expect(store.getCustom()).toEqual(customRange);
  });

  test('remembers an applied custom range as both current and recent custom', () => {
    const store = createStatsRangeSessionStore();
    store.rememberApplied(customRange);
    expect(store.getCurrent()).toEqual(customRange);
    expect(store.getCustom()).toEqual(customRange);
  });
});

import { createHomeMonthStatsRoute } from '../homeNavigation';

describe('homeNavigation', () => {
  test('opens the pinned current-month summary in the natural month stats view', () => {
    expect(createHomeMonthStatsRoute()).toEqual({
      pathname: '/stats',
      params: { preset: 'month' },
    });
  });
});

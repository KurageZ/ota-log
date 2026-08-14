import { formatDateFilter } from '../dateFilters';

describe('dateFilters', () => {
  test('formats each date filter mode for compact summaries', () => {
    expect(formatDateFilter({ mode: 'day', startDate: '2026-08-14', endDate: '2026-08-14' })).toBe('2026-08-14');
    expect(formatDateFilter({ mode: 'month', startDate: '2026-08-01', endDate: '2026-08-31' })).toBe('2026.08');
    expect(formatDateFilter({ mode: 'year', startDate: '2026-01-01', endDate: '2026-12-31' })).toBe('2026');
    expect(formatDateFilter({ mode: 'custom', startDate: '2026-08-01', endDate: '2026-08-14' })).toBe('2026-08-01 – 2026-08-14');
    expect(formatDateFilter(null)).toBeNull();
  });
});

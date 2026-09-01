import {
  buildStatsTrendBuckets,
  createCustomStatsRange,
  createPresetStatsRange,
  createStatsRangeForDate,
  formatStatsDateRange,
  formatStatsPeriodLabel,
  getTrendLabelIndices,
  getTrendValueLabelIndices,
  getStatsRangeDaysForMonth,
  parseStatsRangeParams,
  shiftStatsDateRange,
} from '../statsDateRange';

describe('statsDateRange', () => {
  test('creates complete natural month and year ranges including future dates', () => {
    const now = new Date(2026, 7, 12, 12);
    expect(createPresetStatsRange('month', now)).toEqual({
      preset: 'month',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    expect(createPresetStatsRange('year', now)).toEqual({
      preset: 'year',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
  });

  test('validates and formats inclusive custom ranges', () => {
    expect(createCustomStatsRange('2026-12-31', '2027-01-02')).toEqual({
      preset: 'custom',
      startDate: '2026-12-31',
      endDate: '2027-01-02',
    });
    expect(createCustomStatsRange('2027-01-02', '2026-12-31')).toBeNull();
    expect(formatStatsDateRange(createPresetStatsRange('all'))).toBe('全部时间');
    expect(formatStatsDateRange(createCustomStatsRange('2026-12-31', '2027-01-02')!))
      .toBe('2026/12/31 – 2027/01/02');
  });

  test('builds calendar marks only for the visible month of an unbounded custom span', () => {
    const marks = getStatsRangeDaysForMonth('1900-01-01', '2200-12-31', '2026-08');
    expect(marks).toHaveLength(31);
    expect(marks[0]).toEqual({ date: '2026-08-01', isRangeStart: false, isRangeEnd: false });
    expect(marks.at(-1)).toEqual({ date: '2026-08-31', isRangeStart: false, isRangeEnd: false });
  });

  test('supports explicit range routes and legacy year-month routes', () => {
    expect(parseStatsRangeParams({ startDate: '2026-02-28', endDate: '2026-03-01' })).toEqual({
      preset: 'custom',
      startDate: '2026-02-28',
      endDate: '2026-03-01',
    });
    expect(parseStatsRangeParams({ year: '2024', month: '2' })).toEqual({
      preset: 'custom',
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
  });

  test('uses daily, monthly, and yearly trend buckets based on span', () => {
    expect(buildStatsTrendBuckets(createCustomStatsRange('2026-08-01', '2026-08-03')!))
      .toHaveLength(3);
    expect(buildStatsTrendBuckets(createCustomStatsRange('2026-01-15', '2026-03-02')!))
      .toEqual([
        expect.objectContaining({ key: '2026-01', startDate: '2026-01-15' }),
        expect.objectContaining({ key: '2026-02' }),
        expect.objectContaining({ key: '2026-03', endDate: '2026-03-02' }),
      ]);
    expect(buildStatsTrendBuckets(createCustomStatsRange('2024-01-01', '2026-12-31')!))
      .toHaveLength(3);
  });

  test('keeps dense daily charts to five evenly spaced axis labels', () => {
    expect([...getTrendLabelIndices(31)]).toEqual([0, 8, 15, 23, 30]);
    expect([...getTrendLabelIndices(7)]).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test('shows every month on a yearly chart', () => {
    expect([...getTrendLabelIndices(12, undefined, { showAll: true })])
      .toEqual(Array.from({ length: 12 }, (_, index) => index));
  });

  test('prioritizes dates with data while skipping adjacent labels', () => {
    const counts = Array.from({ length: 31 }, (_, index) => (
      [4, 5, 6, 10, 11].includes(index) ? 1 : 0
    ));

    expect([...getTrendLabelIndices(31, counts, { prioritizeData: true })]).toEqual([4, 6, 10]);
  });

  test('only hides nearby duplicate bar values', () => {
    expect([...getTrendValueLabelIndices([2, 2, 3, 4, 4])]).toEqual([0, 2, 3]);
    expect([...getTrendValueLabelIndices([2, 3])]).toEqual([0, 1]);
    expect([...getTrendValueLabelIndices([2, 2, 2, 2])]).toEqual([0, 2]);
    expect([...getTrendValueLabelIndices([2, 2, 2], 1)]).toEqual([0, 1, 2]);
  });

  test('can suppress nearby different values when labels would collide', () => {
    expect([...getTrendValueLabelIndices([100, 200, 300, 400], 3, { suppressCollisions: true })]).toEqual([0, 3]);
    expect([...getTrendValueLabelIndices([100, 200, 300], 1, { suppressCollisions: true })]).toEqual([0, 1, 2]);
  });

  test('creates and shifts natural week, month, and year ranges', () => {
    const january = createStatsRangeForDate('month', new Date(2026, 0, 15));
    expect(shiftStatsDateRange(january, -1)).toEqual({
      preset: 'month',
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    });

    const year = createStatsRangeForDate('year', new Date(2026, 7, 12));
    expect(shiftStatsDateRange(year, 1)).toEqual({
      preset: 'year',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
    });

    const week = createStatsRangeForDate('week', new Date(2026, 7, 12));
    const followingWeek = shiftStatsDateRange(week, 1);
    expect(followingWeek).toEqual(createStatsRangeForDate('week', new Date(2026, 7, 19)));
  });

  test('formats preset periods for the compact navigator', () => {
    expect(formatStatsPeriodLabel(createStatsRangeForDate('month', new Date(2026, 7, 12))))
      .toBe('2026 年 8 月');
    expect(formatStatsPeriodLabel(createStatsRangeForDate('year', new Date(2026, 7, 12))))
      .toBe('2026 年');
    const week = createStatsRangeForDate('week', new Date(2026, 7, 12));
    expect(formatStatsPeriodLabel(week)).toBe(formatStatsDateRange(week));
    expect(formatStatsPeriodLabel(createPresetStatsRange('all'))).toBe('全部时间');
  });
});

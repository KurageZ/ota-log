import { buildActivityHeatmapValues } from '../activityHeatmap';

describe('buildActivityHeatmapValues', () => {
  it('maps activity and cheki counts to the three combined levels', () => {
    expect(buildActivityHeatmapValues(
      [
        { date: '2026-01-01', count: 1 },
        { date: '2026-01-02', count: 2 },
        { date: '2026-01-03', count: 1 },
      ],
      [
        { date: '2026-01-02', count: 5 },
        { date: '2026-01-03', count: 6 },
      ],
    )).toEqual([
      { date: '2026-01-01', count: 1, eventCount: 1, chekiCount: 0 },
      { date: '2026-01-02', count: 2, eventCount: 2, chekiCount: 5 },
      { date: '2026-01-03', count: 3, eventCount: 1, chekiCount: 6 },
    ]);
  });

  it('does not render cheki-only dates or empty event rows', () => {
    expect(buildActivityHeatmapValues(
      [{ date: '2026-02-01', count: 0 }],
      [{ date: '2026-02-02', count: 8 }],
    )).toEqual([]);
  });
});

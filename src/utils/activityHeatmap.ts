export type DailyCount = {
  date: string;
  count: number;
};

export type ActivityHeatmapValue = {
  date: string;
  count: 1 | 2 | 3;
  eventCount: number;
  chekiCount: number;
};

export function buildActivityHeatmapValues(
  eventCounts: readonly DailyCount[],
  chekiCounts: readonly DailyCount[],
): ActivityHeatmapValue[] {
  const chekiCountByDate = new Map(chekiCounts.map((item) => [item.date, item.count]));

  return eventCounts
    .filter((item) => item.count > 0)
    .map((item) => {
      const chekiCount = Math.max(0, chekiCountByDate.get(item.date) ?? 0);
      return {
        date: item.date,
        count: chekiCount === 0 ? 1 : chekiCount > 5 ? 3 : 2,
        eventCount: item.count,
        chekiCount,
      };
    });
}

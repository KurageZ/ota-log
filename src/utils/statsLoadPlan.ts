import type { StatsSectionConfig } from './statsPreferences';

export type StatsLoadPlan = {
  needsActivity: boolean;
  needsActivityHeatmap: boolean;
  needsOshi: boolean;
  needsSpending: boolean;
  needsPerfectEvents: boolean;
  needsCheki: boolean;
  needsStatusCounts: boolean;
  needsChekiCount: boolean;
};

export function createStatsLoadPlan(sections: readonly StatsSectionConfig[]): StatsLoadPlan {
  const visibleTypes = new Set(
    sections.filter((section) => section.visible).map((section) => section.type),
  );
  const needsActivity = visibleTypes.has('activity');
  const needsActivityHeatmap = visibleTypes.has('activityHeatmap');
  const needsOshi = visibleTypes.has('oshi');
  const needsCheki = visibleTypes.has('cheki');

  return {
    needsActivity,
    needsActivityHeatmap,
    needsOshi,
    needsSpending: visibleTypes.has('spending'),
    needsPerfectEvents: visibleTypes.has('perfectEvents'),
    needsCheki,
    needsStatusCounts: needsActivity || needsOshi,
    needsChekiCount: needsCheki || needsOshi,
  };
}

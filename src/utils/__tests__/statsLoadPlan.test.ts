import { createStatsLoadPlan } from '../statsLoadPlan';

describe('createStatsLoadPlan', () => {
  it('skips every statistics dependency when all sections are hidden', () => {
    expect(createStatsLoadPlan([
      { type: 'activity', visible: false },
      { type: 'activityHeatmap', visible: false },
      { type: 'oshi', visible: false },
      { type: 'spending', visible: false },
      { type: 'perfectEvents', visible: false },
      { type: 'cheki', visible: false },
    ])).toEqual({
      needsActivity: false,
      needsActivityHeatmap: false,
      needsOshi: false,
      needsSpending: false,
      needsPerfectEvents: false,
      needsCheki: false,
      needsStatusCounts: false,
      needsChekiCount: false,
    });
  });

  it('loads shared event and cheki totals for the oshi section', () => {
    const plan = createStatsLoadPlan([{ type: 'oshi', visible: true }]);

    expect(plan.needsOshi).toBe(true);
    expect(plan.needsStatusCounts).toBe(true);
    expect(plan.needsChekiCount).toBe(true);
    expect(plan.needsActivity).toBe(false);
    expect(plan.needsCheki).toBe(false);
  });

  it('keeps spending independent from the cheki display section', () => {
    const plan = createStatsLoadPlan([
      { type: 'spending', visible: true },
      { type: 'cheki', visible: false },
    ]);

    expect(plan.needsSpending).toBe(true);
    expect(plan.needsCheki).toBe(false);
    expect(plan.needsChekiCount).toBe(false);
  });

  it('loads only the daily event aggregation for the activity heatmap', () => {
    expect(createStatsLoadPlan([{ type: 'activityHeatmap', visible: true }])).toEqual({
      needsActivity: false,
      needsActivityHeatmap: true,
      needsOshi: false,
      needsSpending: false,
      needsPerfectEvents: false,
      needsCheki: false,
      needsStatusCounts: false,
      needsChekiCount: false,
    });
  });

  it('loads only section-specific dependencies for activity and perfect events', () => {
    const plan = createStatsLoadPlan([
      { type: 'activity', visible: true },
      { type: 'perfectEvents', visible: true },
    ]);

    expect(plan).toEqual({
      needsActivity: true,
      needsActivityHeatmap: false,
      needsOshi: false,
      needsSpending: false,
      needsPerfectEvents: true,
      needsCheki: false,
      needsStatusCounts: true,
      needsChekiCount: false,
    });
  });
});

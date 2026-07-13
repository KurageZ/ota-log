import {
  ULTIMA_STAMP_CATALOG_VERSION,
  ULTIMA_TIMETREE_EVENTS,
  applyUltimaAutoPlan,
  calculateUltimaGroupStats,
  clampUltimaEventSpend,
  clampUltimaGroupSpend,
  createDefaultUltimaPlannerState,
  getUltimaEntryParticipation,
  getUltimaEntryTask,
  getUltimaEventPlan,
  isUltimaEventExpired,
  makeEntryKey,
  resetUltimaPlannedEvents,
  sanitizeUltimaPlannerState,
  updateUltimaEventTask,
} from '../ultimaStampPlanner';

describe('ultimaStampPlanner', () => {
  it('splits multi-day TimeTree activities into one planner event per day', () => {
    expect(ULTIMA_TIMETREE_EVENTS).toHaveLength(36);
    expect(ULTIMA_TIMETREE_EVENTS
      .filter((event) => event.id.startsWith('2997573376996864476:'))
      .map((event) => event.date)).toEqual(['2026-08-07', '2026-08-08', '2026-08-09']);
    expect(ULTIMA_TIMETREE_EVENTS
      .filter((event) => event.id.startsWith('2997574135905841636:'))
      .map((event) => event.date)).toEqual(['2026-08-22', '2026-08-23']);
  });

  it('drops stored plans for the moved Aug 1 panda birthday activity only', () => {
    const movedOldEventId = '2987058998119821742';
    const movedNewEventId = '2997564053151347226';
    const unchangedEvent = ULTIMA_TIMETREE_EVENTS[0];
    const unchangedGroupKey = unchangedEvent.groupKeys[0];
    const state = sanitizeUltimaPlannerState({
      schemaVersion: 1,
      groups: {
        vortex: { target: 50, baseCollected: 0 },
        lapis: { target: 50, baseCollected: 0 },
        annyx: { target: 50, baseCollected: 0 },
        misology: { target: 50, baseCollected: 0 },
      },
      eventPlans: {
        [movedOldEventId]: { planned: true, attended: false, task: 3 },
        [unchangedEvent.id]: { planned: true, attended: false, task: 2 },
      },
      entries: {
        [makeEntryKey(movedOldEventId, 'annyx')]: { collected: 0, spend: 1, extraCost: 20 },
        [makeEntryKey(movedOldEventId, 'misology')]: { collected: 0, spend: 1, extraCost: 20 },
        [makeEntryKey(unchangedEvent.id, unchangedGroupKey)]: { collected: 0, spend: 1, extraCost: 10 },
      },
      autoPlanner: {},
    });

    expect(state.eventPlans[movedOldEventId]).toBeUndefined();
    expect(state.entries[makeEntryKey(movedOldEventId, 'annyx')]).toBeUndefined();
    expect(state.entries[makeEntryKey(movedOldEventId, 'misology')]).toBeUndefined();
    expect(getUltimaEventPlan(state, movedNewEventId)).toEqual({ planned: false, attended: false, task: 0 });
    expect(getUltimaEventPlan(state, unchangedEvent.id)).toEqual({ planned: true, attended: false, task: 2 });
    expect(state.entries[makeEntryKey(unchangedEvent.id, unchangedGroupKey)]).toEqual({
      collected: 0,
      spend: 1,
      extraCost: 10,
    });
    expect(state.catalogVersion).toBe(ULTIMA_STAMP_CATALOG_VERSION);
  });

  it('keeps newly planned Aug 1 activity after the catalog migration has run', () => {
    const reusedEventId = '2987058998119821742';
    const state = sanitizeUltimaPlannerState({
      schemaVersion: 1,
      catalogVersion: ULTIMA_STAMP_CATALOG_VERSION,
      groups: {
        vortex: { target: 50, baseCollected: 0 },
        lapis: { target: 50, baseCollected: 0 },
        annyx: { target: 50, baseCollected: 0 },
        misology: { target: 50, baseCollected: 0 },
      },
      eventPlans: {
        [reusedEventId]: { planned: true, attended: false, task: 2 },
      },
      entries: {
        [makeEntryKey(reusedEventId, 'annyx')]: { collected: 0, spend: 1, extraCost: 20 },
        [makeEntryKey(reusedEventId, 'misology')]: { collected: 0, spend: 1, extraCost: 20 },
      },
      autoPlanner: {},
    });

    expect(getUltimaEventPlan(state, reusedEventId)).toEqual({ planned: true, attended: false, task: 2 });
    expect(state.entries[makeEntryKey(reusedEventId, 'annyx')]).toEqual({
      collected: 0,
      spend: 1,
      extraCost: 20,
    });
    expect(state.entries[makeEntryKey(reusedEventId, 'misology')]).toEqual({
      collected: 0,
      spend: 1,
      extraCost: 20,
    });
  });

  it('shares event task actions across groups and caps each event at 3pt', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.length === 4)!;
    state.groups.vortex.target = 4;
    state.groups.lapis.target = 4;
    state.groups.annyx.target = 4;
    state.groups.misology.target = 4;
    state.eventPlans[event.id] = { planned: true, attended: false, task: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-19' });

    expect(result.taskTotal).toBe(3);
    expect(getUltimaEventPlan(planned, event.id).task).toBe(3);
    expect(calculateUltimaGroupStats(planned, 'vortex').task).toBe(3);
    expect(calculateUltimaGroupStats(planned, 'lapis').task).toBe(3);
    expect(calculateUltimaGroupStats(planned, 'annyx').task).toBe(3);
    expect(calculateUltimaGroupStats(planned, 'misology').task).toBe(3);
  });

  it('only plans inside user-selected events', () => {
    const state = createDefaultUltimaPlannerState();
    const selectedEvent = ULTIMA_TIMETREE_EVENTS[0];
    state.groups.vortex.target = 5;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.eventPlans[selectedEvent.id] = { planned: true, attended: false, task: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-19' });
    const plannedEventIds = ULTIMA_TIMETREE_EVENTS
      .filter((event) => getUltimaEventPlan(planned, event.id).planned)
      .map((event) => event.id);

    expect(result.addedEventCount).toBe(0);
    expect(plannedEventIds).toEqual([selectedEvent.id]);
  });

  it('uses spend only when task actions are disabled', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    state.groups.vortex.target = 5;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.autoPlanner.maxTask = '0';
    state.eventPlans[event.id] = { planned: true, attended: false, task: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-19' });

    expect(result.taskTotal).toBe(0);
    expect(getUltimaEventPlan(planned, event.id).task).toBe(0);
    expect(planned.entries[makeEntryKey(event.id, 'vortex')].spend).toBeGreaterThan(0);
  });

  it('adds the fewest date-ordered unplanned events needed to complete the plan', () => {
    const state = createDefaultUltimaPlannerState();
    const selectedEvent = ULTIMA_TIMETREE_EVENTS[0];
    const addedEvent = ULTIMA_TIMETREE_EVENTS[1];
    state.groups.vortex.target = 6;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.eventPlans[selectedEvent.id] = { planned: true, attended: false, task: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-19' });

    expect(result.status).toBe('planned');
    expect(result.addedEventCount).toBe(1);
    expect(getUltimaEventPlan(planned, selectedEvent.id)).toEqual({ planned: true, attended: false, task: 3 });
    expect(planned.entries[makeEntryKey(selectedEvent.id, 'vortex')].spend).toBe(1);
    expect(getUltimaEventPlan(planned, addedEvent.id).planned).toBe(true);
    expect(getUltimaEventPlan(planned, ULTIMA_TIMETREE_EVENTS[2].id).planned).toBe(false);
  });

  it('plans selected events without adding unplanned events when additions are disabled', () => {
    const state = createDefaultUltimaPlannerState();
    const selectedEvent = ULTIMA_TIMETREE_EVENTS[0];
    state.groups.vortex.target = 6;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.eventPlans[selectedEvent.id] = { planned: true, attended: false, task: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, { includeUnplannedEvents: false });

    expect(result.status).toBe('limited');
    expect(result.addedEventCount).toBe(0);
    expect(getUltimaEventPlan(planned, selectedEvent.id)).toEqual({ planned: true, attended: false, task: 3 });
    expect(planned.entries[makeEntryKey(selectedEvent.id, 'vortex')].spend).toBe(1);
    expect(getUltimaEventPlan(planned, ULTIMA_TIMETREE_EVENTS[1].id).planned).toBe(false);
  });

  it('adds events without replanning existing planned events when replanning is disabled', () => {
    const state = createDefaultUltimaPlannerState();
    const selectedEvent = ULTIMA_TIMETREE_EVENTS[0];
    const addedEvent = ULTIMA_TIMETREE_EVENTS[1];
    state.groups.vortex.target = 7;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.eventPlans[selectedEvent.id] = { planned: true, attended: false, task: 1 };
    state.entries[makeEntryKey(selectedEvent.id, 'vortex')] = { collected: 0, spend: 1, extraCost: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, {
      includeUnplannedEvents: true,
      replanSelectedEvents: false,
      today: '2026-06-19',
    });

    expect(result.status).toBe('planned');
    expect(result.addedEventCount).toBe(1);
    expect(getUltimaEventPlan(planned, selectedEvent.id)).toEqual({ planned: true, attended: false, task: 1 });
    expect(planned.entries[makeEntryKey(selectedEvent.id, 'vortex')].spend).toBe(1);
    expect(getUltimaEventPlan(planned, addedEvent.id).planned).toBe(true);
  });

  it('skips date-ordered unplanned events that do not reduce the current gap', () => {
    const state = createDefaultUltimaPlannerState();
    const selectedEvent = ULTIMA_TIMETREE_EVENTS[0];
    const irrelevantEvent = ULTIMA_TIMETREE_EVENTS[1];
    const addedEvent = ULTIMA_TIMETREE_EVENTS[2];
    state.groups.vortex.target = 0;
    state.groups.lapis.target = 6;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.eventPlans[selectedEvent.id] = { planned: true, attended: false, task: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-19' });

    expect(result.status).toBe('planned');
    expect(result.addedEventCount).toBe(1);
    expect(getUltimaEventPlan(planned, irrelevantEvent.id).planned).toBe(false);
    expect(getUltimaEventPlan(planned, addedEvent.id).planned).toBe(true);
  });

  it('adds events without assigning spend in the no-spend strategy', () => {
    const state = createDefaultUltimaPlannerState();
    const selectedEvent = ULTIMA_TIMETREE_EVENTS[0];
    const addedEvent = ULTIMA_TIMETREE_EVENTS[1];
    state.groups.vortex.target = 5;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.autoPlanner.strategy = 'minimalEventsNoSpend';
    state.eventPlans[selectedEvent.id] = { planned: true, attended: false, task: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-19' });

    expect(result.status).toBe('planned');
    expect(result.addedEventCount).toBe(1);
    expect(result.spendTotal).toBe(0);
    expect(planned.entries[makeEntryKey(selectedEvent.id, 'vortex')].spend).toBe(0);
    expect(planned.entries[makeEntryKey(addedEvent.id, 'vortex')].spend).toBe(0);
  });

  it('does not add activities when the remaining unplanned events cannot complete the plan', () => {
    const state = createDefaultUltimaPlannerState();
    state.groups.vortex.target = 200;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;

    const { state: planned, result } = applyUltimaAutoPlan(state);
    const plannedEventIds = ULTIMA_TIMETREE_EVENTS
      .filter((event) => getUltimaEventPlan(planned, event.id).planned)
      .map((event) => event.id);

    expect(result.status).toBe('impossible');
    expect(result.addedEventCount).toBe(0);
    expect(plannedEventIds).toEqual([]);
  });

  it('does not modify attended events while adding unplanned events', () => {
    const state = createDefaultUltimaPlannerState();
    const attendedEvent = ULTIMA_TIMETREE_EVENTS[0];
    state.groups.vortex.target = 6;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;
    state.eventPlans[attendedEvent.id] = { planned: false, attended: true, task: 2 };
    state.entries[makeEntryKey(attendedEvent.id, 'vortex')] = { collected: 0, spend: 1, extraCost: 0 };

    const { state: planned, result } = applyUltimaAutoPlan(state);

    expect(result.status).toBe('planned');
    expect(getUltimaEventPlan(planned, attendedEvent.id)).toEqual({ planned: false, attended: true, task: 2 });
    expect(planned.entries[makeEntryKey(attendedEvent.id, 'vortex')].spend).toBe(1);
  });

  it('skips expired activities when auto-adding events', () => {
    const state = createDefaultUltimaPlannerState();
    const expiredEvent = ULTIMA_TIMETREE_EVENTS[0];
    const todayEvent = ULTIMA_TIMETREE_EVENTS[1];
    state.groups.vortex.target = 5;
    state.groups.lapis.target = 0;
    state.groups.annyx.target = 0;
    state.groups.misology.target = 0;

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-20' });

    expect(result.status).toBe('planned');
    expect(isUltimaEventExpired(expiredEvent, '2026-06-20')).toBe(true);
    expect(isUltimaEventExpired(todayEvent, '2026-06-20')).toBe(false);
    expect(getUltimaEventPlan(planned, expiredEvent.id).planned).toBe(false);
    expect(getUltimaEventPlan(planned, todayEvent.id).planned).toBe(true);
  });

  it('does not keep spend points on groups that already exceed the target in a full 50pt plan', () => {
    const state = createDefaultUltimaPlannerState();

    const { state: planned, result } = applyUltimaAutoPlan(state, { today: '2026-06-21' });

    expect(result.status).toBe('planned');
    for (const groupKey of ['vortex', 'lapis', 'annyx', 'misology'] as const) {
      const stat = calculateUltimaGroupStats(planned, groupKey);
      expect(stat.total).toBeGreaterThanOrEqual(50);
      expect(stat.total <= stat.target || stat.spend === 0).toBe(true);
    }
  });

  it('counts attended events as acquired points without changing the initial score', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    state.groups.vortex.baseCollected = 2;
    state.eventPlans[event.id] = { planned: false, attended: true, task: 2 };
    state.entries[makeEntryKey(event.id, 'vortex')] = { collected: 9, spend: 1, extraCost: 0 };

    const stat = calculateUltimaGroupStats(state, 'vortex');

    expect(stat.baseCollected).toBe(2);
    expect(stat.acquired).toBe(6);
    expect(stat.planned).toBe(0);
    expect(stat.eventCount).toBe(1);
  });

  it('allows attended event task points to differ by group', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => (
      item.groupKeys.includes('vortex') && item.groupKeys.includes('lapis')
    ))!;
    state.eventPlans[event.id] = { planned: false, attended: true, task: 3 };
    state.entries[makeEntryKey(event.id, 'vortex')] = { collected: 0, task: 0, spend: 0, extraCost: 0 };
    state.entries[makeEntryKey(event.id, 'lapis')] = { collected: 0, task: 2, spend: 0, extraCost: 0 };

    expect(getUltimaEntryTask(state, event.id, 'vortex')).toBe(0);
    expect(getUltimaEntryTask(state, event.id, 'lapis')).toBe(2);
    expect(calculateUltimaGroupStats(state, 'vortex').acquired).toBe(1);
    expect(calculateUltimaGroupStats(state, 'lapis').acquired).toBe(3);
  });

  it('allows attended event participation points to differ by group', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => (
      item.groupKeys.includes('vortex') && item.groupKeys.includes('lapis')
    ))!;
    state.eventPlans[event.id] = { planned: false, attended: true, task: 2 };
    state.entries[makeEntryKey(event.id, 'vortex')] = {
      collected: 0,
      participation: 0,
      task: 2,
      spend: 1,
      extraCost: 0,
    };
    state.entries[makeEntryKey(event.id, 'lapis')] = {
      collected: 0,
      participation: 1,
      task: 2,
      spend: 1,
      extraCost: 0,
    };

    expect(getUltimaEntryParticipation(state, event.id, 'vortex')).toBe(0);
    expect(getUltimaEntryParticipation(state, event.id, 'lapis')).toBe(1);
    expect(calculateUltimaGroupStats(state, 'vortex').acquired).toBe(3);
    expect(calculateUltimaGroupStats(state, 'lapis').acquired).toBe(4);
  });

  it('keeps older attended event task points as a fallback when entries do not store group tasks', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    state.eventPlans[event.id] = { planned: false, attended: true, task: 2 };
    state.entries[makeEntryKey(event.id, 'vortex')] = { collected: 0, spend: 1, extraCost: 0 };

    const stat = calculateUltimaGroupStats(state, 'vortex');

    expect(getUltimaEntryTask(state, event.id, 'vortex')).toBe(2);
    expect(stat.acquired).toBe(4);
  });

  it('keeps older attended task fallback after sanitizing stored planner state', () => {
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    const state = sanitizeUltimaPlannerState({
      schemaVersion: 1,
      groups: {
        vortex: { target: 50, baseCollected: 0 },
      },
      eventPlans: {
        [event.id]: { planned: false, attended: true, task: 2 },
      },
      entries: {
        [makeEntryKey(event.id, 'vortex')]: { collected: 0, spend: 1, extraCost: 0 },
      },
      autoPlanner: {},
    });

    expect(getUltimaEntryTask(state, event.id, 'vortex')).toBe(2);
    expect(calculateUltimaGroupStats(state, 'vortex').acquired).toBe(4);
  });

  it('keeps older attended participation fallback after sanitizing stored planner state', () => {
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    const state = sanitizeUltimaPlannerState({
      schemaVersion: 1,
      groups: {
        vortex: { target: 50, baseCollected: 0 },
      },
      eventPlans: {
        [event.id]: { planned: false, attended: true, task: 2 },
      },
      entries: {
        [makeEntryKey(event.id, 'vortex')]: { collected: 0, spend: 1, extraCost: 0 },
      },
      autoPlanner: {},
    });

    expect(getUltimaEntryParticipation(state, event.id, 'vortex')).toBe(1);
    expect(calculateUltimaGroupStats(state, 'vortex').acquired).toBe(4);
  });

  it('marks a group as reachable when planned points can meet the target', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    state.groups.vortex.target = 5;
    state.eventPlans[event.id] = { planned: true, attended: false, task: 3 };
    state.entries[makeEntryKey(event.id, 'vortex')] = { collected: 0, spend: 1, extraCost: 0 };

    const stat = calculateUltimaGroupStats(state, 'vortex');

    expect(stat.complete).toBe(false);
    expect(stat.reachable).toBe(true);
    expect(stat.remaining).toBe(0);
  });

  it('caps manually entered spend at the remaining event capacity', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    const plan = { planned: true, attended: false, task: 3 };
    state.eventPlans[event.id] = plan;
    state.entries[makeEntryKey(event.id, 'vortex')] = {
      collected: 0,
      spend: clampUltimaEventSpend(plan, 10),
      extraCost: 0,
    };

    const stat = calculateUltimaGroupStats(state, 'vortex');

    expect(state.entries[makeEntryKey(event.id, 'vortex')].spend).toBe(1);
    expect(stat.spend).toBe(1);
    expect(stat.planned).toBe(5);
  });

  it('uses attended participation points when capping spend capacity', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    state.eventPlans[event.id] = { planned: false, attended: true, task: 3 };
    state.entries[makeEntryKey(event.id, 'vortex')] = {
      collected: 0,
      participation: 0,
      task: 3,
      spend: 10,
      extraCost: 0,
    };

    const stat = calculateUltimaGroupStats(state, 'vortex');

    expect(clampUltimaGroupSpend(state, event.id, 'vortex', 10)).toBe(2);
    expect(stat.acquired).toBe(5);
  });

  it('clamps existing spend when task points reduce the remaining capacity', () => {
    const state = createDefaultUltimaPlannerState();
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    state.eventPlans[event.id] = { planned: true, attended: false, task: 0 };
    state.entries[makeEntryKey(event.id, 'vortex')] = { collected: 0, spend: 4, extraCost: 0 };

    const updated = updateUltimaEventTask(state, event.id, 3);

    expect(getUltimaEventPlan(updated, event.id).task).toBe(3);
    expect(updated.entries[makeEntryKey(event.id, 'vortex')].spend).toBe(1);
  });

  it('sanitizes stored over-cap spend before returning planner state', () => {
    const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.groupKeys.includes('vortex'))!;
    const state = sanitizeUltimaPlannerState({
      schemaVersion: 1,
      groups: { vortex: { target: 50, baseCollected: 0 } },
      eventPlans: {
        [event.id]: { planned: true, attended: false, task: 3 },
      },
      entries: {
        [makeEntryKey(event.id, 'vortex')]: { collected: 0, spend: 10, extraCost: 0 },
      },
      autoPlanner: {},
    });

    expect(state.entries[makeEntryKey(event.id, 'vortex')].spend).toBe(1);
  });

  it('caps stored target points at 100', () => {
    const state = sanitizeUltimaPlannerState({
      schemaVersion: 1,
      groups: {
        vortex: { target: 150, baseCollected: 0 },
      },
      eventPlans: {},
      entries: {},
      autoPlanner: {},
    });

    expect(state.groups.vortex.target).toBe(100);
    expect(calculateUltimaGroupStats(state, 'vortex').target).toBe(100);
  });

  it('resets planned events without modifying attended events', () => {
    const state = createDefaultUltimaPlannerState();
    const plannedEvent = ULTIMA_TIMETREE_EVENTS[0];
    const attendedEvent = ULTIMA_TIMETREE_EVENTS[1];
    state.eventPlans[plannedEvent.id] = { planned: true, attended: false, task: 3 };
    state.eventPlans[attendedEvent.id] = { planned: false, attended: true, task: 2 };
    state.entries[makeEntryKey(plannedEvent.id, 'vortex')] = { collected: 0, spend: 2, extraCost: 0 };
    state.entries[makeEntryKey(attendedEvent.id, 'vortex')] = { collected: 0, spend: 1, extraCost: 0 };

    const reset = resetUltimaPlannedEvents(state);

    expect(getUltimaEventPlan(reset, plannedEvent.id)).toEqual({ planned: false, attended: false, task: 0 });
    expect(reset.entries[makeEntryKey(plannedEvent.id, 'vortex')].spend).toBe(0);
    expect(getUltimaEventPlan(reset, attendedEvent.id)).toEqual({ planned: false, attended: true, task: 2 });
    expect(reset.entries[makeEntryKey(attendedEvent.id, 'vortex')].spend).toBe(1);
  });

  it('falls back to defaults for invalid stored state', () => {
    const state = sanitizeUltimaPlannerState({ schemaVersion: 99, groups: {} });

    expect(state.schemaVersion).toBe(1);
    expect(state.groups.vortex.target).toBe(50);
    expect(Object.keys(state.eventPlans)).toHaveLength(0);
  });
});

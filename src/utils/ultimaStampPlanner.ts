export type UltimaGroupKey = 'vortex' | 'lapis' | 'annyx' | 'misology';

export type UltimaGroup = {
  key: UltimaGroupKey;
  emoji: string;
  name: string;
};

export type UltimaEvent = {
  id: string;
  date: string;
  title: string;
  venue: string;
  url: string;
  sourceUrl: string;
  groupKeys: UltimaGroupKey[];
};

export type UltimaPlannerGroupState = {
  target: number;
  baseCollected: number;
};

export type UltimaPlannerEventPlan = {
  planned: boolean;
  attended: boolean;
  task: number;
};

export type UltimaEventPlanStatus = 'planned' | 'unplanned' | 'attended';
export type UltimaAutoPlanStrategy = 'minimalEvents' | 'minimalEventsNoSpend';

export type UltimaPlannerEntry = {
  collected: number;
  participation?: number;
  task?: number;
  spend: number;
  extraCost: number;
};

export type UltimaPlannerState = {
  schemaVersion: 1;
  catalogVersion: number;
  groups: Record<UltimaGroupKey, UltimaPlannerGroupState>;
  eventPlans: Record<string, UltimaPlannerEventPlan>;
  entries: Record<string, UltimaPlannerEntry>;
  autoPlanner: {
    maxTask: string;
    maxSpend: string;
    strategy: UltimaAutoPlanStrategy;
  };
};

export type UltimaGroupStats = {
  groupKey: UltimaGroupKey;
  target: number;
  active: boolean;
  eventCount: number;
  plannedCount: number;
  attendedCount: number;
  baseCollected: number;
  acquired: number;
  participation: number;
  task: number;
  spend: number;
  extraCost: number;
  planned: number;
  total: number;
  remaining: number;
  complete: boolean;
  reachable: boolean;
};

export type UltimaOverview = {
  activeGroupCount: number;
  completeGroupCount: number;
  selectedEventCount: number;
  remaining: number;
  estimatedSpend: number;
};

export type UltimaAutoPlanResult = {
  status: 'planned' | 'limited' | 'empty' | 'complete' | 'impossible';
  message: string;
  taskTotal: number;
  spendTotal: number;
  remainingTotal: number;
  addedEventCount: number;
};

export type UltimaAutoPlanOptions = {
  includeUnplannedEvents?: boolean;
  replanSelectedEvents?: boolean;
  today?: string;
};

export const ULTIMA_STAMP_SCHEMA_VERSION = 1;
export const ULTIMA_STAMP_CATALOG_VERSION = 2;
export const ULTIMA_POINT_CAP_PER_EVENT = 5;
export const ULTIMA_TASK_CAP_PER_EVENT = 3;
export const ULTIMA_TARGET_CAP = 100;
export const ULTIMA_YUAN_PER_POINT = 200;
export const ULTIMA_TARGET_OPTIONS = [0, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100];
export const ULTIMA_DEFAULT_AUTO_PLAN_STRATEGY: UltimaAutoPlanStrategy = 'minimalEvents';

const ULTIMA_RESET_STORED_EVENT_IDS = new Set<string>([
  '2987058998119821742',
]);

export const ULTIMA_GROUPS: UltimaGroup[] = [
  { key: 'vortex', emoji: '🌀', name: 'Fixture Group A' },
  { key: 'lapis', emoji: '💎', name: 'Fixture Group B' },
  { key: 'annyx', emoji: '🌋', name: 'Fixture Group C' },
  { key: 'misology', emoji: '⛩️', name: 'Fixture Group D' },
];

export const ULTIMA_TIMETREE_EVENTS: UltimaEvent[] = [
  {
    id: '2950444430602072753',
    date: '2026-06-19',
    title: 'Fixture event 01',
    venue: 'vas ear',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'annyx'],
  },
  {
    id: '2950445423058284710',
    date: '2026-06-20',
    title: 'Fixture event 02',
    venue: '新歌空间',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'annyx', 'misology'],
  },
  {
    id: '2950445514963874504',
    date: '2026-06-20',
    title: 'Fixture event 03',
    venue: '世界树剧场',
    url: '',
    sourceUrl: '',
    groupKeys: ['lapis'],
  },
  {
    id: '2950445847798673771',
    date: '2026-06-21',
    title: 'Fixture event 04',
    venue: '7HERTZ LIVE（闵行区虹许路731号B4号楼）',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'misology'],
  },
  {
    id: '2950446069652189719',
    date: '2026-06-27',
    title: 'Fixture event 05',
    venue: '育音堂小镇C厅',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'annyx', 'misology'],
  },
  {
    id: '2950446277890995020',
    date: '2026-06-28',
    title: 'Fixture event 06',
    venue: '新歌空间',
    url: '',
    sourceUrl: '',
    groupKeys: ['lapis'],
  },
  {
    id: '2961658637792113099',
    date: '2026-06-28',
    title: 'Fixture event 07',
    venue: '新歌空间',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'misology'],
  },
  {
    id: '2989459812360713041',
    date: '2026-07-03',
    title: 'Fixture event 08',
    venue: '上海广播艺术中心',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'annyx'],
  },
  {
    id: '2950446411328581738',
    date: '2026-07-04',
    title: 'Fixture event 09',
    venue: '新歌空间',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis'],
  },
  {
    id: '2967029679230349581',
    date: '2026-07-05',
    title: 'Fixture event 10',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['lapis', 'annyx', 'misology'],
  },
  {
    id: '2983343415721259835',
    date: '2026-07-10',
    title: 'Fixture event 11',
    venue: '国家会展中心',
    url: '',
    sourceUrl: '',
    groupKeys: ['annyx'],
  },
  {
    id: '2983343595145196518',
    date: '2026-07-11',
    title: 'Fixture event 12',
    venue: '国家会展中心',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex'],
  },
  {
    id: '2983344466520240495',
    date: '2026-07-11',
    title: 'Fixture event 13',
    venue: '金山城市沙滩',
    url: '',
    sourceUrl: '',
    groupKeys: ['lapis', 'annyx', 'misology'],
  },
  {
    id: '2983343702905254026',
    date: '2026-07-12',
    title: 'Fixture event 14',
    venue: '国家会展中心',
    url: '',
    sourceUrl: '',
    groupKeys: ['lapis'],
  },
  {
    id: '2983344784331043771',
    date: '2026-07-12',
    title: 'Fixture event 15',
    venue: '金山城市沙滩',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'annyx', 'misology'],
  },
  {
    id: '2950446648726188237',
    date: '2026-07-18',
    title: 'Fixture event 16',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'annyx', 'misology'],
  },
  {
    id: '2950447177434985345',
    date: '2026-07-19',
    title: 'Fixture event 17',
    venue: '新歌空间',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'misology'],
  },
  {
    id: '2960476449402844036',
    date: '2026-07-24',
    title: 'Fixture event 18',
    venue: '上海月星环球港',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex'],
  },
  {
    id: '2950446777189331850',
    date: '2026-07-25',
    title: 'Fixture event 19',
    venue: '新歌空间',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'misology'],
  },
  {
    id: '2950447471724131216',
    date: '2026-07-26',
    title: 'Fixture event 20',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['lapis', 'annyx', 'misology'],
  },
  {
    id: '2997564053151347226',
    date: '2026-07-31',
    title: 'Fixture event 21',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'annyx', 'misology'],
  },
  {
    id: '2987058998119821742',
    date: '2026-08-01',
    title: 'Fixture event 22',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['annyx', 'misology'],
  },
  {
    id: '2997564356777014032',
    date: '2026-08-01',
    title: 'Fixture event 23',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis'],
  },
  {
    id: '2987060829680103899',
    date: '2026-08-02',
    title: 'Fixture event 24',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'annyx'],
  },
  {
    id: '2997573376996864476:2026-08-07',
    date: '2026-08-07',
    title: 'Fixture event 25',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['annyx', 'misology'],
  },
  {
    id: '2997573376996864476:2026-08-08',
    date: '2026-08-08',
    title: 'Fixture event 26',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['annyx', 'misology'],
  },
  {
    id: '2997573663409107954',
    date: '2026-08-08',
    title: 'Fixture event 27',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis'],
  },
  {
    id: '2997573376996864476:2026-08-09',
    date: '2026-08-09',
    title: 'Fixture event 28',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['annyx', 'misology'],
  },
  {
    id: '2997573719587615510',
    date: '2026-08-09',
    title: 'Fixture event 29',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis'],
  },
  {
    id: '2987060550456898245',
    date: '2026-08-15',
    title: 'Fixture event 30',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'annyx', 'misology'],
  },
  {
    id: '2987061913169490813',
    date: '2026-08-16',
    title: 'Fixture event 31',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['lapis', 'annyx'],
  },
  {
    id: '2997574135905841636:2026-08-22',
    date: '2026-08-22',
    title: 'Fixture event 32',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis'],
  },
  {
    id: '2997574135905841636:2026-08-23',
    date: '2026-08-23',
    title: 'Fixture event 33',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis'],
  },
  {
    id: '2987059500110902085',
    date: '2026-08-29',
    title: 'Fixture event 34',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis', 'annyx', 'misology'],
  },
  {
    id: '2987061209222672896',
    date: '2026-08-30',
    title: 'Fixture event 35',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['vortex', 'lapis'],
  },
  {
    id: '2997574499686216423',
    date: '2026-08-30',
    title: 'Fixture event 36',
    venue: '',
    url: '',
    sourceUrl: '',
    groupKeys: ['misology'],
  },
];

export function makeEntryKey(eventId: string, groupKey: UltimaGroupKey): string {
  return `${eventId}:${groupKey}`;
}

export function toPlannerNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function clampUltimaTarget(value: unknown): number {
  return Math.min(ULTIMA_TARGET_CAP, toPlannerNumber(value));
}

export function clampUltimaTask(value: unknown): number {
  return Math.min(ULTIMA_TASK_CAP_PER_EVENT, toPlannerNumber(value));
}

export function clampUltimaParticipation(value: unknown): number {
  return Math.min(1, toPlannerNumber(value));
}

export function parsePlannerLimit(value: string): number {
  if (value.trim() === '') return Infinity;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDateString(today?: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(today ?? '') ? today! : formatLocalDate(new Date());
}

export function isUltimaEventExpired(event: UltimaEvent, today?: string): boolean {
  return event.date < getTodayDateString(today);
}

function sanitizeAutoPlanStrategy(value: unknown): UltimaAutoPlanStrategy {
  return value === 'minimalEventsNoSpend' ? 'minimalEventsNoSpend' : ULTIMA_DEFAULT_AUTO_PLAN_STRATEGY;
}

export function createDefaultUltimaPlannerState(): UltimaPlannerState {
  return {
    schemaVersion: ULTIMA_STAMP_SCHEMA_VERSION,
    catalogVersion: ULTIMA_STAMP_CATALOG_VERSION,
    groups: Object.fromEntries(
      ULTIMA_GROUPS.map((group) => [group.key, { target: 50, baseCollected: 0 }]),
    ) as Record<UltimaGroupKey, UltimaPlannerGroupState>,
    eventPlans: {},
    entries: {},
    autoPlanner: {
      maxTask: '',
      maxSpend: '',
      strategy: ULTIMA_DEFAULT_AUTO_PLAN_STRATEGY,
    },
  };
}

export function getUltimaGroup(groupKey: UltimaGroupKey): UltimaGroup {
  return ULTIMA_GROUPS.find((group) => group.key === groupKey) ?? ULTIMA_GROUPS[0];
}

export function getUltimaEventPlan(state: UltimaPlannerState, eventId: string): UltimaPlannerEventPlan {
  return state.eventPlans[eventId] ?? { planned: false, attended: false, task: 0 };
}

export function getUltimaEventPlanStatus(plan: UltimaPlannerEventPlan): UltimaEventPlanStatus {
  if (plan.attended) return 'attended';
  if (plan.planned) return 'planned';
  return 'unplanned';
}

export function isUltimaEventActive(plan: UltimaPlannerEventPlan): boolean {
  return plan.planned || plan.attended;
}

export function getUltimaSpendCapacity(plan: UltimaPlannerEventPlan): number {
  if (!isUltimaEventActive(plan)) return 0;
  const usedPoints = 1 + clampUltimaTask(plan.task);
  return Math.max(0, ULTIMA_POINT_CAP_PER_EVENT - usedPoints);
}

export function clampUltimaEventSpend(plan: UltimaPlannerEventPlan, spend: unknown): number {
  return Math.min(getUltimaSpendCapacity(plan), toPlannerNumber(spend));
}

export function getUltimaEntryTask(
  state: UltimaPlannerState,
  eventId: string,
  groupKey: UltimaGroupKey,
): number {
  const plan = getUltimaEventPlan(state, eventId);
  const entry = state.entries[makeEntryKey(eventId, groupKey)];
  if (!plan.attended) return clampUltimaTask(plan.task);
  return entry && 'task' in entry ? clampUltimaTask(entry.task) : clampUltimaTask(plan.task);
}

export function getUltimaEntryParticipation(
  state: UltimaPlannerState,
  eventId: string,
  groupKey: UltimaGroupKey,
): number {
  const plan = getUltimaEventPlan(state, eventId);
  const entry = state.entries[makeEntryKey(eventId, groupKey)];
  if (!isUltimaEventActive(plan)) return 0;
  if (!plan.attended) return 1;
  return entry && 'participation' in entry ? clampUltimaParticipation(entry.participation) : 1;
}

export function getUltimaGroupSpendCapacity(
  state: UltimaPlannerState,
  eventId: string,
  groupKey: UltimaGroupKey,
): number {
  const plan = getUltimaEventPlan(state, eventId);
  if (!isUltimaEventActive(plan)) return 0;
  const usedPoints = getUltimaEntryParticipation(state, eventId, groupKey)
    + getUltimaEntryTask(state, eventId, groupKey);
  return Math.max(0, ULTIMA_POINT_CAP_PER_EVENT - usedPoints);
}

export function clampUltimaGroupSpend(
  state: UltimaPlannerState,
  eventId: string,
  groupKey: UltimaGroupKey,
  spend: unknown,
): number {
  return Math.min(getUltimaGroupSpendCapacity(state, eventId, groupKey), toPlannerNumber(spend));
}

export function getUltimaEntry(
  state: UltimaPlannerState,
  eventId: string,
  groupKey: UltimaGroupKey,
): UltimaPlannerEntry {
  return state.entries[makeEntryKey(eventId, groupKey)] ?? { collected: 0, spend: 0, extraCost: 0 };
}

export function getActiveUltimaGroups(state: UltimaPlannerState): UltimaGroup[] {
  return ULTIMA_GROUPS.filter((group) => clampUltimaTarget(state.groups[group.key]?.target) > 0);
}

export function getEventActiveGroupKeys(state: UltimaPlannerState, event: UltimaEvent): UltimaGroupKey[] {
  return event.groupKeys.filter((groupKey) => clampUltimaTarget(state.groups[groupKey]?.target) > 0);
}

export function sanitizeUltimaPlannerState(rawValue: unknown): UltimaPlannerState {
  const fallback = createDefaultUltimaPlannerState();
  if (!rawValue || typeof rawValue !== 'object') return fallback;

  const raw = rawValue as Partial<UltimaPlannerState>;
  if (raw.schemaVersion !== ULTIMA_STAMP_SCHEMA_VERSION) return fallback;
  const shouldResetStoredEvents = toPlannerNumber(raw.catalogVersion) < ULTIMA_STAMP_CATALOG_VERSION;

  const groups = { ...fallback.groups };
  for (const group of ULTIMA_GROUPS) {
    const rawGroup = raw.groups?.[group.key];
    groups[group.key] = {
      target: clampUltimaTarget(rawGroup?.target ?? 50),
      baseCollected: toPlannerNumber(rawGroup?.baseCollected),
    };
  }

  const eventPlans: Record<string, UltimaPlannerEventPlan> = {};
  if (raw.eventPlans && typeof raw.eventPlans === 'object') {
    for (const event of ULTIMA_TIMETREE_EVENTS) {
      if (shouldResetStoredEvents && ULTIMA_RESET_STORED_EVENT_IDS.has(event.id)) continue;
      const rawPlan = raw.eventPlans[event.id];
      if (!rawPlan || typeof rawPlan !== 'object') continue;
      const attended = Boolean(rawPlan.attended);
      eventPlans[event.id] = {
        planned: attended ? false : Boolean(rawPlan.planned),
        attended,
        task: Math.min(ULTIMA_TASK_CAP_PER_EVENT, toPlannerNumber(rawPlan.task)),
      };
    }
  }

  const entries: Record<string, UltimaPlannerEntry> = {};
  if (raw.entries && typeof raw.entries === 'object') {
    for (const event of ULTIMA_TIMETREE_EVENTS) {
      if (shouldResetStoredEvents && ULTIMA_RESET_STORED_EVENT_IDS.has(event.id)) continue;
      for (const groupKey of event.groupKeys) {
        const key = makeEntryKey(event.id, groupKey);
        const rawEntry = raw.entries[key];
        if (!rawEntry || typeof rawEntry !== 'object') continue;
        const plan = eventPlans[event.id] ?? { planned: false, attended: false, task: 0 };
        const entryParticipation = 'participation' in rawEntry
          ? clampUltimaParticipation(rawEntry.participation)
          : undefined;
        const entryTask = 'task' in rawEntry ? clampUltimaTask(rawEntry.task) : undefined;
        const participationForSpend = plan.attended ? entryParticipation ?? 1 : 1;
        const taskForSpend = plan.attended ? entryTask ?? clampUltimaTask(plan.task) : clampUltimaTask(plan.task);
        const sanitizedEntry: UltimaPlannerEntry = {
          collected: toPlannerNumber(rawEntry.collected),
          spend: Math.min(
            Math.max(0, ULTIMA_POINT_CAP_PER_EVENT - participationForSpend - taskForSpend),
            toPlannerNumber(rawEntry.spend),
          ),
          extraCost: toPlannerNumber(rawEntry.extraCost),
        };
        if (entryParticipation !== undefined) sanitizedEntry.participation = entryParticipation;
        if (entryTask !== undefined) sanitizedEntry.task = entryTask;
        entries[key] = sanitizedEntry;
      }
    }
  }

  return {
    schemaVersion: ULTIMA_STAMP_SCHEMA_VERSION,
    catalogVersion: ULTIMA_STAMP_CATALOG_VERSION,
    groups,
    eventPlans,
    entries,
    autoPlanner: {
      maxTask: typeof raw.autoPlanner?.maxTask === 'string' ? raw.autoPlanner.maxTask : '',
      maxSpend: typeof raw.autoPlanner?.maxSpend === 'string' ? raw.autoPlanner.maxSpend : '',
      strategy: sanitizeAutoPlanStrategy(raw.autoPlanner?.strategy),
    },
  };
}

export function updateUltimaEventTask(
  state: UltimaPlannerState,
  eventId: string,
  task: number,
): UltimaPlannerState {
  const nextPlan = {
    ...getUltimaEventPlan(state, eventId),
    task: clampUltimaTask(task),
  };
  const entries = { ...state.entries };
  const event = ULTIMA_TIMETREE_EVENTS.find((item) => item.id === eventId);
  event?.groupKeys.forEach((groupKey) => {
    const key = makeEntryKey(eventId, groupKey);
    const entry = getUltimaEntry(state, eventId, groupKey);
    entries[key] = {
      ...entry,
      spend: nextPlan.attended
        ? Math.min(
          Math.max(
            0,
            ULTIMA_POINT_CAP_PER_EVENT
              - getUltimaEntryParticipation(state, eventId, groupKey)
              - getUltimaEntryTask(state, eventId, groupKey),
          ),
          toPlannerNumber(entry.spend),
        )
        : clampUltimaEventSpend(nextPlan, entry.spend),
    };
  });

  return {
    ...state,
    entries,
    eventPlans: {
      ...state.eventPlans,
      [eventId]: nextPlan,
    },
  };
}

export function resetUltimaPlannedEvents(state: UltimaPlannerState): UltimaPlannerState {
  const eventPlans = { ...state.eventPlans };
  const entries = { ...state.entries };

  for (const event of ULTIMA_TIMETREE_EVENTS) {
    const plan = getUltimaEventPlan(state, event.id);
    if (!plan.planned || plan.attended) continue;

    eventPlans[event.id] = { ...plan, planned: false, task: 0 };
    for (const groupKey of event.groupKeys) {
      const key = makeEntryKey(event.id, groupKey);
      entries[key] = { ...getUltimaEntry(state, event.id, groupKey), spend: 0 };
    }
  }

  return { ...state, eventPlans, entries };
}

export function calculateUltimaGroupStats(
  state: UltimaPlannerState,
  groupKey: UltimaGroupKey,
): UltimaGroupStats {
  const groupState = state.groups[groupKey];
  const target = clampUltimaTarget(groupState?.target);
  const baseCollected = toPlannerNumber(groupState?.baseCollected);
  const rows = ULTIMA_TIMETREE_EVENTS.filter((event) => event.groupKeys.includes(groupKey));

  const totals = rows.reduce((acc, event) => {
    const plan = getUltimaEventPlan(state, event.id);
    const entry = getUltimaEntry(state, event.id, groupKey);
    const active = isUltimaEventActive(plan);
    const eventPoints = active ? getUltimaEntryParticipation(state, event.id, groupKey) : 0;
    const taskPoints = active ? getUltimaEntryTask(state, event.id, groupKey) : 0;
    const spendPoints = active ? clampUltimaGroupSpend(state, event.id, groupKey, entry.spend) : 0;
    acc.plannedCount += plan.planned ? 1 : 0;
    acc.attendedCount += plan.attended ? 1 : 0;
    acc.attendedPoints += plan.attended ? eventPoints + taskPoints + spendPoints : 0;
    acc.participation += plan.planned ? eventPoints : 0;
    acc.task += plan.planned ? taskPoints : 0;
    acc.spend += plan.planned ? spendPoints : 0;
    acc.extraCost += toPlannerNumber(entry.extraCost);
    return acc;
  }, {
    plannedCount: 0,
    attendedCount: 0,
    attendedPoints: 0,
    participation: 0,
    task: 0,
    spend: 0,
    extraCost: 0,
  });

  const active = target > 0;
  const acquired = baseCollected + totals.attendedPoints;
  const planned = totals.participation + totals.task + totals.spend;
  const total = acquired + planned;
  const remaining = active ? Math.max(0, target - total) : 0;
  const complete = active && acquired >= target;

  return {
    groupKey,
    target,
    active,
    eventCount: totals.plannedCount + totals.attendedCount,
    plannedCount: totals.plannedCount,
    attendedCount: totals.attendedCount,
    baseCollected,
    acquired,
    participation: totals.participation,
    task: totals.task,
    spend: totals.spend,
    extraCost: totals.extraCost,
    planned,
    total,
    remaining,
    complete,
    reachable: active && total >= target,
  };
}

export function calculateUltimaOverview(state: UltimaPlannerState): UltimaOverview {
  const stats = ULTIMA_GROUPS.map((group) => calculateUltimaGroupStats(state, group.key));
  const plannedEventIds = ULTIMA_TIMETREE_EVENTS
    .filter((event) => getUltimaEventPlan(state, event.id).planned)
    .map((event) => event.id);

  return {
    activeGroupCount: stats.filter((stat) => stat.active).length,
    completeGroupCount: stats.filter((stat) => stat.reachable).length,
    selectedEventCount: plannedEventIds.length,
    remaining: stats.reduce((sum, stat) => sum + stat.remaining, 0),
    estimatedSpend: stats.reduce((sum, stat) => sum + stat.spend, 0) * ULTIMA_YUAN_PER_POINT,
  };
}

function getNeedsAfterFixedPoints(state: UltimaPlannerState): Record<UltimaGroupKey, number> {
  return Object.fromEntries(ULTIMA_GROUPS.map((group) => {
    const groupState = state.groups[group.key];
    const target = clampUltimaTarget(groupState?.target);
    if (target <= 0) return [group.key, 0];

    let acquired = toPlannerNumber(groupState?.baseCollected);
    let participation = 0;
    for (const event of ULTIMA_TIMETREE_EVENTS.filter((item) => item.groupKeys.includes(group.key))) {
      const plan = getUltimaEventPlan(state, event.id);
      const entry = getUltimaEntry(state, event.id, group.key);
      const active = isUltimaEventActive(plan);
      const eventPoints = active ? getUltimaEntryParticipation(state, event.id, group.key) : 0;
      const taskPoints = active ? getUltimaEntryTask(state, event.id, group.key) : 0;
      const spendPoints = active ? clampUltimaGroupSpend(state, event.id, group.key, entry.spend) : 0;
      acquired += plan.attended ? eventPoints + taskPoints + spendPoints : 0;
      participation += plan.planned ? eventPoints : 0;
    }

    return [group.key, Math.max(0, target - acquired - participation)];
  })) as Record<UltimaGroupKey, number>;
}

function totalNeeds(needs: Record<UltimaGroupKey, number>): number {
  return Object.values(needs).reduce((sum, value) => sum + Math.max(0, value), 0);
}

function replaceNeeds(
  needs: Record<UltimaGroupKey, number>,
  nextNeeds: Record<UltimaGroupKey, number>,
): void {
  for (const group of ULTIMA_GROUPS) {
    needs[group.key] = nextNeeds[group.key];
  }
}

function getNeedsAfterCurrentPlan(state: UltimaPlannerState): Record<UltimaGroupKey, number> {
  return Object.fromEntries(ULTIMA_GROUPS.map((group) => {
    const stat = calculateUltimaGroupStats(state, group.key);
    return [group.key, stat.active ? stat.remaining : 0];
  })) as Record<UltimaGroupKey, number>;
}

function getCurrentPlannedVariableTotals(state: UltimaPlannerState): { task: number; spend: number } {
  return ULTIMA_TIMETREE_EVENTS.reduce((acc, event) => {
    const plan = getUltimaEventPlan(state, event.id);
    if (!plan.planned || plan.attended) return acc;
    acc.task += clampUltimaTask(plan.task);
    for (const groupKey of getEventActiveGroupKeys(state, event)) {
      acc.spend += clampUltimaGroupSpend(state, event.id, groupKey, getUltimaEntry(state, event.id, groupKey).spend);
    }
    return acc;
  }, { task: 0, spend: 0 });
}

function clonePlannerState(state: UltimaPlannerState): UltimaPlannerState {
  return {
    ...state,
    eventPlans: { ...state.eventPlans },
    entries: { ...state.entries },
  };
}

function resetVariablePointsForEvents(state: UltimaPlannerState, events: UltimaEvent[]): void {
  for (const event of events) {
    state.eventPlans[event.id] = {
      ...getUltimaEventPlan(state, event.id),
      task: 0,
    };
    for (const groupKey of event.groupKeys) {
      const key = makeEntryKey(event.id, groupKey);
      state.entries[key] = {
        ...getUltimaEntry(state, event.id, groupKey),
        spend: 0,
      };
    }
  }
}

function markEventsAsPlanned(state: UltimaPlannerState, events: UltimaEvent[]): void {
  for (const event of events) {
    state.eventPlans[event.id] = {
      ...getUltimaEventPlan(state, event.id),
      planned: true,
      attended: false,
      task: 0,
    };
    for (const groupKey of event.groupKeys) {
      const key = makeEntryKey(event.id, groupKey);
      state.entries[key] = {
        ...getUltimaEntry(state, event.id, groupKey),
        spend: 0,
      };
    }
  }
}

function allocateVariablePoints(
  state: UltimaPlannerState,
  events: UltimaEvent[],
  needs: Record<UltimaGroupKey, number>,
  taskLimit: number,
  spendLimit: number,
): { taskTotal: number; spendTotal: number } {
  let remainingTaskLimit = taskLimit;
  let remainingSpendLimit = spendLimit;
  let taskTotal = 0;
  let spendTotal = 0;

  let taskProgress = true;
  while (taskProgress && remainingTaskLimit > 0) {
    taskProgress = false;
    for (const event of events) {
      const plan = getUltimaEventPlan(state, event.id);
      if (plan.attended) continue;
      if (clampUltimaTask(plan.task) >= ULTIMA_TASK_CAP_PER_EVENT || remainingTaskLimit <= 0) continue;

      const activeGroupKeys = getEventActiveGroupKeys(state, event)
        .filter((groupKey) => needs[groupKey] > 0);
      if (activeGroupKeys.length === 0) continue;

      const nextTask = clampUltimaTask(plan.task) + 1;
      state.eventPlans[event.id] = { ...plan, task: nextTask };
      remainingTaskLimit -= 1;
      taskTotal += 1;
      taskProgress = true;
      replaceNeeds(needs, getNeedsAfterCurrentPlan(state));
    }
  }

  let spendProgress = true;
  while (spendProgress && remainingSpendLimit > 0) {
    spendProgress = false;
    for (const event of events) {
      const plan = getUltimaEventPlan(state, event.id);
      if (plan.attended) continue;
      for (const groupKey of getEventActiveGroupKeys(state, event)) {
        if (needs[groupKey] <= 0 || remainingSpendLimit <= 0) continue;
        const key = makeEntryKey(event.id, groupKey);
        const entry = getUltimaEntry(state, event.id, groupKey);
        const currentEventGroupPoints = getUltimaEntryParticipation(state, event.id, groupKey)
          + getUltimaEntryTask(state, event.id, groupKey)
          + toPlannerNumber(entry.spend);
        if (currentEventGroupPoints >= ULTIMA_POINT_CAP_PER_EVENT) continue;

        state.entries[key] = {
          ...entry,
          spend: toPlannerNumber(entry.spend) + 1,
        };
        remainingSpendLimit -= 1;
        spendTotal += 1;
        spendProgress = true;
        replaceNeeds(needs, getNeedsAfterCurrentPlan(state));
      }
    }
  }

  return { taskTotal, spendTotal };
}

export function applyUltimaAutoPlan(state: UltimaPlannerState, options: UltimaAutoPlanOptions = {}): {
  state: UltimaPlannerState;
  result: UltimaAutoPlanResult;
} {
  const includeUnplannedEvents = options.includeUnplannedEvents ?? true;
  const replanSelectedEvents = options.replanSelectedEvents ?? true;
  const initialNeeds = getNeedsAfterFixedPoints(state);
  if (totalNeeds(initialNeeds) <= 0) {
    return {
      state,
      result: {
        status: 'complete',
        message: '按照计划可以达成，无需自动规划',
        taskTotal: 0,
        spendTotal: 0,
        remainingTotal: 0,
        addedEventCount: 0,
      },
    };
  }

  const strategy = sanitizeAutoPlanStrategy(state.autoPlanner.strategy);
  const taskLimit = parsePlannerLimit(state.autoPlanner.maxTask);
  const spendLimit = strategy === 'minimalEventsNoSpend' ? 0 : parsePlannerLimit(state.autoPlanner.maxSpend);
  const selectedEvents = ULTIMA_TIMETREE_EVENTS.filter((event) => getUltimaEventPlan(state, event.id).planned);
  const plannedState = clonePlannerState(state);
  let plannedNeeds: Record<UltimaGroupKey, number>;
  let plannedAllocation = { taskTotal: 0, spendTotal: 0 };
  let usedTaskLimit = 0;
  let usedSpendLimit = 0;
  if (replanSelectedEvents) {
    resetVariablePointsForEvents(plannedState, selectedEvents);
    plannedNeeds = getNeedsAfterFixedPoints(plannedState);
    plannedAllocation = allocateVariablePoints(
      plannedState,
      selectedEvents,
      plannedNeeds,
      taskLimit,
      spendLimit,
    );
    usedTaskLimit = plannedAllocation.taskTotal;
    usedSpendLimit = plannedAllocation.spendTotal;
  } else {
    plannedNeeds = getNeedsAfterCurrentPlan(plannedState);
    const currentTotals = getCurrentPlannedVariableTotals(plannedState);
    usedTaskLimit = currentTotals.task;
    usedSpendLimit = currentTotals.spend;
  }

  if (totalNeeds(plannedNeeds) <= 0) {
    return {
      state: plannedState,
      result: {
        status: 'planned',
        message: `已规划 ${selectedEvents.length} 场，任务行动 ${plannedAllocation.taskTotal}pt，消费 ${plannedAllocation.spendTotal}pt（约 ¥${plannedAllocation.spendTotal * ULTIMA_YUAN_PER_POINT}）`,
        taskTotal: plannedAllocation.taskTotal,
        spendTotal: plannedAllocation.spendTotal,
        remainingTotal: 0,
        addedEventCount: 0,
      },
    };
  }

  if (!includeUnplannedEvents) {
    const remainingTotal = totalNeeds(plannedNeeds);
    return {
      state: plannedState,
      result: {
        status: 'limited',
        message: `已规划 ${selectedEvents.length} 场，仍差 ${remainingTotal}pt。可使用自动添加活动补足`,
        taskTotal: plannedAllocation.taskTotal,
        spendTotal: plannedAllocation.spendTotal,
        remainingTotal,
        addedEventCount: 0,
      },
    };
  }

  const candidateEvents = ULTIMA_TIMETREE_EVENTS.filter((event) => {
    const plan = getUltimaEventPlan(state, event.id);
    return !plan.planned && !plan.attended && !isUltimaEventExpired(event, options.today);
  });
  const availableTaskLimit = taskLimit === Infinity ? Infinity : Math.max(0, taskLimit - usedTaskLimit);
  const availableSpendLimit = spendLimit === Infinity ? Infinity : Math.max(0, spendLimit - usedSpendLimit);
  const trialState = clonePlannerState(plannedState);
  let trialNeeds = { ...plannedNeeds };
  const addedEvents: UltimaEvent[] = [];
  let addedEventCount = 0;
  let addedAllocation = { taskTotal: 0, spendTotal: 0 };

  for (const event of candidateEvents) {
    const contributingGroupKeys = getEventActiveGroupKeys(trialState, event)
      .filter((groupKey) => trialNeeds[groupKey] > 0);
    if (contributingGroupKeys.length === 0) continue;

    addedEvents.push(event);
    markEventsAsPlanned(trialState, [event]);
    resetVariablePointsForEvents(trialState, addedEvents);
    trialNeeds = getNeedsAfterCurrentPlan(trialState);
    addedAllocation = allocateVariablePoints(
      trialState,
      addedEvents,
      trialNeeds,
      availableTaskLimit,
      availableSpendLimit,
    );
    addedEventCount += 1;

    if (totalNeeds(trialNeeds) <= 0) {
      const taskTotal = usedTaskLimit + addedAllocation.taskTotal;
      const spendTotal = usedSpendLimit + addedAllocation.spendTotal;
      return {
        state: trialState,
        result: {
          status: 'planned',
          message: `已自动加入 ${addedEventCount} 场活动，任务行动 ${taskTotal}pt，消费 ${spendTotal}pt（约 ¥${spendTotal * ULTIMA_YUAN_PER_POINT}）`,
          taskTotal,
          spendTotal,
          remainingTotal: 0,
          addedEventCount,
        },
      };
    }
  }

  return {
    state: plannedState,
    result: {
      status: 'impossible',
      message: `剩余未计划活动不足以完成规划，仍差 ${totalNeeds(plannedNeeds)}pt`,
      taskTotal: plannedAllocation.taskTotal,
      spendTotal: plannedAllocation.spendTotal,
      remainingTotal: totalNeeds(plannedNeeds),
      addedEventCount: 0,
    },
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';

export const STATS_PREFERENCES_STORAGE_KEY = 'ota-log.stats-preferences.v1';

export const STATS_SECTION_TYPES = [
  'activity',
  'activityHeatmap',
  'oshi',
  'spending',
  'perfectEvents',
  'cheki',
] as const;

export type StatsSectionType = (typeof STATS_SECTION_TYPES)[number];

export type StatsSectionConfig = {
  type: StatsSectionType;
  visible: boolean;
};

export type StatsPreferences = {
  sections: StatsSectionConfig[];
  seenSectionTypes: StatsSectionType[];
};

export const STATS_SECTION_LABELS: Record<StatsSectionType, string> = {
  activity: '活动',
  activityHeatmap: '活跃度',
  oshi: '单推',
  spending: '支出',
  perfectEvents: '活动评分',
  cheki: '拍立得',
};

const STATS_SECTION_TYPE_SET = new Set<string>(STATS_SECTION_TYPES);

export function createDefaultStatsSections(): StatsSectionConfig[] {
  return STATS_SECTION_TYPES.map((type) => ({ type, visible: true }));
}

export function createDefaultStatsPreferences(): StatsPreferences {
  return {
    sections: createDefaultStatsSections(),
    seenSectionTypes: [...STATS_SECTION_TYPES],
  };
}

export function isStatsSectionType(value: unknown): value is StatsSectionType {
  return typeof value === 'string' && STATS_SECTION_TYPE_SET.has(value);
}

export function sanitizeStatsPreferences(value: unknown): StatsPreferences {
  if (!value || typeof value !== 'object' || !('sections' in value) || !Array.isArray(value.sections)) {
    return createDefaultStatsPreferences();
  }

  const sections: StatsSectionConfig[] = [];
  const configuredTypes = new Set<StatsSectionType>();

  value.sections.forEach((item) => {
    if (!item || typeof item !== 'object' || !('type' in item) || !isStatsSectionType(item.type)) return;
    if (configuredTypes.has(item.type)) return;

    configuredTypes.add(item.type);
    sections.push({
      type: item.type,
      visible: 'visible' in item && typeof item.visible === 'boolean' ? item.visible : true,
    });
  });

  const storedSeenTypes = 'seenSectionTypes' in value && Array.isArray(value.seenSectionTypes)
    ? value.seenSectionTypes.filter(isStatsSectionType)
    : [];
  const seenTypes = new Set<StatsSectionType>([...storedSeenTypes, ...configuredTypes]);

  STATS_SECTION_TYPES.forEach((type) => {
    if (!configuredTypes.has(type)) {
      sections.push({ type, visible: false });
    }
  });

  return {
    sections,
    seenSectionTypes: STATS_SECTION_TYPES.filter((type) => seenTypes.has(type)),
  };
}

export function getUnseenStatsSectionTypes(preferences: StatsPreferences): StatsSectionType[] {
  const seenTypes = new Set(preferences.seenSectionTypes);
  return STATS_SECTION_TYPES.filter((type) => !seenTypes.has(type));
}

export function markStatsSectionsSeen(
  preferences: StatsPreferences,
  sectionTypes: readonly StatsSectionType[] = STATS_SECTION_TYPES,
): StatsPreferences {
  const seenTypes = new Set(preferences.seenSectionTypes);
  sectionTypes.forEach((type) => seenTypes.add(type));
  return {
    sections: preferences.sections,
    seenSectionTypes: STATS_SECTION_TYPES.filter((type) => seenTypes.has(type)),
  };
}

export async function loadStatsPreferences(): Promise<StatsPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STATS_PREFERENCES_STORAGE_KEY);
    if (!raw) return createDefaultStatsPreferences();
    return sanitizeStatsPreferences(JSON.parse(raw));
  } catch {
    return createDefaultStatsPreferences();
  }
}

export async function saveStatsPreferences(preferences: StatsPreferences): Promise<void> {
  await AsyncStorage.setItem(
    STATS_PREFERENCES_STORAGE_KEY,
    JSON.stringify(sanitizeStatsPreferences(preferences)),
  );
}

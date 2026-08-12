import type { StatsDateRange } from './statsDateRange';

export function createStatsRangeSessionStore() {
  let currentRange: StatsDateRange | null = null;
  let customRange: StatsDateRange | null = null;

  return {
    getCurrent(): StatsDateRange | null {
      return currentRange;
    },
    getCustom(): StatsDateRange | null {
      return customRange;
    },
    rememberApplied(range: StatsDateRange): void {
      currentRange = range;
      if (range.preset === 'custom') customRange = range;
    },
    rememberCustom(range: StatsDateRange): void {
      if (range.preset === 'custom') customRange = range;
    },
  };
}

export const statsRangeSession = createStatsRangeSessionStore();

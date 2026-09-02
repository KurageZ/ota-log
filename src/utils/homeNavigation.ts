export function createHomeMonthStatsRoute() {
  return {
    pathname: '/stats' as const,
    params: {
      preset: 'month' as const,
    },
  };
}

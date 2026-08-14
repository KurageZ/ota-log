export type CalendarGridWeekStart = 0 | 1;

export function monthGridLeadingBlankCount(
  year: number,
  month: number,
  weekStart: CalendarGridWeekStart,
): number {
  const firstDay = new Date(year, month - 1, 1).getDay();
  return (firstDay - weekStart + 7) % 7;
}

export function reorderWeekdayLabels(
  labels: readonly string[],
  weekStart: CalendarGridWeekStart,
): string[] {
  return [...labels.slice(weekStart), ...labels.slice(0, weekStart)];
}

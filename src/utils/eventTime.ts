export function formatEventTimes(
  openTime?: string | null,
  startTime?: string | null,
): string | null {
  const parts = [
    openTime ? `开场 ${openTime}` : null,
    startTime ? `开演 ${startTime}` : null,
  ].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

import { Event } from '../types/models';

export type EventMonthSection = {
  key: string;
  title: string;
  data: Event[];
};

export function buildEventMonthSections(events: Event[]): EventMonthSection[] {
  const buckets: Record<string, Event[]> = {};

  for (const event of events) {
    const key = event.event_date.slice(0, 7);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(event);
  }

  return Object.keys(buckets)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      key,
      title: key,
      data: buckets[key].sort((a, b) => {
        const dateCompare = b.event_date.localeCompare(a.event_date);
        if (dateCompare !== 0) return dateCompare;
        return (b.event_time ?? '').localeCompare(a.event_time ?? '');
      }),
    }));
}

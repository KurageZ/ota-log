import type { Event } from '../types/models';
import { toISODate } from './date';

export interface CurrentEventReader {
  findAll(status?: 'planned'): Promise<Event[]>;
  reconcileExpiredPlanned(today: string): Promise<number>;
}

function compareCreated(a: Event, b: Event): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

function compareOnDate(a: Event, b: Event): number {
  if (a.event_time == null && b.event_time != null) return -1;
  if (a.event_time != null && b.event_time == null) return 1;
  return (a.event_time ?? '').localeCompare(b.event_time ?? '') || compareCreated(a, b);
}

/** Selects the event shown by both the home dashboard and the iOS widget. */
export function selectCurrentPlannedEvent(events: Event[], now: Date): Event | null {
  const today = toISODate(now);
  const upcoming = events.filter((event) => event.status === 'planned' && event.event_date >= today);
  if (upcoming.length === 0) return null;

  const firstDate = upcoming.reduce((date, event) => event.event_date < date ? event.event_date : date, upcoming[0].event_date);
  const sameDate = upcoming.filter((event) => event.event_date === firstDate).sort(compareOnDate);
  if (firstDate > today) return sameDate[0] ?? null;

  const untimed = sameDate.filter((event) => event.event_time == null).sort(compareCreated);
  const timed = sameDate.filter((event): event is Event & { event_time: string } => event.event_time != null);
  const started = timed.filter((event) => event.event_time <= now.toTimeString().slice(0, 5));
  if (started.length > 0) {
    const latestStart = started.reduce((time, event) => event.event_time > time ? event.event_time : time, started[0].event_time);
    return started.filter((event) => event.event_time === latestStart).sort(compareCreated)[0] ?? null;
  }
  return untimed[0] ?? timed.sort((a, b) => a.event_time.localeCompare(b.event_time) || compareCreated(a, b))[0] ?? null;
}

export async function synchronizeCurrentEvent(reader: CurrentEventReader, now = new Date()): Promise<Event | null> {
  const today = toISODate(now);
  await reader.reconcileExpiredPlanned(today);
  return selectCurrentPlannedEvent(await reader.findAll('planned'), now);
}

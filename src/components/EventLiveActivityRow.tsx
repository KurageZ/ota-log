import type { Artist, Event, EventSession, EventTimetableEntry } from '../types/models';

export function EventLiveActivityRow(_props: {
  event: Event;
  sessions: EventSession[];
  timetables: Record<string, EventTimetableEntry[]>;
  artists: Artist[];
  eventImageUri?: string;
}) {
  return null;
}

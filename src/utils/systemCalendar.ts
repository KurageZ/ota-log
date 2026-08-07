import * as Calendar from 'expo-calendar/legacy';
import type { Event, EventSession } from '../types/models';

export type SystemCalendarEventPayload = Parameters<typeof Calendar.createEventInCalendarAsync>[0];
export type SystemCalendarApi = Pick<
  typeof Calendar,
  'requestCalendarPermissionsAsync' | 'createEventInCalendarAsync'
>;

function parseLocalDate(date: string, time?: string | null) {
  const [year, month, day] = date.split('-').map(Number);
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }
  return new Date(year, month - 1, day);
}

export function buildEventSessionCalendarPayload(
  event: Event,
  session: EventSession,
): SystemCalendarEventPayload {
  const calendarStartTime = session.start_time ?? session.open_time;
  const hasTime = typeof calendarStartTime === 'string' && /^\d{2}:\d{2}$/.test(calendarStartTime);
  const location = [session.venue, session.city].filter(Boolean).join(' · ') || undefined;
  const notes = [
    event.notes ? `备注：${event.notes}` : null,
    event.url ? `链接：${event.url}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  if (!hasTime) {
    const startDate = parseLocalDate(session.session_date);
    const endDate = parseLocalDate(session.end_date ?? session.session_date);
    endDate.setDate(endDate.getDate() + 1);
    return {
      title: session.title ? `${event.title} · ${session.title}` : event.title,
      startDate,
      endDate,
      allDay: true,
      location,
      notes,
      url: event.url ?? undefined,
    };
  }

  const startDate = parseLocalDate(session.session_date, calendarStartTime);
  let endDate = session.end_time
    ? parseLocalDate(session.end_date ?? session.session_date, session.end_time)
    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  if (session.end_time && !session.end_date && endDate <= startDate) {
    endDate = new Date(endDate);
    endDate.setDate(endDate.getDate() + 1);
  }

  return {
    title: session.title ? `${event.title} · ${session.title}` : event.title,
    startDate,
    endDate,
    allDay: false,
    location,
    notes,
    url: event.url ?? undefined,
  };
}

export async function addEventToSystemCalendar(
  payload: SystemCalendarEventPayload,
  calendarApi: SystemCalendarApi = Calendar,
) {
  const permission = await calendarApi.requestCalendarPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('未获得系统日历权限');
  }

  return calendarApi.createEventInCalendarAsync(payload);
}

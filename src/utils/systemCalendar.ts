import * as Calendar from 'expo-calendar/legacy';

export type SystemCalendarEventPayload = Parameters<typeof Calendar.createEventInCalendarAsync>[0];
export type SystemCalendarApi = Pick<
  typeof Calendar,
  'requestCalendarPermissionsAsync' | 'createEventInCalendarAsync'
>;

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

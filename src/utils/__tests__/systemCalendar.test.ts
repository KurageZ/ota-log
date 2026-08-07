import type { Event, EventSession } from '../../types/models';
import {
  addEventToSystemCalendar,
  buildEventSessionCalendarPayload,
} from '../systemCalendar';

const event: Event = {
  id: 'event-1',
  title: '演出',
  event_type: 'livehouse',
  actual_expense: null,
  event_date: '2026-09-12',
  event_time: '17:30',
  open_time: '17:30',
  start_time: null,
  end_time: null,
  city: '上海',
  venue: 'Live House',
  ticket_price: null,
  status: 'planned',
  review_score: null,
  notes: null,
  details: null,
  url: null,
  setlist_text: null,
  trip_id: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

const session: EventSession = {
  id: 'session-1',
  event_id: event.id,
  title: null,
  session_date: event.event_date,
  end_date: null,
  open_time: '17:30',
  start_time: null,
  end_time: '20:00',
  city: event.city,
  venue: event.venue,
  sort_order: 0,
  created_at: event.created_at,
  updated_at: event.updated_at,
};

describe('addEventToSystemCalendar', () => {
  test('requests calendar permission before creating an event', async () => {
    const requestCalendarPermissionsAsync = jest.fn().mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    const createEventInCalendarAsync = jest.fn().mockResolvedValue({ action: 'done' });
    const payload = { title: '演出', startDate: new Date(), endDate: new Date() };

    await addEventToSystemCalendar(payload, {
      requestCalendarPermissionsAsync,
      createEventInCalendarAsync,
    });

    expect(requestCalendarPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(createEventInCalendarAsync).toHaveBeenCalledWith(payload);
    expect(requestCalendarPermissionsAsync.mock.invocationCallOrder[0])
      .toBeLessThan(createEventInCalendarAsync.mock.invocationCallOrder[0]);
  });

  test('does not create an event when permission is denied', async () => {
    const requestCalendarPermissionsAsync = jest.fn().mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const createEventInCalendarAsync = jest.fn();

    await expect(addEventToSystemCalendar(
      { title: '演出' },
      { requestCalendarPermissionsAsync, createEventInCalendarAsync },
    )).rejects.toThrow('未获得系统日历权限');

    expect(createEventInCalendarAsync).not.toHaveBeenCalled();
  });
});

describe('buildEventSessionCalendarPayload', () => {
  test('creates a timed event when a migrated session only has an opening time', () => {
    const payload = buildEventSessionCalendarPayload(event, session);

    expect(payload).toEqual(expect.objectContaining({
      allDay: false,
      startDate: new Date(2026, 8, 12, 17, 30),
      endDate: new Date(2026, 8, 12, 20, 0),
    }));
  });
});

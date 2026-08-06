import { selectCurrentPlannedEvent } from '../currentEvent';
import type { Event } from '../../types/models';

function event(overrides: Partial<Event>): Event {
  return {
    id: 'event', title: '活动', event_type: 'livehouse', event_date: '2026-07-24', event_time: null,
    city: null, venue: null, ticket_price: null, actual_expense: null, status: 'planned', review_score: null,
    notes: null, details: null, url: null, setlist_text: null, trip_id: null,
    created_at: '2026-07-24T00:00:00.000Z', updated_at: '2026-07-24T00:00:00.000Z', ...overrides,
  };
}

describe('selectCurrentPlannedEvent', () => {
  const beforeFirst = new Date('2026-07-24T09:00:00');

  test('ignores past dates and selects the current same-day event by start boundary', () => {
    const first = event({ id: 'first', event_time: '10:00', created_at: '2026-07-20T00:00:00.000Z' });
    const second = event({ id: 'second', event_time: '18:00', created_at: '2026-07-21T00:00:00.000Z' });
    expect(selectCurrentPlannedEvent([event({ id: 'old', event_date: '2026-07-23' }), first, second], beforeFirst)?.id).toBe('first');
    expect(selectCurrentPlannedEvent([first, second], new Date('2026-07-24T18:00:00'))?.id).toBe('second');
  });

  test('keeps the earliest-created untimed event before timed events begin', () => {
    const untimed = event({ id: 'untimed', created_at: '2026-07-20T00:00:00.000Z' });
    const laterUntimed = event({ id: 'later', created_at: '2026-07-21T00:00:00.000Z' });
    const timed = event({ id: 'timed', event_time: '10:00' });
    expect(selectCurrentPlannedEvent([laterUntimed, timed, untimed], beforeFirst)?.id).toBe('untimed');
  });

  test('uses earliest creation time for equal starts and returns a future date', () => {
    const equalA = event({ id: 'a', event_time: '10:00', created_at: '2026-07-20T00:00:00.000Z' });
    const equalB = event({ id: 'b', event_time: '10:00', created_at: '2026-07-21T00:00:00.000Z' });
    expect(selectCurrentPlannedEvent([equalB, equalA], new Date('2026-07-24T11:00:00'))?.id).toBe('a');
    expect(selectCurrentPlannedEvent([event({ id: 'future', event_date: '2026-07-25' })], beforeFirst)?.id).toBe('future');
  });

  test('returns null when there is no planned event today or later', () => {
    expect(selectCurrentPlannedEvent([event({ event_date: '2026-07-23' }), event({ status: 'completed' })], beforeFirst)).toBeNull();
  });
});

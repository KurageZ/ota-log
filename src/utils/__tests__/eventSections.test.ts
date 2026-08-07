import { Event } from '../../types/models';
import { buildEventMonthSections } from '../eventSections';

function event(input: Pick<Event, 'id' | 'event_date'> & Partial<Event>): Event {
  return {
    title: input.id,
    event_type: 'concert',
    event_time: null,
    open_time: null,
    start_time: null,
    end_time: null,
    city: null,
    venue: null,
    ticket_price: null,
    actual_expense: null,
    status: 'completed',
    review_score: null,
    notes: null,
    details: null,
    url: null,
    setlist_text: null,
    trip_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...input,
  };
}

describe('event sections', () => {
  test('buildEventMonthSections groups events by month in reverse chronological order', () => {
    const sections = buildEventMonthSections([
      event({ id: 'may-early', event_date: '2026-05-01' }),
      event({ id: 'july', event_date: '2026-07-01' }),
      event({ id: 'may-late', event_date: '2026-05-20' }),
    ]);

    expect(sections.map((section) => section.title)).toEqual(['2026-07', '2026-05']);
    expect(sections[1].data.map((item) => item.id)).toEqual(['may-late', 'may-early']);
  });

  test('buildEventMonthSections sorts same-day events by later time first', () => {
    const sections = buildEventMonthSections([
      event({ id: 'no-time', event_date: '2026-07-01' }),
      event({ id: 'evening', event_date: '2026-07-01', event_time: '19:00' }),
      event({ id: 'morning', event_date: '2026-07-01', event_time: '10:00' }),
    ]);

    expect(sections[0].data.map((item) => item.id)).toEqual(['evening', 'morning', 'no-time']);
  });
});

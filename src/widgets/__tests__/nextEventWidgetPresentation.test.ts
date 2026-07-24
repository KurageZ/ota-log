import { createNextEventWidgetProps } from '../nextEventWidgetPresentation';
import type { Event } from '../../types/models';

const base: Event = {
  id: 'event-1', title: '夏日演出', event_type: 'livehouse', event_date: '2026-07-26', event_time: null,
  city: '上海', venue: 'MAO', ticket_price: null, status: 'planned', review_score: null,
  notes: null, details: null, url: null, setlist_text: null, trip_id: null,
  created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
};

describe('createNextEventWidgetProps', () => {
  test('serializes populated, untimed props and deep link', () => {
    expect(createNextEventWidgetProps(base, new Date('2026-07-24T12:00:00'), 'file:///poster.jpg')).toMatchObject({
      eventId: 'event-1', countdown: '2天后', eventTime: null, deepLink: 'otalog:///events/event-1', imageUri: 'file:///poster.jpg',
    });
  });

  test('serializes empty state without a misleading destination', () => {
    expect(createNextEventWidgetProps(null, new Date('2026-07-24T12:00:00'))).toEqual({});
  });
});

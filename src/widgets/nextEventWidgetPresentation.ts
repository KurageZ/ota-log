import type { Event } from '../types/models';
import { toISODate } from '../utils/date';
import type { NextEventWidgetProps } from './NextEventWidget';

export function createNextEventWidgetProps(event: Event | null, now: Date, imageUri?: string): NextEventWidgetProps {
  if (!event) return {};
  const today = toISODate(now);
  const days = Math.round((new Date(`${event.event_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  const countdown = days === 0 ? '今天' : days === 1 ? '明天' : `${days}天后`;
  return {
    eventId: event.id,
    title: event.title,
    eventDate: event.event_date,
    eventTime: event.event_time,
    city: event.city,
    venue: event.venue,
    countdown,
    deepLink: `otalog:///events/${event.id}`,
    imageUri,
  };
}

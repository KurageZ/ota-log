import type { Event, EventSession } from '../types/models';

export interface EventShareSession {
  title: string | null;
  sessionDate: string;
  endDate: string | null;
  openTime: string | null;
  startTime: string | null;
  city: string | null;
  venue: string | null;
}

export interface EventShareAction {
  menuLabel: '复制活动链接' | '复制活动信息';
  toastLabel: '活动链接已复制' | '活动信息已复制';
  text: string;
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveEventShareSessions(
  event: Pick<Event, 'event_date' | 'open_time' | 'start_time' | 'city' | 'venue'>,
  sessions: EventSession[],
): EventShareSession[] {
  if (sessions.length > 0) {
    return sessions.map((session) => ({
      title: clean(session.title),
      sessionDate: session.session_date,
      endDate: clean(session.end_date),
      openTime: clean(session.open_time),
      startTime: clean(session.start_time),
      city: clean(session.city),
      venue: clean(session.venue),
    }));
  }

  return [{
    title: null,
    sessionDate: event.event_date,
    endDate: null,
    openTime: clean(event.open_time),
    startTime: clean(event.start_time),
    city: clean(event.city),
    venue: clean(event.venue),
  }];
}

export function formatEventShareDate(session: EventShareSession): string {
  if (session.endDate && session.endDate !== session.sessionDate) {
    return `${session.sessionDate} 至 ${session.endDate}`;
  }
  return session.sessionDate;
}

export function formatEventShareTime(session: EventShareSession): string {
  const parts = [
    session.openTime ? `OPEN ${session.openTime}` : null,
    session.startTime ? `START ${session.startTime}` : null,
  ].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(' · ') : '时间待定';
}

export function formatEventShareLocation(session: EventShareSession): string {
  return [session.city, session.venue].filter((value): value is string => Boolean(value)).join(' · ')
    || '地点待定';
}

export function formatEventShareSessionDateTime(session: EventShareSession): string {
  return `${formatEventShareDate(session)}  ${formatEventShareTime(session)}`;
}

export function buildEventShareAction(
  event: Pick<Event, 'title' | 'url' | 'event_date' | 'open_time' | 'start_time' | 'city' | 'venue'>,
  sessions: EventSession[],
): EventShareAction {
  const url = clean(event.url);
  if (url) {
    return {
      menuLabel: '复制活动链接',
      toastLabel: '活动链接已复制',
      text: `${event.title.trim()}\n${url}`,
    };
  }

  const sessionText = resolveEventShareSessions(event, sessions)
    .map((session) => [
      formatEventShareSessionDateTime(session),
      formatEventShareLocation(session),
    ].join('\n'))
    .join('\n\n');

  return {
    menuLabel: '复制活动信息',
    toastLabel: '活动信息已复制',
    text: `${event.title.trim()}\n${sessionText}`,
  };
}


import type { Event, EventSession, EventTimetableEntry } from '../../types/models';
import {
  EVENT_LIVE_ACTIVITY_PRESTART_MS,
  type EventLiveActivityProjection,
  type EventLiveActivityProjectionResult,
  type EventTimetablesBySession,
  type TimedTimetableEntry,
} from './types';

const MINUTE_MS = 60 * 1000;
const DEFAULT_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

interface SessionWindow {
  session: EventSession;
  activationAt: number;
  openAt: number | null;
  performanceStartsAt: number;
  endsAt: number;
  usesDefaultEndTime: boolean;
}

function parseLocalDateTime(date: string, time: string | null): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time ?? '')) {
    return null;
  }
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time ?? '').split(':').map(Number);
  if (
    value.getFullYear() !== year
    || value.getMonth() !== month - 1
    || value.getDate() !== day
    || value.getHours() !== hour
    || value.getMinutes() !== minute
  ) {
    return null;
  }
  return value.getTime();
}

function clockMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function resolveTimetableDate(session: EventSession, time: string, sessionStartTime: string): string {
  if (
    session.end_date
    && session.end_date > session.session_date
    && clockMinutes(time) < clockMinutes(sessionStartTime)
  ) {
    return session.end_date;
  }
  return session.session_date;
}

function resolveEntryStart(
  session: EventSession,
  entry: EventTimetableEntry,
  sessionStartTime: string,
): number | null {
  if (!entry.start_time) return null;
  return parseLocalDateTime(
    resolveTimetableDate(session, entry.start_time, sessionStartTime),
    entry.start_time,
  );
}

function resolveEntryExplicitEnd(
  session: EventSession,
  entry: EventTimetableEntry,
  entryStartsAt: number,
  sessionStartTime: string,
): number | null {
  if (!entry.end_time) return null;
  let endAt = parseLocalDateTime(
    resolveTimetableDate(session, entry.end_time, sessionStartTime),
    entry.end_time,
  );
  if (
    endAt != null
    && endAt <= entryStartsAt
    && session.end_date
    && session.end_date > session.session_date
  ) {
    endAt = parseLocalDateTime(session.end_date, entry.end_time);
  }
  return endAt != null && endAt > entryStartsAt ? endAt : null;
}

function latestExplicitTimetableEnd(
  session: EventSession,
  entries: EventTimetableEntry[],
  sessionStartTime: string,
): number | null {
  const values = entries.flatMap((entry) => {
    if (!entry.end_time) return [];
    const value = parseLocalDateTime(
      resolveTimetableDate(session, entry.end_time, sessionStartTime),
      entry.end_time,
    );
    return value == null ? [] : [value];
  });
  return values.length > 0 ? Math.max(...values) : null;
}

function buildSessionWindow(
  session: EventSession,
  entries: EventTimetableEntry[],
): SessionWindow | null {
  const openAt = session.open_time
    ? parseLocalDateTime(session.session_date, session.open_time)
    : null;
  const performanceStartsAt = session.start_time
    ? parseLocalDateTime(session.session_date, session.start_time)
    : openAt;
  if (performanceStartsAt == null) return null;
  const activationAt = openAt != null && openAt <= performanceStartsAt
    ? openAt
    : performanceStartsAt;
  const sessionStartTime = session.start_time ?? session.open_time;
  if (!sessionStartTime) return null;

  const explicitEndDate = session.end_date ?? session.session_date;
  const explicitEndAt = session.end_time
    ? parseLocalDateTime(explicitEndDate, session.end_time)
    : null;
  const inferredEndAt = explicitEndAt ?? latestExplicitTimetableEnd(
    session,
    entries,
    sessionStartTime,
  );
  const nextMidnight = new Date(performanceStartsAt);
  nextMidnight.setHours(24, 0, 0, 0);
  const defaultEndAt = Math.min(
    performanceStartsAt + DEFAULT_SESSION_DURATION_MS,
    nextMidnight.getTime() - 1,
  );
  const endsAt = inferredEndAt ?? defaultEndAt;
  if (endsAt <= performanceStartsAt) return null;
  return {
    session,
    activationAt,
    openAt,
    performanceStartsAt,
    endsAt,
    usesDefaultEndTime: inferredEndAt == null,
  };
}

function buildTimedEntries(
  session: EventSession,
  entries: EventTimetableEntry[],
  sessionStartsAt: number,
  sessionEndsAt: number,
): TimedTimetableEntry[] {
  const sessionStartTime = session.start_time ?? session.open_time;
  if (!sessionStartTime) return [];
  const sorted = entries.flatMap((entry) => {
    const startAt = resolveEntryStart(session, entry, sessionStartTime);
    return startAt == null ? [] : [{ entry, startAt }];
  }).sort((left, right) => (
    left.startAt - right.startAt
    || left.entry.sort_order - right.entry.sort_order
    || left.entry.id.localeCompare(right.entry.id)
  ));

  return sorted.flatMap((item, index) => {
    if (item.startAt < sessionStartsAt || item.startAt >= sessionEndsAt) return [];
    const explicitEnd = resolveEntryExplicitEnd(
      session,
      item.entry,
      item.startAt,
      sessionStartTime,
    );
    const nextStart = sorted.slice(index + 1).find((candidate) => candidate.startAt > item.startAt)?.startAt;
    const endAt = explicitEnd ?? nextStart ?? sessionEndsAt;
    if (endAt <= item.startAt) return [];
    return [{ entry: item.entry, startAt: item.startAt, endAt: Math.min(endAt, sessionEndsAt) }];
  });
}

function chooseSessionWindow(windows: SessionWindow[], nowMs: number): SessionWindow | null {
  const running = windows.filter((window) => window.activationAt <= nowMs && nowMs < window.endsAt)
    .sort((left, right) => (
      right.activationAt - left.activationAt
      || right.session.sort_order - left.session.sort_order
    ));
  if (running.length > 0) return running[0];

  const upcoming = windows.filter((window) => (
    window.activationAt - EVENT_LIVE_ACTIVITY_PRESTART_MS <= nowMs
    && nowMs < window.activationAt
  )).sort((left, right) => (
    left.activationAt - right.activationAt
    || left.session.sort_order - right.session.sort_order
  ));
  return upcoming[0] ?? null;
}

function nextBoundary(
  nowMs: number,
  sessionEndsAt: number,
  timedEntries: TimedTimetableEntry[],
  milestones: Array<number | null>,
): number | null {
  const candidates = [
    sessionEndsAt,
    ...milestones.flatMap((value) => value == null ? [] : [value]),
    ...timedEntries.flatMap((item) => [item.startAt, item.endAt]),
  ].filter((value) => value > nowMs + 250);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

export function projectEventLiveActivity(
  event: Event,
  sessions: EventSession[],
  timetables: EventTimetablesBySession,
  now = new Date(),
): EventLiveActivityProjectionResult {
  if (event.status !== 'planned') {
    return { availability: 'unavailable', reason: 'ineligible-status' };
  }

  const nowMs = now.getTime();
  const windows = sessions.flatMap((session) => {
    const window = buildSessionWindow(session, timetables[session.id] ?? []);
    return window ? [window] : [];
  });
  const chosen = chooseSessionWindow(windows, nowMs);
  if (!chosen) {
    const nextWindow = windows.filter((window) => window.activationAt > nowMs)
      .sort((left, right) => left.activationAt - right.activationAt)[0];
    if (nextWindow) {
      return {
        availability: 'unavailable',
        reason: 'too-early',
        nextEligibleAt: nextWindow.activationAt - EVENT_LIVE_ACTIVITY_PRESTART_MS,
      };
    }
    if (windows.some((window) => window.endsAt <= nowMs)) {
      return { availability: 'unavailable', reason: 'ended' };
    }
    return { availability: 'unavailable', reason: 'missing-time' };
  }

  const phase = nowMs < chosen.performanceStartsAt ? 'upcoming' : 'running';
  const timedEntries = buildTimedEntries(
    chosen.session,
    timetables[chosen.session.id] ?? [],
    chosen.performanceStartsAt,
    chosen.endsAt,
  );
  const currentEntry = phase === 'running'
    ? timedEntries.filter((item) => item.startAt <= nowMs && nowMs < item.endAt)
      .sort((left, right) => (
        right.startAt - left.startAt
        || right.entry.sort_order - left.entry.sort_order
      ))[0] ?? null
    : null;
  const nextEntry = timedEntries.filter((item) => item.startAt > nowMs)
    .sort((left, right) => (
      left.startAt - right.startAt
      || left.entry.sort_order - right.entry.sort_order
    ))[0] ?? null;
  const countsDownToOpening = chosen.openAt != null
    && chosen.openAt < chosen.performanceStartsAt
    && nowMs < chosen.openAt;
  const countdownKind = phase === 'running'
    ? 'ends'
    : countsDownToOpening || !chosen.session.start_time ? 'opens' : 'starts';
  const countdownTargetAt = countdownKind === 'opens'
    ? chosen.openAt ?? chosen.performanceStartsAt
    : countdownKind === 'starts'
      ? chosen.performanceStartsAt
      : currentEntry?.endAt ?? chosen.endsAt;

  const projection: EventLiveActivityProjection = {
    availability: 'available',
    event,
    session: chosen.session,
    phase,
    sessionStartsAt: chosen.performanceStartsAt,
    sessionEndsAt: chosen.endsAt,
    currentEntry,
    nextEntry,
    hasTimedEntries: timedEntries.length > 0,
    usesDefaultEndTime: chosen.usesDefaultEndTime,
    countdownTargetAt,
    countdownKind,
    nextBoundaryAt: nextBoundary(
      nowMs,
      chosen.endsAt,
      timedEntries,
      [chosen.openAt, chosen.performanceStartsAt],
    ),
  };
  return projection;
}

export function formatLiveActivityClock(timestamp: number): string {
  const value = new Date(timestamp);
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function millisecondsUntilLiveActivityBoundary(
  projection: EventLiveActivityProjectionResult,
  now = new Date(),
): number | null {
  if (projection.availability !== 'available' || projection.nextBoundaryAt == null) return null;
  return Math.max(MINUTE_MS / 60, projection.nextBoundaryAt - now.getTime() + 250);
}

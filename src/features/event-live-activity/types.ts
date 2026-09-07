import type { Event, EventSession, EventTimetableEntry } from '../../types/models';

export const EVENT_LIVE_ACTIVITY_PRESTART_MS = 30 * 60 * 1000;
export const EVENT_LIVE_ACTIVITY_MAX_DURATION_MS = 8 * 60 * 60 * 1000;

export type EventLiveActivityUnavailableReason =
  | 'ineligible-status'
  | 'missing-time'
  | 'too-early'
  | 'ended';

export interface EventLiveActivityPalette {
  background: string;
  accent: string;
  text: string;
  textSecondary: string;
}

export interface EventLiveActivityProps {
  phase: 'upcoming' | 'running' | 'ended';
  eventTitle: string;
  sessionTitle?: string;
  upcomingDetails?: string;
  primaryTitle: string;
  currentEntryTitle?: string;
  nextEntryTitle?: string;
  nextEntryInitial?: string;
  nextEntryTime?: string;
  hasTimetable: boolean;
  nextLabel?: string;
  currentArtistAvatarUri?: string;
  nextArtistAvatarUri?: string;
  eventImageUri?: string;
  appIconUri?: string;
  countdownTargetAt?: number;
  countdownKind: 'opens' | 'starts' | 'ends';
  timerStartAt?: number;
  timerMode: 'countdown' | 'elapsed';
  updatedAt: number;
  lightBackground: string;
  darkBackground: string;
  lightAccent: string;
  darkAccent: string;
}

export interface TimedTimetableEntry {
  entry: EventTimetableEntry;
  startAt: number;
  endAt: number;
}

export interface EventLiveActivityProjection {
  availability: 'available';
  event: Event;
  session: EventSession;
  phase: 'upcoming' | 'running';
  sessionStartsAt: number;
  sessionEndsAt: number;
  currentEntry: TimedTimetableEntry | null;
  nextEntry: TimedTimetableEntry | null;
  hasTimedEntries: boolean;
  usesDefaultEndTime: boolean;
  countdownTargetAt: number;
  countdownKind: 'opens' | 'starts' | 'ends';
  nextBoundaryAt: number | null;
}

export interface EventLiveActivityUnavailableProjection {
  availability: 'unavailable';
  reason: EventLiveActivityUnavailableReason;
  nextEligibleAt?: number;
}

export type EventLiveActivityProjectionResult =
  | EventLiveActivityProjection
  | EventLiveActivityUnavailableProjection;

export type EventTimetablesBySession = Record<string, EventTimetableEntry[]>;

export interface EventLiveActivityInput {
  event: Event;
  sessions: EventSession[];
  timetables: EventTimetablesBySession;
  artistAvatarUris?: Record<string, string>;
  eventImageUri?: string;
  lightPalette: EventLiveActivityPalette;
  darkPalette: EventLiveActivityPalette;
}

export type EventLiveActivityControlState =
  | { status: 'active'; sessionId: string }
  | { status: 'closed'; sessionId: string }
  | { status: 'expired'; sessionId: string }
  | { status: 'too-early'; nextEligibleAt: number }
  | { status: 'missing-time' }
  | { status: 'ended' }
  | { status: 'ineligible' }
  | { status: 'unavailable' };

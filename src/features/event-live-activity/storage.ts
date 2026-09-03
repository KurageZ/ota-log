import AsyncStorage from '@react-native-async-storage/async-storage';

export const EVENT_LIVE_ACTIVITY_MARKER_KEY = 'ota_log:event-live-activity-marker:v1';

export interface EventLiveActivityMarker {
  eventId: string;
  sessionId: string;
  startedAt: number;
  effectiveEndAt: number;
  activityExpiresAt: number;
  state: 'active' | 'closed';
}

function isMarker(value: unknown): value is EventLiveActivityMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<EventLiveActivityMarker>;
  return (
    typeof marker.eventId === 'string'
    && typeof marker.sessionId === 'string'
    && typeof marker.startedAt === 'number'
    && Number.isFinite(marker.startedAt)
    && typeof marker.effectiveEndAt === 'number'
    && Number.isFinite(marker.effectiveEndAt)
    && typeof marker.activityExpiresAt === 'number'
    && Number.isFinite(marker.activityExpiresAt)
    && (marker.state === 'active' || marker.state === 'closed')
  );
}

export async function loadEventLiveActivityMarker(): Promise<EventLiveActivityMarker | null> {
  const raw = await AsyncStorage.getItem(EVENT_LIVE_ACTIVITY_MARKER_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMarker(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveEventLiveActivityMarker(
  marker: EventLiveActivityMarker,
): Promise<void> {
  await AsyncStorage.setItem(EVENT_LIVE_ACTIVITY_MARKER_KEY, JSON.stringify(marker));
}

export async function clearEventLiveActivityMarker(): Promise<void> {
  await AsyncStorage.removeItem(EVENT_LIVE_ACTIVITY_MARKER_KEY);
}

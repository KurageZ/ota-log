import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearEventLiveActivityMarker,
  EVENT_LIVE_ACTIVITY_MARKER_KEY,
  loadEventLiveActivityMarker,
  saveEventLiveActivityMarker,
} from '../storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('event live activity storage', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockReset();
    mockedStorage.setItem.mockReset();
    mockedStorage.removeItem.mockReset();
  });

  test('round-trips a valid marker', async () => {
    const marker = {
      eventId: 'event-1', sessionId: 'session-1', startedAt: 1,
      effectiveEndAt: 2, activityExpiresAt: 3, state: 'active' as const,
    };
    await saveEventLiveActivityMarker(marker);
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      EVENT_LIVE_ACTIVITY_MARKER_KEY,
      JSON.stringify(marker),
    );
  });

  test('ignores malformed persisted values', async () => {
    mockedStorage.getItem.mockResolvedValueOnce('{bad json');
    await expect(loadEventLiveActivityMarker()).resolves.toBeNull();
    mockedStorage.getItem.mockResolvedValueOnce(JSON.stringify({ eventId: 'event-1' }));
    await expect(loadEventLiveActivityMarker()).resolves.toBeNull();
  });

  test('clears the marker key', async () => {
    await clearEventLiveActivityMarker();
    expect(mockedStorage.removeItem).toHaveBeenCalledWith(EVENT_LIVE_ACTIVITY_MARKER_KEY);
  });
});

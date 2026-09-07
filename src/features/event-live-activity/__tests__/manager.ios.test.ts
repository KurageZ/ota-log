import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event, EventSession, EventTimetableEntry } from '../../../types/models';
import { EventLiveActivity } from '../EventLiveActivity';
import { closeEventLiveActivity, ensureEventLiveActivity } from '../manager.ios';
import { EVENT_LIVE_ACTIVITY_MARKER_KEY } from '../storage';
import type { EventLiveActivityInput } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-widgets', () => ({
  after: (date: Date) => ({ after: date }),
}));

jest.mock('../EventLiveActivity', () => ({
  EventLiveActivity: {
    getInstances: jest.fn(),
    start: jest.fn(),
  },
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const activity = EventLiveActivity as jest.Mocked<typeof EventLiveActivity>;
const instance = { update: jest.fn(), end: jest.fn() };

const event: Event = {
  id: 'event-1', title: '测试活动', event_type: 'concert', actual_expense: null,
  event_date: '2026-09-01', event_time: '18:00', open_time: '17:30', start_time: '18:00',
  end_time: '21:00', city: '上海', venue: '测试场馆', ticket_price: null,
  status: 'planned', review_score: null, notes: null, details: null, url: null,
  setlist_text: null, trip_id: null, created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
const session: EventSession = {
  id: 'session-1', event_id: event.id, title: '夜场', session_date: '2026-09-01',
  end_date: null, open_time: '17:30', start_time: '18:00', end_time: '21:00',
  city: '上海', venue: '测试场馆', sort_order: 0,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};
const input: EventLiveActivityInput = {
  event,
  sessions: [session],
  timetables: { 'session-1': [] },
  lightPalette: { background: '#fff', accent: '#7c3aed', text: '#111', textSecondary: '#666' },
  darkPalette: { background: '#111', accent: '#a78bfa', text: '#fff', textSecondary: '#aaa' },
};

function timetableEntry(
  id: string,
  title: string,
  startTime: string,
  endTime: string,
  sortOrder: number,
): EventTimetableEntry {
  return {
    id,
    session_id: session.id,
    title,
    artist_id: null,
    start_time: startTime,
    end_time: endTime,
    notes: null,
    sort_order: sortOrder,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('event Live Activity manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue();
    storage.removeItem.mockResolvedValue();
    (activity.getInstances as jest.Mock).mockReturnValue([]);
    (activity.start as jest.Mock).mockReturnValue(instance);
    instance.update.mockResolvedValue(undefined);
    instance.end.mockResolvedValue(undefined);
  });

  test('starts and persists a single eligible activity', async () => {
    const now = new Date('2026-09-01T18:30:00');
    await expect(ensureEventLiveActivity(input, { now })).resolves.toEqual({
      status: 'active', sessionId: 'session-1',
    });
    expect(activity.start).toHaveBeenCalledTimes(1);
    expect(activity.start).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTitle: '测试活动',
        sessionTitle: '夜场',
        primaryTitle: '测试活动',
        hasTimetable: false,
        timerMode: 'countdown',
        countdownKind: 'ends',
      }),
      'otalog:///events/event-1',
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      EVENT_LIVE_ACTIVITY_MARKER_KEY,
      expect.stringContaining('"state":"active"'),
    );
  });

  test('counts down to the start when an upcoming session uses a default end time', async () => {
    await ensureEventLiveActivity({
      ...input,
      sessions: [{ ...session, end_time: null }],
    }, { now: new Date('2026-09-01T17:45:00') });

    expect(activity.start).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'upcoming',
        upcomingDetails: '测试场馆 · 开演 18:00',
        countdownTargetAt: new Date('2026-09-01T18:00:00').getTime(),
        countdownKind: 'starts',
        timerMode: 'countdown',
        timerStartAt: undefined,
      }),
      'otalog:///events/event-1',
    );
  });

  test('passes the next timetable entry and its fallback initial to the expanded view', async () => {
    await ensureEventLiveActivity({
      ...input,
      timetables: {
        'session-1': [
          timetableEntry('current', '星空舞台', '18:00', '19:00', 0),
          timetableEntry('next', '特典会', '19:00', '20:00', 1),
        ],
      },
    }, { now: new Date('2026-09-01T18:30:00') });

    expect(activity.start).toHaveBeenCalledWith(
      expect.objectContaining({
        currentEntryTitle: '星空舞台',
        nextEntryTitle: '特典会',
        nextEntryInitial: '特',
        nextEntryTime: '19:00',
      }),
      'otalog:///events/event-1',
    );
  });

  test('keeps the ActivityKit content state below the 4 KB payload limit', async () => {
    const longText = '长'.repeat(700);
    const oversizedInput: EventLiveActivityInput = {
      ...input,
      sessions: [{ ...session, title: longText }],
    };

    await ensureEventLiveActivity(oversizedInput, {
      now: new Date('2026-09-01T18:30:00'),
    });

    const props = (activity.start as jest.Mock).mock.calls[0][0];
    const encodedState = JSON.stringify({
      name: 'EventLiveActivity',
      props: JSON.stringify(props),
    });
    expect(Buffer.byteLength(encodedState, 'utf8')).toBeLessThan(4_096);
  });

  test('does not silently restart a removed instance for the same session', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({
      eventId: 'event-1', sessionId: 'session-1',
      startedAt: new Date('2026-09-01T18:00:00').getTime(),
      effectiveEndAt: new Date('2026-09-01T21:00:00').getTime(),
      activityExpiresAt: new Date('2026-09-01T21:00:00').getTime(),
      state: 'active',
    }));
    await expect(ensureEventLiveActivity(input, {
      now: new Date('2026-09-01T18:30:00'),
    })).resolves.toEqual({ status: 'closed', sessionId: 'session-1' });
    expect(activity.start).not.toHaveBeenCalled();
  });

  test('reopens only after an explicit force request', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({
      eventId: 'event-1', sessionId: 'session-1',
      startedAt: new Date('2026-09-01T18:00:00').getTime(),
      effectiveEndAt: new Date('2026-09-01T21:00:00').getTime(),
      activityExpiresAt: new Date('2026-09-01T21:00:00').getTime(),
      state: 'closed',
    }));
    await expect(ensureEventLiveActivity(input, {
      force: true,
      now: new Date('2026-09-01T18:30:00'),
    })).resolves.toEqual({ status: 'active', sessionId: 'session-1' });
    expect(activity.start).toHaveBeenCalledTimes(1);
  });

  test('closes immediately and persists suppression for the session', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({
      eventId: 'event-1', sessionId: 'session-1',
      startedAt: new Date('2026-09-01T18:00:00').getTime(),
      effectiveEndAt: new Date('2026-09-01T21:00:00').getTime(),
      activityExpiresAt: new Date('2026-09-01T21:00:00').getTime(),
      state: 'active',
    }));
    (activity.getInstances as jest.Mock).mockReturnValue([instance]);
    await expect(closeEventLiveActivity(input, new Date('2026-09-01T18:30:00')))
      .resolves.toEqual({ status: 'closed', sessionId: 'session-1' });
    expect(instance.end).toHaveBeenCalledWith('immediate');
    expect(storage.setItem).toHaveBeenCalledWith(
      EVENT_LIVE_ACTIVITY_MARKER_KEY,
      expect.stringContaining('"state":"closed"'),
    );
  });

  test('does not close the active instance for a different event', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify({
      eventId: 'event-2', sessionId: 'session-2',
      startedAt: new Date('2026-09-01T18:00:00').getTime(),
      effectiveEndAt: new Date('2026-09-01T21:00:00').getTime(),
      activityExpiresAt: new Date('2026-09-01T21:00:00').getTime(),
      state: 'active',
    }));
    (activity.getInstances as jest.Mock).mockReturnValue([instance]);

    await expect(closeEventLiveActivity(input, new Date('2026-09-01T18:30:00')))
      .resolves.toEqual({ status: 'unavailable' });
    expect(instance.end).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});

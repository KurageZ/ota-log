import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { Artist, Event, EventSession } from '../../types/models';
import type { EventLiveActivityControlState } from '../../features/event-live-activity/types';
import { EventLiveActivityRow } from '../EventLiveActivityRow.ios';

let mockFocusEffect: (() => void | (() => void)) | undefined;

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockFocusEffect = effect;
    return jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

jest.mock('../../features/event-live-activity/manager', () => ({
  ensureEventLiveActivity: jest.fn(),
  closeEventLiveActivity: jest.fn(),
}));

jest.mock('../../features/event-live-activity/palette', () => ({
  createEventLiveActivityPalettes: () => ({
    lightPalette: { background: '#fff', accent: '#7c3aed', text: '#111', textSecondary: '#666' },
    darkPalette: { background: '#111', accent: '#a78bfa', text: '#fff', textSecondary: '#aaa' },
  }),
}));

jest.mock('../../features/event-live-activity/projection', () => ({
  projectEventLiveActivity: () => ({ availability: 'unavailable', reason: 'ended' }),
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    themeId: 'light',
    colors: {
      accent: '#7c3aed', accentSoft: '#ede9fe', danger: '#dc2626', divider: '#e5e7eb',
      text: '#111827', textSecondary: '#6b7280',
    },
  }),
}));

jest.mock('../../utils/haptics', () => ({
  hapticError: jest.fn(),
  hapticToggle: jest.fn(),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));

const {
  ensureEventLiveActivity: mockEnsure,
  closeEventLiveActivity: mockClose,
} = jest.requireMock('../../features/event-live-activity/manager') as {
  ensureEventLiveActivity: jest.Mock;
  closeEventLiveActivity: jest.Mock;
};

const event = {
  id: 'event-1',
  title: '测试活动',
  status: 'planned',
} as Event;
const session = { id: 'session-1', event_id: event.id, title: '夜场' } as EventSession;

describe('EventLiveActivityRow', () => {
  let renderer: ReactTestRenderer | undefined;

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
    jest.clearAllMocks();
  });

  async function renderRow(state: EventLiveActivityControlState) {
    mockEnsure.mockResolvedValue(state);
    await act(async () => {
      renderer = create(
        <EventLiveActivityRow
          event={event}
          sessions={[session]}
          timetables={{ 'session-1': [] }}
          artists={[] as Artist[]}
        />,
      );
    });
  }

  test.each<EventLiveActivityControlState>([
    { status: 'too-early', nextEligibleAt: Date.now() + 60_000 },
    { status: 'closed', sessionId: 'session-1' },
    { status: 'expired', sessionId: 'session-1' },
    { status: 'missing-time' },
    { status: 'ended' },
    { status: 'unavailable' },
    { status: 'ineligible' },
  ])('renders nothing for $status state', async (state) => {
    await renderRow(state);
    expect(renderer?.toJSON()).toBeNull();
  });

  test('shows status and close action only while the Live Activity is active', async () => {
    await renderRow({ status: 'active', sessionId: 'session-1' });

    expect(renderer?.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      '实时活动',
      '正在锁屏与灵动岛显示',
      '关闭',
    ]);
    expect(renderer?.root.findByProps({ accessibilityLabel: '关闭实时活动' })).toBeDefined();
  });

  test('disappears immediately after the active Live Activity is closed', async () => {
    mockClose.mockResolvedValue({ status: 'closed', sessionId: 'session-1' });
    await renderRow({ status: 'active', sessionId: 'session-1' });

    await act(async () => {
      renderer?.root.findByProps({ accessibilityLabel: '关闭实时活动' }).props.onPress();
      await Promise.resolve();
    });

    expect(renderer?.toJSON()).toBeNull();
  });

  test('refreshes and clears a stale active state when the screen regains focus', async () => {
    let resolveRefresh: ((state: EventLiveActivityControlState) => void) | undefined;
    const refreshResult = new Promise<EventLiveActivityControlState>((resolve) => {
      resolveRefresh = resolve;
    });
    mockEnsure
      .mockResolvedValueOnce({ status: 'active', sessionId: 'session-1' })
      .mockReturnValueOnce(refreshResult);
    await act(async () => {
      renderer = create(
        <EventLiveActivityRow
          event={event}
          sessions={[session]}
          timetables={{ 'session-1': [] }}
          artists={[] as Artist[]}
        />,
      );
    });
    expect(renderer?.root.findByProps({ accessibilityLabel: '关闭实时活动' })).toBeDefined();

    act(() => {
      mockFocusEffect?.();
    });
    expect(mockEnsure).toHaveBeenCalledTimes(2);
    expect(renderer?.toJSON()).toBeNull();

    await act(async () => {
      resolveRefresh?.({ status: 'closed', sessionId: 'session-1' });
      await refreshResult;
    });
    expect(renderer?.toJSON()).toBeNull();
  });
});

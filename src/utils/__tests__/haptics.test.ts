import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  hapticCopySuccess,
  hapticDragEnd,
  hapticDragReorder,
  hapticDragStart,
  hapticError,
  hapticWarning,
} from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  AndroidHaptics: {
    Confirm: 'confirm',
    Reject: 'reject',
    Gesture_Start: 'gesture-start',
    Gesture_End: 'gesture-end',
    Drag_Start: 'drag-start',
    Segment_Tick: 'segment-tick',
  },
}));

const selectionAsync = Haptics.selectionAsync as jest.Mock;
const impactAsync = Haptics.impactAsync as jest.Mock;
const notificationAsync = Haptics.notificationAsync as jest.Mock;
const performAndroidHapticsAsync = Haptics.performAndroidHapticsAsync as jest.Mock;

function setPlatform(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

describe('haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('iOS', () => {
    beforeEach(() => {
      setPlatform('ios');
    });

    test('drag start uses a selection tick', () => {
      hapticDragStart();
      expect(selectionAsync).toHaveBeenCalledTimes(1);
      expect(performAndroidHapticsAsync).not.toHaveBeenCalled();
    });

    test('drag reorder ticks are deduplicated within the throttle window', () => {
      jest.useFakeTimers();
      hapticDragStart();
      jest.clearAllMocks();

      hapticDragReorder();
      hapticDragReorder();
      hapticDragReorder();
      expect(selectionAsync).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(50);
      hapticDragReorder();
      expect(selectionAsync).toHaveBeenCalledTimes(2);
    });

    test('drag end uses a light impact', () => {
      hapticDragEnd();
      expect(impactAsync).toHaveBeenCalledWith('light');
    });

    test('copy success uses a success notification', () => {
      hapticCopySuccess();
      expect(notificationAsync).toHaveBeenCalledWith('success');
    });

    test('warning and error use the matching notification types', () => {
      hapticWarning();
      expect(notificationAsync).toHaveBeenLastCalledWith('warning');
      hapticError();
      expect(notificationAsync).toHaveBeenLastCalledWith('error');
    });
  });

  describe('Android', () => {
    beforeEach(() => {
      setPlatform('android');
    });

    test('drag start uses the system drag-start feedback', () => {
      hapticDragStart();
      expect(performAndroidHapticsAsync).toHaveBeenCalledWith('drag-start');
      expect(selectionAsync).not.toHaveBeenCalled();
    });

    test('drag reorder uses segment ticks and is deduplicated', () => {
      jest.useFakeTimers();
      hapticDragStart();
      jest.clearAllMocks();

      hapticDragReorder();
      hapticDragReorder();
      expect(performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
      expect(performAndroidHapticsAsync).toHaveBeenCalledWith('segment-tick');

      jest.advanceTimersByTime(50);
      hapticDragReorder();
      expect(performAndroidHapticsAsync).toHaveBeenCalledTimes(2);
    });

    test('drag end uses the system gesture-end feedback', () => {
      hapticDragEnd();
      expect(performAndroidHapticsAsync).toHaveBeenCalledWith('gesture-end');
    });

    test('copy success uses the system confirmation feedback', () => {
      hapticCopySuccess();
      expect(performAndroidHapticsAsync).toHaveBeenCalledWith('confirm');
    });

    test('warning and error use the system rejection feedback', () => {
      hapticWarning();
      expect(performAndroidHapticsAsync).toHaveBeenLastCalledWith('reject');
      hapticError();
      expect(performAndroidHapticsAsync).toHaveBeenLastCalledWith('reject');
    });
  });

  describe('web', () => {
    beforeEach(() => {
      setPlatform('web');
    });

    test('never triggers native haptics', () => {
      hapticDragStart();
      hapticDragReorder();
      hapticDragEnd();
      hapticCopySuccess();
      hapticWarning();
      hapticError();

      expect(selectionAsync).not.toHaveBeenCalled();
      expect(impactAsync).not.toHaveBeenCalled();
      expect(notificationAsync).not.toHaveBeenCalled();
      expect(performAndroidHapticsAsync).not.toHaveBeenCalled();
    });
  });

  test('swallows rejected haptic calls', async () => {
    setPlatform('ios');
    selectionAsync.mockRejectedValueOnce(new Error('haptics unavailable'));

    expect(() => hapticDragStart()).not.toThrow();
    await Promise.resolve();
    expect(selectionAsync).toHaveBeenCalledTimes(1);
  });
});

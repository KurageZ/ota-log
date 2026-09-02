import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Reorder crossing ticks can fire several times within a single frame while a
 * dragged item sweeps across a list. Throttle them so each crossing still
 * feels like a discrete tick instead of a buzz.
 */
const REORDER_TICK_THROTTLE_MS = 50;

let lastReorderTickAt = Number.NEGATIVE_INFINITY;

function runHaptic(trigger: () => Promise<void>): void {
  trigger().catch(() => undefined);
}

/**
 * A drag has just started; the item is "picked up".
 * iOS: selection tick. Android: system drag-start feedback.
 */
export function hapticDragStart(): void {
  lastReorderTickAt = Number.NEGATIVE_INFINITY;
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.selectionAsync());
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Drag_Start));
  }
}

/**
 * The dragged item crossed into another sort position. Deduplicated so it
 * fires at most once per throttle window.
 * iOS: selection tick. Android: list segment tick.
 */
export function hapticDragReorder(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  const now = Date.now();
  if (now - lastReorderTickAt < REORDER_TICK_THROTTLE_MS) return;
  lastReorderTickAt = now;

  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.selectionAsync());
  } else {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick));
  }
}

/**
 * A drag finished and the item actually changed position.
 * iOS: light impact. Android: system gesture-end feedback.
 */
export function hapticDragEnd(): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Gesture_End));
  }
}

/**
 * A copy succeeded.
 * iOS: success notification. Android: system confirmation feedback.
 */
export function hapticCopySuccess(): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
  }
}

/**
 * A favorite was toggled on or off.
 * iOS: selection tick. Android: system toggle feedback matching the direction.
 */
export function hapticFavoriteToggle(nextValue: boolean): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.selectionAsync());
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(
      nextValue ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off,
    ));
  }
}

/**
 * A switch was flipped by the user.
 * iOS: selection tick. Android: system toggle feedback matching the direction.
 */
export function hapticToggle(nextValue: boolean): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.selectionAsync());
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(
      nextValue ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off,
    ));
  }
}

/**
 * A save operation succeeded.
 * iOS: light impact. Android: system confirmation feedback.
 */
export function hapticSaveSuccess(): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
  }
}

/**
 * A destructive action (record, photo, cleanup) actually completed.
 * iOS: medium impact. Android: system confirmation feedback.
 */
export function hapticDeleteSuccess(): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
  }
}

/**
 * A warning-level failure occurred. Use the system warning/rejection feedback,
 * never a heavy impact as a substitute.
 * iOS: warning notification. Android: system rejection feedback.
 */
export function hapticWarning(): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
  }
}

/**
 * An operation failed. Use the system error feedback, never a heavy impact as
 * a substitute.
 * iOS: error notification. Android: system rejection feedback.
 */
export function hapticError(): void {
  if (Platform.OS === 'ios') {
    runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  } else if (Platform.OS === 'android') {
    runHaptic(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
  }
}

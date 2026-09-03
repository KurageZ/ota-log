import type {
  EventLiveActivityControlState,
  EventLiveActivityInput,
  EventLiveActivityPalette,
} from './types';

export async function ensureEventLiveActivity(
  _input: EventLiveActivityInput,
  _options?: { force?: boolean; now?: Date },
): Promise<EventLiveActivityControlState> {
  return { status: 'unavailable' };
}

export async function closeEventLiveActivity(
  _input: EventLiveActivityInput,
  _now?: Date,
): Promise<EventLiveActivityControlState> {
  return { status: 'unavailable' };
}

export async function reconcileEventLiveActivity(
  _repositories: unknown,
  _palettes: { lightPalette: EventLiveActivityPalette; darkPalette: EventLiveActivityPalette },
  _now?: Date,
): Promise<void> {}

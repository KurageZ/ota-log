import type { WidgetTimelineEntry } from 'expo-widgets';
import {
  CHEKI_WIDGET_ROTATION_INTERVAL_MS,
  type ResolvedChekiWidgetGroup,
} from '../types/chekiWidgetGroups';
import type { ChekiPhotoWidgetGroupProps, ChekiPhotoWidgetProps } from './ChekiPhotoWidget';

export { CHEKI_WIDGET_ROTATION_INTERVAL_MS } from '../types/chekiWidgetGroups';
export const CHEKI_WIDGET_TIMELINE_ENTRY_COUNT = 48;

export interface ResolvedChekiWidgetGroupPresentation {
  state: 'content' | 'unconfigured' | 'no_match' | 'unavailable';
  imageUris: string[];
  initialIndex?: number;
  emptyDeepLink: string;
}

function frameForGroup(group: ResolvedChekiWidgetGroupPresentation, index: number): ChekiPhotoWidgetGroupProps {
  if (group.state !== 'content' || group.imageUris.length === 0) return { state: group.state, emptyDeepLink: group.emptyDeepLink };
  const step = index + (group.initialIndex ?? 0);
  const small = step % group.imageUris.length;
  const current = (step * 3) % group.imageUris.length;
  return {
    state: 'content', imageUri: group.imageUris[current], smallImageUri: group.imageUris[small],
    leadingImageUri: group.imageUris.length >= 3 ? group.imageUris[(current + 1) % group.imageUris.length] : undefined,
    trailingImageUri: group.imageUris.length >= 2
      ? group.imageUris[(current + (group.imageUris.length >= 3 ? 2 : 1)) % group.imageUris.length]
      : undefined,
    emptyDeepLink: group.emptyDeepLink,
  };
}

export function createChekiWidgetGroupPresentation(
  group: ResolvedChekiWidgetGroup,
  cachedImageUris: ReadonlyMap<string, string>,
  failedItemIds: ReadonlySet<string>,
  now: Date,
): ResolvedChekiWidgetGroupPresentation {
  const imageUris = group.items.flatMap((item) => {
    const uri = cachedImageUris.get(item.id);
    return uri ? [uri] : [];
  });
  const state: ResolvedChekiWidgetGroupPresentation['state'] = imageUris.length
    ? 'content'
    : group.state === 'unconfigured'
      ? 'unconfigured'
      : group.state === 'unavailable' || group.items.some((item) => failedItemIds.has(item.id))
        ? 'unavailable'
        : group.state === 'no_match'
          ? 'no_match'
          : 'unavailable';
  const anchor = group.rotationAnchorAt ? Date.parse(group.rotationAnchorAt) : now.getTime();
  const initialIndex = imageUris.length
    ? Math.max(0, Math.floor((now.getTime() - anchor) / CHEKI_WIDGET_ROTATION_INTERVAL_MS) % imageUris.length)
    : 0;
  return { state, imageUris, initialIndex, emptyDeepLink: `otalog:///settings/widget/${group.slot}` };
}

export function createChekiPhotoWidgetTimeline(groups: ResolvedChekiWidgetGroupPresentation[], startTime = Date.now()): WidgetTimelineEntry<ChekiPhotoWidgetProps>[] {
  const timelineStart = Math.floor(startTime / CHEKI_WIDGET_ROTATION_INTERVAL_MS) * CHEKI_WIDGET_ROTATION_INTERVAL_MS;
  const normalized = Array.from({ length: 6 }, (_, index) => groups[index] ?? {
    state: 'unconfigured' as const, imageUris: [], emptyDeepLink: `otalog:///settings/widget/${index + 1}`,
  });
  return Array.from({ length: CHEKI_WIDGET_TIMELINE_ENTRY_COUNT }, (_, index) => {
    const frames = normalized.map((group) => frameForGroup(group, index));
    return { date: new Date(timelineStart + index * CHEKI_WIDGET_ROTATION_INTERVAL_MS), props: {
      group1: frames[0], group2: frames[1], group3: frames[2], group4: frames[3], group5: frames[4], group6: frames[5],
    }};
  });
}

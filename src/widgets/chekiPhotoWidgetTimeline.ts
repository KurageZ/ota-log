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
  imageSpans?: number[];
  initialIndex?: number;
  emptyDeepLink: string;
}

function frameForGroup(group: ResolvedChekiWidgetGroupPresentation, index: number): ChekiPhotoWidgetGroupProps {
  if (group.state !== 'content' || group.imageUris.length === 0) return { state: group.state, emptyDeepLink: group.emptyDeepLink };
  const step = index + (group.initialIndex ?? 0);
  const small = step % group.imageUris.length;
  let current = 0;
  let selected: number[] = [];
  for (let batch = 0; batch <= step; batch++) {
    selected = [];
    let used = 0;
    while (selected.length < group.imageUris.length) {
      const next = (current + selected.length) % group.imageUris.length;
      const span = group.imageSpans?.[next] ?? 1;
      if (used + span > 3) break;
      selected.push(next);
      used += span;
    }
    if (batch < step) current = (current + selected.length) % group.imageUris.length;
  }
  const leading = selected.length === 3 ? selected[1] : undefined;
  const trailing = selected.length >= 2 ? selected[selected.length - 1] : undefined;
  return {
    state: 'content', imageUri: group.imageUris[current], smallImageUri: group.imageUris[small],
    imageSpan: group.imageSpans?.[current],
    leadingImageUri: leading === undefined ? undefined : group.imageUris[leading],
    leadingImageSpan: leading === undefined ? undefined : group.imageSpans?.[leading],
    trailingImageUri: trailing === undefined ? undefined : group.imageUris[trailing],
    trailingImageSpan: trailing === undefined ? undefined : group.imageSpans?.[trailing],
    emptyDeepLink: group.emptyDeepLink,
  };
}

export function createChekiWidgetGroupPresentation(
  group: ResolvedChekiWidgetGroup,
  cachedImageUris: ReadonlyMap<string, string>,
  failedItemIds: ReadonlySet<string>,
  now: Date,
): ResolvedChekiWidgetGroupPresentation {
  const imageSpans: number[] = [];
  const imageUris = group.items.flatMap((item) => {
    const uri = cachedImageUris.get(item.id);
    if (!uri) return [];
    imageSpans.push(item.spec === 'five_inch_landscape' ? 2 : 1);
    return [uri];
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
  return { state, imageUris, imageSpans, initialIndex, emptyDeepLink: `otalog:///settings/widget/${group.slot}` };
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

import type { ResolvedChekiWidgetGroup } from '../../types/chekiWidgetGroups';
import {
  CHEKI_WIDGET_ROTATION_INTERVAL_MS,
  CHEKI_WIDGET_TIMELINE_ENTRY_COUNT,
  createChekiPhotoWidgetTimeline,
  createChekiWidgetGroupPresentation,
} from '../chekiPhotoWidgetTimeline';

const group = (imageUris: string[], initialIndex = 0) => ({ state: 'content' as const, imageUris, initialIndex, emptyDeepLink: 'otalog:///cheki' });
describe('createChekiPhotoWidgetTimeline', () => {
  test('advances medium widgets by a three-photo batch and small widgets by one photo', () => {
    const timeline = createChekiPhotoWidgetTimeline([group(['a', 'b', 'c', 'd', 'e', 'f'])], 0);
    expect(timeline).toHaveLength(48);
    expect(timeline[0].props.group1.imageUri).toBe('a');
    expect(timeline[0].props.group1.leadingImageUri).toBe('b');
    expect(timeline[0].props.group1.trailingImageUri).toBe('c');
    expect(timeline[0].props.group1.smallImageUri).toBe('a');
    expect(timeline[1].props.group1.imageUri).toBe('d');
    expect(timeline[1].props.group1.leadingImageUri).toBe('e');
    expect(timeline[1].props.group1.trailingImageUri).toBe('f');
    expect(timeline[1].props.group1.smallImageUri).toBe('b');
    expect(timeline[1].date.getTime() - timeline[0].date.getTime()).toBe(CHEKI_WIDGET_ROTATION_INTERVAL_MS);
  });
  test('keeps one image fixed and does not duplicate a third image', () => {
    const timeline = createChekiPhotoWidgetTimeline([group(['only']), group(['a', 'b'])], 0);
    expect(timeline[0].props.group1).toEqual({ state: 'content', imageUri: 'only', smallImageUri: 'only', emptyDeepLink: 'otalog:///cheki' });
    expect(timeline[0].props.group2.trailingImageUri).toBe('b');
    expect(timeline[0].props.group2.leadingImageUri).toBeUndefined();
  });
  test('renders empty slots and always emits the complete rolling window', () => {
    const timeline = createChekiPhotoWidgetTimeline([], 0);
    expect(timeline).toHaveLength(CHEKI_WIDGET_TIMELINE_ENTRY_COUNT);
    expect(timeline[0].props.group6.state).toBe('unconfigured');
    expect(timeline[0].props.group6.emptyDeepLink).toBe('otalog:///settings/widget/6');
  });

  test('aligns timeline entries to stable half-hour boundaries', () => {
    const tenTwenty = Date.parse('2026-08-25T10:20:00.000Z');
    const timeline = createChekiPhotoWidgetTimeline([group(['a', 'b'])], tenTwenty);
    expect(timeline[0].date.toISOString()).toBe('2026-08-25T10:00:00.000Z');
    expect(timeline[1].date.toISOString()).toBe('2026-08-25T10:30:00.000Z');
  });
});

describe('createChekiWidgetGroupPresentation', () => {
  const resolvedGroup = (overrides: Partial<ResolvedChekiWidgetGroup>): ResolvedChekiWidgetGroup => ({
    slot: 1,
    name: '分组 1',
    sourceType: 'filter',
    state: 'no_match',
    items: [],
    collectionFingerprint: '[]',
    rotationAnchorAt: '2026-08-25T10:00:00.000Z',
    ...overrides,
  });

  test('keeps manual unavailable and filter no-match states independent of other groups failures', () => {
    const failed = new Set(['other-group-item']);
    const now = new Date('2026-08-25T10:20:00.000Z');
    expect(createChekiWidgetGroupPresentation(resolvedGroup({ sourceType: 'manual', state: 'unavailable' }), new Map(), failed, now).state)
      .toBe('unavailable');
    expect(createChekiWidgetGroupPresentation(resolvedGroup({ state: 'no_match' }), new Map(), failed, now).state)
      .toBe('no_match');
  });

  test('marks only the group whose own thumbnail failed as unavailable', () => {
    const item = { spec: 'three_inch_portrait' as const, id: 'item-1', frontPhotoUri: 'file:///one.jpg', date: null, createdAt: '2026-08-25T00:00:00.000Z', sortOrder: 0 };
    const presentation = createChekiWidgetGroupPresentation(
      resolvedGroup({ state: 'content', items: [item] }),
      new Map(),
      new Set(['item-1']),
      new Date('2026-08-25T10:20:00.000Z'),
    );
    expect(presentation.state).toBe('unavailable');
  });
});

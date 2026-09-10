import React from 'react';
import { TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ChekiWidgetGroupSortableGrid } from '../ChekiWidgetGroupSortableGrid';

const mockStyles: (() => { opacity?: number; transform?: { translateX?: number; translateY?: number }[] })[] = [];
const mockReactions: (() => void)[] = [];
const mockFrames: ((event: { timeSincePreviousFrame: number }) => void)[] = [];
const mockScrollTo = jest.fn();
const mockHapticDragEnd = jest.fn();

jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: Function, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const { View, ScrollView } = require('react-native');
  return {
    __esModule: true, default: { View, ScrollView }, ReduceMotion: { System: 'system' },
    useSharedValue: (initial: unknown) => ReactModule.useRef({
      current: initial, get() { return this.current; }, set(value: unknown) { this.current = value; },
    }).current,
    useAnimatedRef: () => ReactModule.useRef(null),
    useAnimatedStyle: (fn: () => any) => { mockStyles.push(fn); return {}; },
    useAnimatedScrollHandler: (fn: Function) => fn,
    useAnimatedReaction: (prepare: Function, react: Function) => {
      mockReactions.push(() => react(prepare(), null));
    },
    useFrameCallback: (fn: (event: { timeSincePreviousFrame: number }) => void) => { mockFrames.push(fn); },
    scrollTo: (...args: unknown[]) => mockScrollTo(...args),
    withSpring: (value: number) => value,
  };
});
jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react');
  return {
    GestureDetector: ({ children, ...props }: { children: React.ReactNode }) => ReactModule.createElement('GestureDetector', props, children),
    Gesture: { Pan: () => {
      const gesture: any = {};
      for (const name of ['activateAfterLongPress', 'onStart', 'onUpdate', 'onFinalize']) {
        gesture[name] = (value: unknown) => { gesture[name + 'Value'] = value; return gesture; };
      }
      return gesture;
    } },
  };
});
jest.mock('../../theme/appTheme', () => ({ useAppTheme: () => ({ colors: { accent: '#f00' } }) }));
jest.mock('../ChekiAlbumThumbnail', () => {
  const ReactModule = require('react');
  return {
    ChekiGridThumbnail: (props: object) => ReactModule.createElement('Thumbnail', props),
    CHEKI_SQUARE_CARD_RADIUS: 12, CHEKI_SQUARE_GRID_GAP: 4,
    useChekiAlbumGridLayout: () => ({ columns: 4, itemWidth: 76, itemHeight: 76 }),
  };
});
jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../../utils/haptics', () => ({ hapticDragEnd: () => mockHapticDragEnd(), hapticDragStart: jest.fn(), hapticDragReorder: jest.fn() }));

const items = [
  { id: 'a', uri: 'file:///a.jpg', spec: 'three_inch_portrait' as const },
  { id: 'b', uri: 'file:///b.jpg', spec: 'five_inch_portrait' as const },
  { id: 'c', uri: 'file:///c.jpg', spec: 'five_inch_landscape' as const },
];

describe('ChekiWidgetGroupSortableGrid', () => {
  let renderer: ReactTestRenderer;
  const onChange = jest.fn();
  const onDragStateChange = jest.fn();
  beforeEach(() => {
    mockStyles.length = 0;
    mockReactions.length = 0;
    mockFrames.length = 0;
    act(() => { renderer = create(<ChekiWidgetGroupSortableGrid itemIds={['a', 'b', 'c']} items={items} onChange={onChange} onDragStateChange={onDragStateChange} />); });
  });
  afterEach(() => { act(() => renderer.unmount()); });

  test('moves a photo onto a five-inch target occupying one square cell', () => {
    const gesture = renderer.root.findAllByType('GestureDetector' as React.ElementType)[0].props.gesture;
    act(() => { gesture.onStartValue({ x: 20, y: 20 }); });
    act(() => {
      gesture.onUpdateValue({ translationX: 80, translationY: 0 });
      mockReactions.forEach((run) => run());
      gesture.onFinalizeValue({}, true);
    });
    expect(onChange).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect(onDragStateChange).toHaveBeenCalledWith(true);
    expect(onDragStateChange).toHaveBeenLastCalledWith(false);
    expect(mockHapticDragEnd).toHaveBeenCalledTimes(1);
    const thumbnails = renderer.root.findAllByType('Thumbnail' as React.ElementType);
    expect(thumbnails.map((node) => node.props.width)).toEqual([76, 76, 76]);
    expect(thumbnails.map((node) => node.props.height)).toEqual([76, 76, 76]);
    expect(thumbnails.every((node) => node.props.variant === 'original')).toBe(true);
  });

  test('surrounding photos move before release and return when the drag is cancelled', () => {
    const gesture = renderer.root.findAllByType('GestureDetector' as React.ElementType)[0].props.gesture;
    act(() => { gesture.onStartValue({ x: 20, y: 20 }); });
    act(() => {
      gesture.onUpdateValue({ translationX: 160, translationY: 0 });
      mockReactions.forEach((run) => run());
    });
    expect(mockStyles.filter((style) => style().transform).slice(-3).map((style) => style().transform![0].translateX)).toEqual([160, 0, 80]);
    expect(onChange).not.toHaveBeenCalled();
    act(() => { gesture.onFinalizeValue({}, false); });
    expect(mockStyles.filter((style) => style().transform).slice(-3).map((style) => style().transform![0].translateX)).toEqual([0, 80, 160]);
    expect(onChange).not.toHaveBeenCalled();
  });

  test.each([false, true])('clears drag state when start and finalize are batched (success=%s)', (success) => {
    const gesture = renderer.root.findAllByType('GestureDetector' as React.ElementType)[0].props.gesture;
    act(() => {
      gesture.onStartValue({ x: 20, y: 20 });
      gesture.onUpdateValue({ translationX: 160, translationY: 0 });
      mockReactions.forEach((run) => run());
      gesture.onFinalizeValue({}, success);
    });
    expect(mockStyles.filter((style) => style().transform).slice(-3).map((style) => style().transform![0].translateX)).toEqual([0, 80, 160]);
    expect(mockStyles.filter((style) => !style().transform).slice(-3).map((style) => style().opacity)).toEqual([0, 0, 0]);
    mockScrollTo.mockClear();
    act(() => { mockFrames[mockFrames.length - 1]({ timeSincePreviousFrame: 16 }); });
    expect(mockScrollTo).not.toHaveBeenCalled();
    expect(onDragStateChange).toHaveBeenLastCalledWith(false);
    if (success) expect(onChange).toHaveBeenCalledWith(['b', 'c', 'a']);
    else expect(onChange).not.toHaveBeenCalled();
  });

  test('cancelled drag keeps the order and unlocks scrolling', () => {
    const gesture = renderer.root.findAllByType('GestureDetector' as React.ElementType)[1].props.gesture;
    act(() => { gesture.onStartValue({ x: 20, y: 20 }); });
    act(() => { gesture.onFinalizeValue({}, false); });
    expect(onChange).not.toHaveBeenCalled();
    expect(onDragStateChange).toHaveBeenLastCalledWith(false);
  });

  test('supports removal and accessible reordering', () => {
    act(() => renderer.root.findAllByType(TouchableOpacity)[1].props.onPress());
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);
    const button = renderer.root.findAll((node) => node.props.accessibilityLabel === '第 3 张拍立得，长按拖动排序' && node.props.onAccessibilityAction)[0];
    act(() => button.props.onAccessibilityAction({ nativeEvent: { actionName: 'moveBackward' } }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c', 'b']);
  });

  test('auto-scrolls a long grid and stops after cancellation', () => {
    const many = Array.from({ length: 48 }, (_, index) => ({ ...items[1], id: String(index) }));
    act(() => renderer.update(<ChekiWidgetGroupSortableGrid itemIds={many.map(({ id }) => id)} items={many} onChange={onChange} />));
    const gesture = renderer.root.findAllByType('GestureDetector' as React.ElementType)[0].props.gesture;
    act(() => { gesture.onStartValue({ x: 20, y: 20 }); });
    act(() => {
      gesture.onUpdateValue({ translationX: 0, translationY: 2000 });
      mockFrames[mockFrames.length - 1]({ timeSincePreviousFrame: 16 });
    });
    expect(mockScrollTo.mock.calls.at(-1)[2]).toBeGreaterThan(0);
    act(() => { gesture.onFinalizeValue({}, false); });
    mockScrollTo.mockClear();
    act(() => { mockFrames[mockFrames.length - 1]({ timeSincePreviousFrame: 16 }); });
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  test('edge scrolling stays within the content bounds', () => {
    const gesture = renderer.root.findAllByType('GestureDetector' as React.ElementType)[0].props.gesture;
    act(() => { gesture.onStartValue({ x: 20, y: 20 }); });
    act(() => {
      gesture.onUpdateValue({ translationX: 0, translationY: 500 });
      mockFrames.forEach((run) => run({ timeSincePreviousFrame: 16 }));
    });
    expect(mockScrollTo).toHaveBeenLastCalledWith(expect.anything(), 0, 0, false);
  });
});

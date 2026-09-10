import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useFrameCallback, useSharedValue, withSpring, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { ChekiSpec } from '../domain/chekiSpec';
import { buildChekiDragFrames, findChekiDragTarget, moveChekiWidgetItem, type ChekiDragFrame } from '../utils/chekiWidgetDragLayout';
import { hapticDragEnd, hapticDragReorder, hapticDragStart } from '../utils/haptics';
import { useAppTheme } from '../theme/appTheme';
import { ChekiGridThumbnail, CHEKI_BARE_THUMBNAIL_RADIUS, CHEKI_GRID_GAP, useChekiAlbumGridLayout } from './ChekiAlbumThumbnail';
import { AppIcon } from './AppIcon';

export type ChekiWidgetSortablePhoto = { id: string; uri: string; spec: ChekiSpec };
type DragState = { index: number; x: number; y: number; startX: number; startY: number; startScroll: number };
const IDLE_DRAG: DragState = { index: -1, x: 0, y: 0, startX: 0, startY: 0, startScroll: 0 };

function SortablePhoto({ item, frame, index, count, drag, target, scrollY, onStart, onFinish, onMove, onRemove }: {
  item: ChekiWidgetSortablePhoto;
  frame: ChekiDragFrame;
  index: number;
  count: number;
  drag: SharedValue<DragState>;
  target: SharedValue<number>;
  scrollY: SharedValue<number>;
  onStart: () => void;
  onFinish: (from: number, to: number) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { colors } = useAppTheme();
  const gesture = Gesture.Pan().activateAfterLongPress(250)
    .onStart((event) => {
      const x = frame.x + event.x;
      const y = frame.y + event.y;
      drag.set({ index, x, y, startX: x, startY: y, startScroll: scrollY.get() });
      scheduleOnRN(onStart);
    })
    .onUpdate((event) => {
      const current = drag.get();
      drag.set({ ...current, x: current.startX + event.translationX, y: current.startY + event.translationY });
    })
    .onFinalize((_event, success) => {
      if (drag.get().index !== index) return;
      scheduleOnRN(onFinish, index, success ? target.get() : index);
      drag.set(IDLE_DRAG);
    });
  const animatedStyle = useAnimatedStyle(() => {
    const current = drag.get();
    const active = current.index === index;
    const spring = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System };
    return {
      zIndex: active ? 2 : 0,
      opacity: active ? 0.85 : 1,
      transform: [
        { translateX: active ? frame.x + current.x - current.startX : withSpring(frame.x, spring) },
        { translateY: active ? frame.y + current.y - current.startY + scrollY.get() - current.startScroll : withSpring(frame.y, spring) },
      ],
    };
  });
  const targetStyle = useAnimatedStyle(() => ({
    opacity: drag.get().index !== -1 && drag.get().index !== index && target.get() === index ? 1 : 0,
  }));
  return (
    <Animated.View style={[{ position: 'absolute', width: frame.width, height: frame.height }, animatedStyle]}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible accessibilityRole="button"
          accessibilityLabel={`第 ${index + 1} 张拍立得，长按拖动排序`}
          accessibilityActions={[
            ...(index > 0 ? [{ name: 'moveBackward', label: '前移' }] : []),
            ...(index < count - 1 ? [{ name: 'moveForward', label: '后移' }] : []),
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'moveBackward') onMove(-1);
            if (event.nativeEvent.actionName === 'moveForward') onMove(1);
          }}
        >
          <ChekiGridThumbnail uri={item.uri} width={frame.width} height={frame.height} colors={colors}
            variant="portrait" spec={item.spec} fiveInchLandscape />
        </Animated.View>
      </GestureDetector>
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', inset: 0, borderWidth: 3, borderColor: colors.accent,
        borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
      }, targetStyle]} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`移除第 ${index + 1} 张拍立得`}
        hitSlop={10} onPress={onRemove} style={{
          position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14,
          alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)',
        }}>
        <AppIcon name="close" size={15} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ChekiWidgetGroupSortableGrid({ itemIds, items, onChange, onDragStateChange }: {
  itemIds: string[];
  items: ChekiWidgetSortablePhoto[];
  onChange: (itemIds: string[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const { columns, itemWidth, itemHeight } = useChekiAlbumGridLayout({
    density: 'medium', availableWidth: Math.max(1, Math.min(measuredWidth ?? width - 32, 960 - 32)),
    availableHeight: height, displayMode: 'portrait',
  });
  const selectedItems = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return itemIds.flatMap((id) => { const item = byId.get(id); return item ? [item] : []; });
  }, [itemIds, items]);
  const frames = useMemo(() => buildChekiDragFrames(selectedItems, columns, itemWidth, itemHeight, CHEKI_GRID_GAP),
    [selectedItems, columns, itemWidth, itemHeight]);
  const contentHeight = frames.length ? frames[frames.length - 1].y + itemHeight : 0;
  const viewportHeight = Math.min(contentHeight, Math.max(280, height * 0.55));
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const drag = useSharedValue<DragState>(IDLE_DRAG);
  const target = useSharedValue(-1);
  const handleScroll = useAnimatedScrollHandler((event) => { scrollY.set(event.contentOffset.y); });

  const dragStateCallback = useRef(onDragStateChange);
  useEffect(() => { dragStateCallback.current = onDragStateChange; }, [onDragStateChange]);
  useEffect(() => () => dragStateCallback.current?.(false), []);
  useAnimatedReaction(() => {
    const current = drag.get();
    return current.index === -1 ? -1 : findChekiDragTarget(frames, current.x, current.y + scrollY.get() - current.startScroll);
  }, (next, previous) => {
    target.set(next);
    if (next !== -1 && previous !== null && previous !== -1 && next !== previous) scheduleOnRN(hapticDragReorder);
  });
  useFrameCallback(({ timeSincePreviousFrame }) => {
    const current = drag.get();
    if (current.index === -1) return;
    const pointerY = current.y - current.startScroll;
    const direction = pointerY < 48 ? -1 : pointerY > viewportHeight - 48 ? 1 : 0;
    if (!direction) return;
    const next = Math.max(0, Math.min(contentHeight - viewportHeight,
      scrollY.get() + direction * 360 * (timeSincePreviousFrame ?? 16) / 1000));
    scrollTo(scrollRef, 0, next, false);
  });
  const start = useCallback(() => {
    setDragging(true);
    onDragStateChange?.(true);
    hapticDragStart();
  }, [onDragStateChange]);
  const finish = useCallback((from: number, to: number) => {
    setDragging(false);
    onDragStateChange?.(false);
    if (from !== to && to >= 0) {
      onChange(moveChekiWidgetItem(itemIds, selectedItems[from].id, selectedItems[to].id));
      hapticDragEnd();
    }
  }, [itemIds, selectedItems, onChange, onDragStateChange]);

  if (!selectedItems.length) return <Text style={{ color: colors.textSecondary, fontSize: 13 }}>暂无可展示的拍立得</Text>;
  return (
    <View onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)} style={{ height: viewportHeight }}>
      <Animated.ScrollView ref={scrollRef} onScroll={handleScroll} scrollEventThrottle={16}
        scrollEnabled={!dragging} nestedScrollEnabled contentContainerStyle={{ height: contentHeight }}>
        {selectedItems.map((item, index) => (
          <SortablePhoto key={item.id} item={item} frame={frames[index]} index={index} count={selectedItems.length}
            drag={drag} target={target} scrollY={scrollY} onStart={start} onFinish={finish}
            onMove={(offset) => finish(index, index + offset)}
            onRemove={() => onChange(itemIds.filter((id) => id !== item.id))} />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

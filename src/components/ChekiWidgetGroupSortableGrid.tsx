import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import {
  GridOrientation,
  GridStrategy,
  SortableGrid,
  SortableGridItem,
  type SortableGridRenderItemProps,
} from 'react-native-reanimated-dnd';
import { orderChekiWidgetItemIds } from '../utils/chekiWidgetGroupOrdering';
import { hapticDragEnd, hapticDragReorder, hapticDragStart } from '../utils/haptics';
import { useAppTheme } from '../theme/appTheme';
import {
  ChekiGridThumbnail,
  CHEKI_BARE_THUMBNAIL_RADIUS,
  CHEKI_GRID_GAP,
  useChekiAlbumGridLayout,
} from './ChekiAlbumThumbnail';
import { AppIcon } from './AppIcon';

export type ChekiWidgetSortablePhoto = { id: string; uri: string };

export function ChekiWidgetGroupSortableGrid({
  itemIds,
  items,
  onChange,
  onDragStateChange,
}: {
  itemIds: string[];
  items: ChekiWidgetSortablePhoto[];
  onChange: (itemIds: string[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const dragDidMoveRef = useRef(false);
  const contentWidth = Math.max(1, Math.min(width, 960) - 32);
  const gridLayout = useChekiAlbumGridLayout({
    density: 'medium',
    availableWidth: contentWidth,
    availableHeight: height,
    displayMode: 'portrait',
  });
  const { columns, itemWidth, itemHeight } = gridLayout;
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const selectedItems = useMemo(() => itemIds.flatMap((id) => {
    const item = itemById.get(id);
    return item ? [item] : [];
  }), [itemById, itemIds]);
  const membershipKey = useMemo(
    () => selectedItems.map((item) => item.id).sort().join('|'),
    [selectedItems],
  );
  const rowCount = Math.ceil(selectedItems.length / columns);
  const contentHeight = rowCount * itemHeight + Math.max(0, rowCount - 1) * CHEKI_GRID_GAP;
  const viewportHeight = Math.min(contentHeight, Math.max(280, height * 0.55));

  useEffect(() => () => onDragStateChange?.(false), [onDragStateChange]);

  const handleDragStart = useCallback(() => {
    dragDidMoveRef.current = false;
    onDragStateChange?.(true);
    hapticDragStart();
  }, [onDragStateChange]);

  const handleMove = useCallback(() => {
    dragDidMoveRef.current = true;
    hapticDragReorder();
  }, []);

  const handleDrop = useCallback((
    _: string,
    __: number,
    positions?: Record<string, { index: number }>,
  ) => {
    const didMove = dragDidMoveRef.current;
    dragDidMoveRef.current = false;
    onDragStateChange?.(false);
    if (didMove) hapticDragEnd();
    if (!positions) return;

    const visibleIds = itemIds.filter((id) => positions[id]);
    const dormantIds = itemIds.filter((id) => !positions[id]);
    onChange(orderChekiWidgetItemIds(visibleIds, positions).concat(dormantIds));
  }, [itemIds, onChange, onDragStateChange]);

  const moveBy = useCallback((id: string, offset: -1 | 1) => {
    const from = itemIds.indexOf(id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= itemIds.length) return;
    const next = [...itemIds];
    next.splice(from, 1);
    next.splice(to, 0, id);
    hapticDragEnd();
    onChange(next);
  }, [itemIds, onChange]);

  const renderItem = useCallback((props: SortableGridRenderItemProps<ChekiWidgetSortablePhoto>) => {
    const { item, id, ...sortableProps } = props;
    const itemIndex = itemIds.indexOf(item.id);
    const accessibilityActions = [
      ...(itemIndex > 0 ? [{ name: 'moveBackward', label: '前移' }] : []),
      ...(itemIndex >= 0 && itemIndex < itemIds.length - 1
        ? [{ name: 'moveForward', label: '后移' }]
        : []),
    ];

    return (
      <SortableGridItem
        key={id}
        id={id}
        data={item}
        {...sortableProps}
        onDragStart={handleDragStart}
        onMove={handleMove}
        onDrop={handleDrop}
        style={{ width: itemWidth, height: itemHeight }}
      >
        <SortableGridItem.Handle style={{ flex: 1 }}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`第 ${itemIndex + 1} 张拍立得，长按拖动排序`}
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'moveBackward') moveBy(item.id, -1);
              if (event.nativeEvent.actionName === 'moveForward') moveBy(item.id, 1);
            }}
            style={{
              flex: 1,
              borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
              overflow: 'hidden',
              backgroundColor: colors.card,
            }}
          >
            <ChekiGridThumbnail
              uri={item.uri}
              width={itemWidth}
              height={itemHeight}
              colors={colors}
              variant="portrait"
            />
          </View>
        </SortableGridItem.Handle>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`移除第 ${itemIndex + 1} 张拍立得`}
          hitSlop={10}
          onPress={() => onChange(itemIds.filter((value) => value !== item.id))}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.62)',
          }}
        >
          <AppIcon name="close" size={15} color="#fff" />
        </TouchableOpacity>
      </SortableGridItem>
    );
  }, [colors, handleDragStart, handleDrop, handleMove, itemHeight, itemIds, itemWidth, moveBy, onChange]);

  if (selectedItems.length === 0) {
    return <Text style={{ color: colors.textSecondary, fontSize: 13 }}>暂无可展示的拍立得</Text>;
  }

  return (
    <View style={{ height: viewportHeight }}>
      <SortableGrid
        key={membershipKey}
        data={selectedItems}
        renderItem={renderItem}
        dimensions={{
          columns,
          itemWidth,
          itemHeight,
          rowGap: CHEKI_GRID_GAP,
          columnGap: CHEKI_GRID_GAP,
        }}
        orientation={GridOrientation.Vertical}
        strategy={GridStrategy.Insert}
        style={{ height: viewportHeight }}
      />
    </View>
  );
}

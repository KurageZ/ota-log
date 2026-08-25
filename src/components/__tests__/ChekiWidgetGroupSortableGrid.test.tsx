import React from 'react';
import { TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ChekiWidgetGroupSortableGrid } from '../ChekiWidgetGroupSortableGrid';

const mockHapticDragEnd = jest.fn();
const mockHapticDragReorder = jest.fn();
const mockHapticDragStart = jest.fn();

jest.mock('react-native-reanimated-dnd', () => {
  const ReactModule = require('react');
  const SortableGridItem = ({ children, ...props }: { children: React.ReactNode }) => (
    ReactModule.createElement('SortableGridItem', props, children)
  );
  SortableGridItem.Handle = ({ children, ...props }: { children: React.ReactNode }) => (
    ReactModule.createElement('SortableGridItemHandle', props, children)
  );
  return {
    GridOrientation: { Vertical: 'vertical' },
    GridStrategy: { Insert: 'insert' },
    SortableGrid: ({ data, renderItem, ...props }: {
      data: Array<{ id: string; uri: string }>;
      renderItem: (props: object) => React.ReactNode;
      dimensions: object;
      orientation: string;
      strategy: string;
      [key: string]: unknown;
    }) => ReactModule.createElement(
      'SortableGrid',
      props,
      data.map((item, index) => renderItem({
        item,
        index,
        id: item.id,
        positions: {},
        scrollY: {},
        scrollX: {},
        autoScrollDirection: {},
        itemsCount: data.length,
        dimensions: props.dimensions,
        orientation: props.orientation,
        strategy: props.strategy,
      })),
    ),
    SortableGridItem,
  };
});

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }) }),
}));

jest.mock('../ChekiAlbumThumbnail', () => ({
  ChekiGridThumbnail: () => null,
  CHEKI_BARE_THUMBNAIL_RADIUS: 8,
  CHEKI_GRID_GAP: 8,
  useChekiAlbumGridLayout: () => ({
    columns: 4,
    itemWidth: 76,
    itemHeight: 121,
    targetRows: 4,
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));

jest.mock('../../utils/haptics', () => ({
  hapticDragEnd: () => mockHapticDragEnd(),
  hapticDragReorder: () => mockHapticDragReorder(),
  hapticDragStart: () => mockHapticDragStart(),
}));

describe('ChekiWidgetGroupSortableGrid', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer.unmount());
  });

  test('emits the final item order when a drag is dropped', () => {
    const onChange = jest.fn();
    act(() => {
      renderer = create(
        <ChekiWidgetGroupSortableGrid
          itemIds={['a', 'b', 'c']}
          items={[
            { id: 'a', uri: 'file:///a.jpg' },
            { id: 'b', uri: 'file:///b.jpg' },
            { id: 'c', uri: 'file:///c.jpg' },
          ]}
          onChange={onChange}
        />,
      );
    });

    const firstItem = renderer.root.findAllByType(
      'SortableGridItem' as React.ElementType,
    )[0];
    act(() => {
      firstItem.props.onDragStart();
      firstItem.props.onMove();
      firstItem.props.onDrop('a', 2, {
        a: { index: 2 },
        b: { index: 0 },
        c: { index: 1 },
      });
    });

    expect(onChange).toHaveBeenCalledWith(['b', 'c', 'a']);
    const grid = renderer.root.findByType('SortableGrid' as React.ElementType);
    expect(grid.props.dimensions).toEqual(expect.objectContaining({
      columns: 4,
      itemWidth: 76,
      itemHeight: 121,
    }));
    expect(mockHapticDragStart).toHaveBeenCalledTimes(1);
    expect(mockHapticDragReorder).toHaveBeenCalledTimes(1);
    expect(mockHapticDragEnd).toHaveBeenCalledTimes(1);
  });

  test('removes an item without leaving the editor', () => {
    const onChange = jest.fn();
    act(() => {
      renderer = create(
        <ChekiWidgetGroupSortableGrid
          itemIds={['a', 'b']}
          items={[
            { id: 'a', uri: 'file:///a.jpg' },
            { id: 'b', uri: 'file:///b.jpg' },
          ]}
          onChange={onChange}
        />,
      );
    });

    const removeSecond = renderer.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '移除第 2 张拍立得',
    );
    expect(removeSecond).toBeDefined();
    act(() => removeSecond?.props.onPress());

    expect(onChange).toHaveBeenCalledWith(['a']);
  });
});

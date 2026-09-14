import React from 'react';
import { FlatList } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ChekiWidgetGroupPreviewGrid } from '../ChekiWidgetGroupPreviewGrid';

const mockUseChekiAlbumGridLayout = jest.fn((_options: object) => ({
  columns: 4,
  itemWidth: 80,
  itemHeight: 128,
  targetRows: 4,
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({ colors: {} }),
}));

jest.mock('../ChekiAlbumThumbnail', () => {
  const ReactModule = require('react');
  return {
    CHEKI_GRID_GAP: 8,
    ChekiGridThumbnail: (props: object) => ReactModule.createElement('ChekiGridThumbnail', props),
    useChekiAlbumGridLayout: (options: object) => mockUseChekiAlbumGridLayout(options),
  };
});

describe('ChekiWidgetGroupPreviewGrid', () => {
  let renderer: ReactTestRenderer | undefined;

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.clearAllMocks();
  });

  test('uses physical portrait dimensions without rotating five-inch photos', () => {
    act(() => {
      renderer = create(<ChekiWidgetGroupPreviewGrid items={[{
        id: 'item-1',
        spec: 'five_inch_portrait',
        frontPhotoUri: 'file:///one.jpg',
        date: '2026-08-25',
        createdAt: '2026-08-25T00:00:00.000Z',
        sortOrder: 0,
      }]} />);
    });

    expect(mockUseChekiAlbumGridLayout).toHaveBeenCalledWith(expect.objectContaining({
      density: 'medium',
      displayMode: 'portrait',
    }));
    const list = renderer!.root.findByType(FlatList);
    expect(list.props.data[0][0].spec).toBe('five_inch_portrait');
    expect(list.props.numColumns).toBeUndefined();
    const thumbnail = renderer!.root.findByType('ChekiGridThumbnail' as React.ElementType);
    expect(thumbnail.props.width).toBeCloseTo(80 * 86 / 54);
    expect(thumbnail.props.height).toBe(160);
    expect(thumbnail.props.fiveInchLandscape).toBeUndefined();
    expect(list.props.initialNumToRender).toBe(12);
    expect(list.props.windowSize).toBe(7);
  });
});

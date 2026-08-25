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

  test('uses the same medium-density image sizing as the manual content grid', () => {
    act(() => {
      renderer = create(<ChekiWidgetGroupPreviewGrid items={[{
        id: 'item-1',
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
    expect(list.props.numColumns).toBe(4);
    expect(list.props.initialNumToRender).toBe(12);
    expect(list.props.windowSize).toBe(7);
  });
});

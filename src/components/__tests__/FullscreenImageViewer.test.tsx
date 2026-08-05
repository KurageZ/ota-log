import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image, Modal, StyleSheet } from 'react-native';
import { FullscreenImageViewer } from '../FullscreenImageViewer';

jest.mock('react-native-image-viewing', () => ({
  __esModule: true,
  default: ({ HeaderComponent, FooterComponent, imageIndex, imageHidden, images, onImageIndexChange }: {
    HeaderComponent?: React.ComponentType<{ imageIndex: number }>;
    FooterComponent?: React.ComponentType<{ imageIndex: number }>;
    imageIndex: number;
    imageHidden?: boolean;
    images: Array<{ uri: string }>;
    onImageIndexChange?: (index: number) => void;
  }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(
      View,
      { testID: 'image-viewing', imageHidden, imageIndex, images, onImageIndexChange },
      HeaderComponent ? React.createElement(HeaderComponent, { imageIndex }) : null,
      FooterComponent ? React.createElement(FooterComponent, { imageIndex }) : null,
    );
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      white: '#fff',
      danger: '#f00',
      dangerSoft: '#fee',
      dangerBorder: '#fcc',
      heroDecorWeak: '#333',
      heroDecor: '#555',
      heroEyebrow: '#ccc',
      shadow: '#000',
    },
  }),
}));

jest.mock('../AppIcon', () => ({
  AppIcon: () => null,
}));

describe('FullscreenImageViewer opening transition', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.spyOn(Image, 'getSizeWithHeaders').mockImplementation((_, __, success) => {
      success(540, 860);
      return undefined as never;
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('renders the opening animation inside the viewer instead of presenting a second Modal', () => {
    act(() => {
      renderer = create(
        <FullscreenImageViewer
          visible
          items={[{ id: 'cheki-1', photoUri: 'file:///cheki-1.jpg' }]}
          selectedId="cheki-1"
          initialTransitionOrigin={{ x: 16, y: 120, width: 108, height: 172, borderRadius: 10 }}
          onClose={jest.fn()}
        />,
      );
    });

    expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'image-opening-transition' })).toBeTruthy();
    const headerControls = renderer.root.findByProps({ testID: 'image-viewer-header-controls' });
    expect(StyleSheet.flatten(headerControls.props.style).opacity).toBe(0);
  });

  test('reveals the viewer when opening transition image callbacks never arrive', () => {
    jest.useFakeTimers();

    act(() => {
      renderer = create(
        <FullscreenImageViewer
          visible
          items={[{ id: 'cheki-1', photoUri: 'file:///cheki-1.jpg' }]}
          selectedId="cheki-1"
          initialTransitionOrigin={{ x: 16, y: 120, width: 108, height: 172, borderRadius: 10 }}
          onClose={jest.fn()}
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'image-viewing' }).props.imageHidden).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(renderer.root.findByProps({ testID: 'image-viewing' }).props.imageHidden).toBe(false);
    expect(renderer.root.findByProps({ testID: 'image-viewer-header-controls' }).props.pointerEvents)
      .toBe('auto');
  });

  test('places edit in the top-right and delete in the bottom-right', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    act(() => {
      renderer = create(
        <FullscreenImageViewer
          visible
          items={[{ id: 'cheki-1', photoUri: 'file:///cheki-1.jpg' }]}
          selectedId="cheki-1"
          onClose={jest.fn()}
          onEdit={onEdit}
          onDelete={onDelete}
        />,
      );
    });

    const editButton = renderer.root.findByProps({ accessibilityLabel: '编辑图片' });
    act(() => editButton.props.onPress());
    expect(onEdit).toHaveBeenCalledWith({ id: 'cheki-1', photoUri: 'file:///cheki-1.jpg' });

    const deleteAction = renderer.root.findByProps({ testID: 'image-viewer-delete-action' });
    expect(StyleSheet.flatten(deleteAction.props.style)).toEqual(expect.objectContaining({
      position: 'absolute',
      right: 16,
    }));
    const deleteButton = renderer.root.findByProps({ accessibilityLabel: '删除图片' });
    act(() => deleteButton.props.onPress());
    expect(onDelete).toHaveBeenCalledWith({ id: 'cheki-1', photoUri: 'file:///cheki-1.jpg' });
  });

  test('switches to an alternate image from the shared header action', () => {
    act(() => {
      renderer = create(
        <FullscreenImageViewer
          visible
          items={[
            { id: 'cheki-1:front', photoUri: 'file:///front.jpg' },
            { id: 'cheki-2:front', photoUri: 'file:///second-front.jpg' },
          ]}
          selectedId="cheki-1:front"
          onClose={jest.fn()}
          getAlternateItem={(item) => item.photoUri === 'file:///front.jpg'
            ? { ...item, photoUri: 'file:///back.jpg' }
            : item.photoUri === 'file:///back.jpg'
              ? { ...item, photoUri: 'file:///front.jpg' }
              : null}
          getAlternateActionLabel={(item) => item.photoUri === 'file:///front.jpg' ? '查看背面' : '查看正面'}
        />,
      );
    });

    const backButton = renderer.root.findByProps({ accessibilityLabel: '查看背面' });
    act(() => backButton.props.onPress());

    expect(renderer.root.findByProps({ testID: 'image-viewing' }).props.images).toEqual([
      { uri: 'file:///back.jpg' },
      { uri: 'file:///second-front.jpg' },
    ]);
    expect(renderer.root.findByProps({ accessibilityLabel: '查看正面' })).toBeTruthy();

    const imageViewing = renderer.root.findByProps({ testID: 'image-viewing' });
    act(() => imageViewing.props.onImageIndexChange(1));
    expect(renderer.root.findByProps({ testID: 'image-viewing' }).props.images).toEqual([
      { uri: 'file:///front.jpg' },
      { uri: 'file:///second-front.jpg' },
    ]);
  });

  test('keeps alternate-side metadata in sync when the source item updates', () => {
    type ViewerItem = { id: string; photoUri: string; backUri: string; favorite: boolean };
    const getAlternateItem = (item: ViewerItem) => item.photoUri === item.backUri
      ? { ...item, photoUri: 'file:///front.jpg' }
      : { ...item, photoUri: item.backUri };
    const onClose = jest.fn();
    const onToggleFavorite = jest.fn();
    const render = (favorite: boolean) => (
      <FullscreenImageViewer
        visible
        items={[{
          id: 'cheki-1',
          photoUri: 'file:///front.jpg',
          backUri: 'file:///back.jpg',
          favorite,
        }]}
        selectedId="cheki-1"
        onClose={onClose}
        getAlternateItem={getAlternateItem}
        getAlternateActionLabel={(item) => item.photoUri === item.backUri ? '查看正面' : '查看背面'}
        isFavorite={(item) => item.favorite}
        onToggleFavorite={onToggleFavorite}
      />
    );

    act(() => {
      renderer = create(render(false));
    });
    act(() => renderer.root.findByProps({ accessibilityLabel: '查看背面' }).props.onPress());
    expect(renderer.root.findByProps({ accessibilityLabel: '收藏这张拍立得' })).toBeTruthy();

    act(() => renderer.update(render(true)));
    expect(renderer.root.findByProps({ testID: 'image-viewing' }).props.images)
      .toEqual([{ uri: 'file:///back.jpg' }]);
    expect(renderer.root.findByProps({ accessibilityLabel: '取消收藏这张拍立得' })).toBeTruthy();
  });

  test('keeps the collapsed details pill closer to the iOS bottom safe area', () => {
    act(() => {
      renderer = create(
        <FullscreenImageViewer
          visible
          items={[{ id: 'cheki-1', photoUri: 'file:///cheki-1.jpg' }]}
          selectedId="cheki-1"
          onClose={jest.fn()}
          getDetailSummary={() => '2026年7月15日'}
          renderDetails={() => null}
        />,
      );
    });

    const footerControls = renderer.root.findByProps({ testID: 'image-viewer-footer-controls' });
    expect(StyleSheet.flatten(footerControls.props.style).paddingBottom).toBe(8);
  });

  test('moves delete into a separate bottom action row when details expand', () => {
    act(() => {
      renderer = create(
        <FullscreenImageViewer
          visible
          items={[{ id: 'cheki-1', photoUri: 'file:///cheki-1.jpg' }]}
          selectedId="cheki-1"
          onClose={jest.fn()}
          onDelete={jest.fn()}
          getDetailSummary={() => '2026年7月15日'}
          renderDetails={() => null}
        />,
      );
    });

    const expandButton = renderer.root.findByProps({ accessibilityLabel: '展开图片信息' });
    act(() => expandButton.props.onPress());

    const deleteAction = renderer.root.findByProps({ testID: 'image-viewer-delete-action' });
    expect(StyleSheet.flatten(deleteAction.props.style)).toEqual(expect.objectContaining({
      width: '100%',
      height: 40,
      marginTop: 12,
      alignItems: 'flex-end',
    }));
    expect(StyleSheet.flatten(deleteAction.props.style).position).toBeUndefined();
  });
});

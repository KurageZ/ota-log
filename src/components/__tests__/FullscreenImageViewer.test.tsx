import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image, Modal, StyleSheet } from 'react-native';
import { FullscreenImageViewer } from '../FullscreenImageViewer';

jest.mock('react-native-image-viewing', () => ({
  __esModule: true,
  default: ({ HeaderComponent, imageIndex }: {
    HeaderComponent?: React.ComponentType<{ imageIndex: number }>;
    imageIndex: number;
  }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(
      View,
      { testID: 'image-viewing' },
      HeaderComponent ? React.createElement(HeaderComponent, { imageIndex }) : null,
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
});

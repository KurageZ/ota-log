import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import ChekiStickerCameraScreen from '../cheki-sticker-camera-screen';

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  return {
    Stack: {
      Screen: (props: object) => ReactModule.createElement('StackScreen', props),
    },
    router: { back: jest.fn() },
  };
});

jest.mock('expo-camera', () => {
  const ReactModule = require('react');
  return {
    CameraView: ReactModule.forwardRef((props: object, _ref: unknown) => (
      ReactModule.createElement('CameraView', props)
    )),
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      ReactModule.createElement(View, props, children)
    ),
    useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 24, left: 0 }),
  };
});

jest.mock('../../features/sticker-camera/sticker-picker', () => {
  const ReactModule = require('react');
  return {
    StickerPicker: (props: object) => ReactModule.createElement('StickerPicker', props),
  };
});

jest.mock('../../features/sticker-camera/sticker-overlay', () => ({
  StickerOverlay: () => null,
}));

jest.mock('../../features/sticker-camera/compose-sticker-photo', () => ({
  composeStickerPhoto: jest.fn(),
}));

jest.mock('../../components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../../components/ImageResultPreview', () => ({ ImageResultPreview: () => null }));
jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }) }),
}));
jest.mock('../../utils/failureAlert', () => ({ showFailureAlert: jest.fn() }));
jest.mock('../../utils/imageShare', () => ({
  saveImageToAlbum: jest.fn(),
  shareImageFile: jest.fn(),
}));

describe('ChekiStickerCameraScreen', () => {
  let renderer: ReactTestRenderer | undefined;

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = undefined;
  });

  test('hides the picker header after entering the camera stage', async () => {
    await act(async () => {
      renderer = create(<ChekiStickerCameraScreen />);
    });

    const picker = renderer!.root.findByType('StickerPicker' as never);
    await act(async () => {
      await picker.props.onConfirm([{
        id: 'cheki-1',
        uri: 'file:///cheki-1.jpg',
        width: 900,
        height: 1200,
      }]);
    });

    const routeOptions = renderer!.root
      .findAllByType('StackScreen' as never)
      .map((node) => node.props.options);

    expect(routeOptions).toContainEqual(expect.objectContaining({ headerShown: false }));
    expect(renderer!.root.findAllByType('CameraView' as never)).toHaveLength(1);
  });
});

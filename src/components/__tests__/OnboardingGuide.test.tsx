import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { OnboardingGuideProvider } from '../OnboardingGuide';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => (
      ReactModule.createElement(View, null, children)
    ),
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      ReactModule.createElement(View, props, children)
    ),
  };
});

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: false,
    isHydrated: true,
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('OnboardingGuide', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    storage.getItem.mockReset();
    storage.setItem.mockReset();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
  });

  async function renderGuide() {
    await act(async () => {
      renderer = create(
        <OnboardingGuideProvider>
          <Text>App content</Text>
        </OnboardingGuideProvider>,
      );
      await Promise.resolve();
    });
  }

  test('ignores presses and Android close requests while the newly shown guide is locked', async () => {
    await renderGuide();

    const skipButton = renderer!.root.findByProps({ accessibilityLabel: '跳过引导' });
    expect(skipButton.props.disabled).toBe(true);

    act(() => {
      renderer!.root.findByType(Modal).props.onRequestClose();
      skipButton.props.onPress();
    });

    expect(renderer!.root.findByProps({ accessibilityLabel: '跳过引导' })).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();

    act(() => {
      renderer!.root.findByType(Modal).props.onShow();
      jest.advanceTimersByTime(300);
    });

    const unlockedSkipButton = renderer!.root.findByProps({ accessibilityLabel: '跳过引导' });
    expect(unlockedSkipButton.props.disabled).toBe(false);
    await act(async () => {
      unlockedSkipButton.props.onPress();
      await Promise.resolve();
    });

    expect(renderer!.root.findAllByProps({ accessibilityLabel: '跳过引导' })).toHaveLength(0);
    expect(storage.setItem).toHaveBeenCalledWith('ota-log.onboarding-guide-seen.v2', 'true');
  });

  test('does not show again after the guide has been completed', async () => {
    let completionMarker: string | null = null;
    storage.getItem.mockImplementation(async () => completionMarker);
    storage.setItem.mockImplementation(async (_key, value) => {
      completionMarker = value;
    });

    await renderGuide();
    act(() => {
      renderer!.root.findByType(Modal).props.onShow();
      jest.advanceTimersByTime(300);
    });
    await act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: '跳过引导' }).props.onPress();
      await Promise.resolve();
    });

    act(() => renderer!.unmount());
    renderer = undefined;
    await renderGuide();

    expect(renderer!.root.findAllByType(Modal)).toHaveLength(0);
    expect(storage.getItem).toHaveBeenCalledTimes(2);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});

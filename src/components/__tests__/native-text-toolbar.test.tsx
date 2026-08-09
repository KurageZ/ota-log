import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { NativeTextToolbar } from '../native-text-toolbar';

describe('NativeTextToolbar', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  test('keeps multiple right actions as direct native toolbar buttons', () => {
    const tree = NativeTextToolbar({
      right: [
        { label: '分享', icon: 'share', onPress: jest.fn() },
        { label: '编辑', onPress: jest.fn() },
      ],
    }) as ReactElement<{ children: ReactNode }, typeof Fragment>;

    const toolbar = Children.toArray(tree.props.children)
      .find((child) => isValidElement(child) && child.type === Stack.Toolbar);
    expect(isValidElement(toolbar)).toBe(true);

    const buttons = Children.toArray((toolbar as ReactElement<{ children: ReactNode }>).props.children);
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => (
      isValidElement(button) && button.type === Stack.Toolbar.Button
    ))).toBe(true);
  });
});

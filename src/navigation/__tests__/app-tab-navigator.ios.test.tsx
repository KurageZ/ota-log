import React from 'react';
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
} from 'react-test-renderer';

jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const NativeTabs = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('NativeTabs', props, children);
  const Trigger = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement('NativeTabsTrigger', props, children);
  Trigger.Label = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('NativeTabsLabel', null, children);
  NativeTabs.Trigger = Trigger;

  return { NativeTabs };
});

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#7c3aed',
      textSecondary: '#6b7280',
    },
  }),
}));

jest.mock('../native-tab-icon', () => ({
  createNativeTabIcon: () => null,
}));

import { AppTabNavigator } from '../app-tab-navigator.ios';

describe('AppTabNavigator on iPad', () => {
  it('keeps top-level navigation in the tab bar instead of an overlapping sidebar', () => {
    let renderer: ReactTestRenderer;

    act(() => {
      renderer = create(<AppTabNavigator />);
    });

    const nativeTabs = renderer!.toJSON() as ReactTestRendererJSON;
    expect(nativeTabs.type).toBe('NativeTabs');
    expect(nativeTabs.props.sidebarAdaptable).toBe(false);
  });
});

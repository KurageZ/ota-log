import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ComponentType, ForwardedRef, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { BottomSheetDialog } from '../BottomSheetDialog';

const mockPresent = jest.fn();
let latestScrollableFooterAdjustment: boolean | undefined;
let latestViewFooterAdjustment: boolean | undefined;

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { ScrollView, View } = require('react-native');

  const BottomSheetModal = React.forwardRef(({
    children,
    footerComponent: FooterComponent,
  }: {
    children: ReactNode;
    footerComponent?: ComponentType<{ animatedFooterPosition: { value: number } }>;
  }, ref: ForwardedRef<{ present: () => void; dismiss: () => void }>) => {
    React.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: jest.fn() }));
    return (
      <View>
        {children}
        {FooterComponent ? <FooterComponent animatedFooterPosition={{ value: 0 }} /> : null}
      </View>
    );
  });

  return {
    BottomSheetModal,
    BottomSheetBackdrop: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
    BottomSheetFooter: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
    BottomSheetScrollView: ({
      children,
      enableFooterMarginAdjustment,
    }: {
      children?: ReactNode;
      enableFooterMarginAdjustment?: boolean;
    }) => {
      latestScrollableFooterAdjustment = enableFooterMarginAdjustment;
      return <ScrollView>{children}</ScrollView>;
    },
    BottomSheetView: ({
      children,
      enableFooterMarginAdjustment,
    }: {
      children?: ReactNode;
      enableFooterMarginAdjustment?: boolean;
    }) => {
      latestViewFooterAdjustment = enableFooterMarginAdjustment;
      return <View>{children}</View>;
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      screen: '#fff',
      heading: '#111',
      textSecondary: '#666',
      cardAlt: '#eee',
      inputBorder: '#ddd',
      divider: '#ddd',
      scrim: 'rgba(0,0,0,0.5)',
    },
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));

describe('BottomSheetDialog', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockPresent.mockClear();
    latestScrollableFooterAdjustment = undefined;
    latestViewFooterAdjustment = undefined;
  });

  afterEach(() => {
    if (!renderer) return;
    act(() => renderer.unmount());
  });

  test('pins footer actions and reserves their height in scrollable content', () => {
    act(() => {
      renderer = create(
        <BottomSheetDialog
          visible
          title="筛选"
          onClose={jest.fn()}
          scrollable
          footer={<Text accessibilityLabel="底部操作">应用</Text>}
        >
          <Text>内容</Text>
        </BottomSheetDialog>
      );
    });

    expect(latestScrollableFooterAdjustment).toBe(true);
    expect(renderer.root.findByProps({ accessibilityLabel: '底部操作' })).toBeTruthy();
  });

  test('reserves footer height for dynamically sized non-scrollable content', () => {
    act(() => {
      renderer = create(
        <BottomSheetDialog
          visible
          title="确认"
          onClose={jest.fn()}
          footer={<Text accessibilityLabel="确认操作">确认</Text>}
        >
          <Text>内容</Text>
        </BottomSheetDialog>
      );
    });

    expect(latestViewFooterAdjustment).toBe(true);
    expect(renderer.root.findByProps({ accessibilityLabel: '确认操作' })).toBeTruthy();
  });
});

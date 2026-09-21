import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ComponentType, ForwardedRef, ReactNode } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { BottomSheetDialog } from '../BottomSheetDialog';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let latestModalProps: any;
let mockWidth = 390;
let mockHeight = 844;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 3, fontScale: 1 }),
}));
let latestScrollableFooterAdjustment: boolean | undefined;
let latestViewFooterAdjustment: boolean | undefined;
let latestScrollableContentContainerStyle: unknown;

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { ScrollView, View } = require('react-native');

  const BottomSheetModal = React.forwardRef(({
    children,
    footerComponent: FooterComponent,
    ...props
  }: {
    [key: string]: unknown;
    children: ReactNode;
    footerComponent?: ComponentType<{ animatedFooterPosition: { value: number } }>;
  }, ref: ForwardedRef<{ present: () => void; dismiss: () => void }>) => {
    React.useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
    latestModalProps = props;
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
      contentContainerStyle,
    }: {
      children?: ReactNode;
      enableFooterMarginAdjustment?: boolean;
      contentContainerStyle?: unknown;
    }) => {
      latestScrollableFooterAdjustment = enableFooterMarginAdjustment;
      latestScrollableContentContainerStyle = contentContainerStyle;
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
    mockDismiss.mockClear();
    mockWidth = 390;
    mockHeight = 844;
    latestScrollableFooterAdjustment = undefined;
    latestViewFooterAdjustment = undefined;
    latestScrollableContentContainerStyle = undefined;
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

  test('keeps dynamically sized scrollable content away from the screen edges by default', () => {
    act(() => {
      renderer = create(
        <BottomSheetDialog visible title="确认" onClose={jest.fn()} scrollable>
          <Text>内容</Text>
        </BottomSheetDialog>
      );
    });

    expect(latestScrollableContentContainerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingHorizontal: 16 })]),
    );
  });

  test('reserves footer height for dynamically sized non-scrollable content', () => {
    act(() => {
      renderer = create(
        <BottomSheetDialog
          visible
          title="确认"
          scrollable={false}
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

  test('has no close button and blocks every dismissal gesture while busy', () => {
    const onClose = jest.fn();
    const back = jest.spyOn(BackHandler, 'addEventListener');
    act(() => {
      renderer = create(<BottomSheetDialog visible title="分享活动" onClose={onClose} dismissible={false}><Text>正在生成</Text></BottomSheetDialog>);
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: '关闭' })).toHaveLength(0);
    expect(latestModalProps.enablePanDownToClose).toBe(false);
    expect(latestModalProps.backdropComponent({}).props.pressBehavior).toBe('none');
    const handler = back.mock.calls[back.mock.calls.length - 1][1];
    act(() => { expect(handler({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      renderer.update(<BottomSheetDialog visible title="分享活动" onClose={onClose}><Text>分享</Text></BottomSheetDialog>);
    });
    expect(latestModalProps.enablePanDownToClose).toBe(true);
    expect(latestModalProps.backdropComponent({}).props.pressBehavior).toBe('close');
    act(() => { back.mock.calls[back.mock.calls.length - 1][1]({ type: 'hardwareBackPress', timeStamp: 0 }); });
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    act(() => latestModalProps.onDismiss());
    expect(onClose).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  test('parent-driven close does not fire the cancel callback', () => {
    const onClose = jest.fn();
    act(() => { renderer = create(<BottomSheetDialog visible title="日期" onClose={onClose}><Text>日期</Text></BottomSheetDialog>); });
    act(() => { renderer.update(<BottomSheetDialog visible={false} title="日期" onClose={onClose}><Text>日期</Text></BottomSheetDialog>); });
    act(() => latestModalProps.onDismiss());
    expect(onClose).not.toHaveBeenCalled();
  });

  test('constrains a wide sheet and uses scrollable content in short windows', () => {
    mockWidth = 1200;
    mockHeight = 300;
    act(() => { renderer = create(<BottomSheetDialog visible title="日期" onClose={jest.fn()}><Text>日期</Text></BottomSheetDialog>); });
    expect(latestModalProps.style.marginHorizontal).toBe(260);
    expect(latestModalProps.maxDynamicContentSize).toBeLessThanOrEqual(276);
    expect(latestScrollableContentContainerStyle).toEqual(expect.arrayContaining([expect.objectContaining({ paddingHorizontal: 32 })]));
  });
});

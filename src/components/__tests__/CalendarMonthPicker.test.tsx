import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CalendarMonthPicker } from '../CalendarMonthPicker';

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { ScrollView, View } = require('react-native');

  const BottomSheetModal = React.forwardRef(
    (_props: { children?: React.ReactNode }, ref: React.ForwardedRef<{ present: () => void; dismiss: () => void }>) => {
      React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: jest.fn() }));
      return <View>{_props.children}</View>;
    },
  );

  return {
    BottomSheetModal,
    BottomSheetBackdrop: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    BottomSheetFooter: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    BottomSheetScrollView: ({ children }: { children?: React.ReactNode }) => <ScrollView>{children}</ScrollView>,
    BottomSheetView: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
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
      text: '#222',
      textSecondary: '#666',
      cardAlt: '#eee',
      inputBorder: '#ddd',
      divider: '#ddd',
      scrim: 'rgba(0,0,0,0.5)',
      accent: '#e0457b',
      onAccent: '#fff',
    },
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));

describe('CalendarMonthPicker', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    if (!renderer) return;
    act(() => renderer.unmount());
  });

  const renderPicker = (props?: Partial<React.ComponentProps<typeof CalendarMonthPicker>>) => {
    act(() => {
      renderer = create(
        <CalendarMonthPicker
          visible
          selectedMonth="2026-08"
          onClose={jest.fn()}
          onSelect={jest.fn()}
          {...props}
        />,
      );
    });
  };

  test('renders year navigation and all twelve months', () => {
    renderPicker();

    expect(renderer.root.findByProps({ accessibilityLabel: '2026 年 8 月' })).toBeTruthy();
    const monthLabels = [
      ...new Set(
        renderer.root
          .findAll(
            (node) =>
              typeof node.props.accessibilityLabel === 'string' &&
              /^\d{4} 年 \d{1,2} 月$/.test(node.props.accessibilityLabel),
          )
          .map((node) => node.props.accessibilityLabel as string),
      ),
    ];
    expect(monthLabels).toHaveLength(12);
  });

  test('selecting a month reports the visible year and month', () => {
    const onSelect = jest.fn();
    renderPicker({ onSelect });

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '2026 年 3 月' }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(2026, 3);
  });

  test('year navigation updates the visible year for selection', () => {
    const onSelect = jest.fn();
    renderPicker({ onSelect });

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '下一年' }).props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '2027 年 8 月' }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(2027, 8);
  });
});

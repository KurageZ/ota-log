import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ForwardedRef, ReactNode } from 'react';
import { View } from 'react-native';
import { FilterSheet, type FilterSection } from '../FilterSheet';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let latestOnDismiss: (() => void) | undefined;

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, TextInput, ScrollView } = require('react-native');

  const BottomSheetModal = React.forwardRef(({
    children,
    onDismiss,
  }: {
    children: ReactNode;
    onDismiss?: () => void;
  }, ref: ForwardedRef<{ present: () => void; dismiss: () => void }>) => {
    React.useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    latestOnDismiss = onDismiss;

    return <View>{children}</View>;
  });

  const BottomSheetBackdrop = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  const BottomSheetScrollView = ({ children }: { children?: ReactNode }) => <ScrollView>{children}</ScrollView>;
  const BottomSheetTextInput = (props: React.ComponentProps<typeof TextInput>) => <TextInput {...props} />;

  return {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetScrollView,
    BottomSheetTextInput,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#f00',
      onAccent: '#fff',
      textSecondary: '#666',
      input: '#111',
      cardAlt: '#222',
      inputBorder: '#333',
      text: '#000',
      card: '#fff',
      screen: '#fafafa',
      heading: '#111',
      scrim: 'rgba(0,0,0,0.7)',
      placeholder: '#888',
      cardMuted: '#eee',
      textMuted: '#999',
    },
  }),
}));

jest.mock('../AppIcon', () => ({
  AppIcon: () => null,
}));

jest.mock('../ArtistOptionRow', () => ({
  ArtistOptionRow: () => null,
}));

describe('FilterSheet', () => {
  const sections: FilterSection[] = [
    {
      key: 'status',
      title: '状态',
      options: [{ value: 'done', label: '已完成' }],
      value: null,
      onChange: jest.fn(),
    },
  ];

  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockPresent.mockClear();
    mockDismiss.mockClear();
    latestOnDismiss = undefined;
    sections[0].onChange = jest.fn();
  });

  afterEach(() => {
    if (!renderer) return;
    act(() => {
      renderer.unmount();
    });
  });

  test('does not dismiss on initial hidden render and presents when becoming visible', () => {
    act(() => {
      renderer = create(
        <FilterSheet
          visible={false}
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockPresent).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        <FilterSheet
          visible
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  test('can present again after an internal swipe-down dismiss', () => {
    const onClose = jest.fn();

    act(() => {
      renderer = create(
        <FilterSheet
          visible={false}
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={onClose}
        />
      );
    });

    act(() => {
      renderer.update(
        <FilterSheet
          visible
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={onClose}
        />
      );
    });

    expect(mockPresent).toHaveBeenCalledTimes(1);

    act(() => {
      latestOnDismiss?.();
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(
        <FilterSheet
          visible={false}
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={onClose}
        />
      );
    });

    expect(mockDismiss).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        <FilterSheet
          visible
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={onClose}
        />
      );
    });

    expect(mockPresent).toHaveBeenCalledTimes(2);
  });
});

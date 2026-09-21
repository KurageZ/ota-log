import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ComponentType, ForwardedRef, ReactNode } from 'react';
import { BackHandler, View } from 'react-native';
import type { Artist } from '../../types/models';
import { FilterSheet, type FilterSection } from '../FilterSheet';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let latestOnDismiss: (() => void) | undefined;
let latestBottomInset: number | undefined;
let latestFooterMarginAdjustment: boolean | undefined;

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, TextInput, ScrollView } = require('react-native');

  const BottomSheetModal = React.forwardRef(({
    children,
    onDismiss,
    bottomInset,
    footerComponent: FooterComponent,
  }: {
    children: ReactNode;
    onDismiss?: () => void;
    bottomInset?: number;
    footerComponent?: ComponentType<{ animatedFooterPosition: { value: number } }>;
  }, ref: ForwardedRef<{ present: () => void; dismiss: () => void }>) => {
    React.useImperativeHandle(ref, () => ({
      present: mockPresent,
      dismiss: mockDismiss,
    }));
    latestOnDismiss = onDismiss;
    latestBottomInset = bottomInset;

    return (
      <View>
        {children}
        {FooterComponent ? <FooterComponent animatedFooterPosition={{ value: 0 }} /> : null}
      </View>
    );
  });

  const BottomSheetBackdrop = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  const BottomSheetFooter = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  const BottomSheetScrollView = ({
    children,
    enableFooterMarginAdjustment,
  }: {
    children?: ReactNode;
    enableFooterMarginAdjustment?: boolean;
  }) => {
    latestFooterMarginAdjustment = enableFooterMarginAdjustment;
    return <ScrollView>{children}</ScrollView>;
  };
  const BottomSheetTextInput = (props: React.ComponentProps<typeof TextInput>) => <TextInput {...props} />;

  return {
    BottomSheetModal,
    BottomSheetBackdrop,
    BottomSheetFooter,
    BottomSheetScrollView,
    BottomSheetTextInput,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
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
      divider: '#ddd',
    },
  }),
}));

jest.mock('../AppIcon', () => ({
  AppIcon: () => null,
}));

jest.mock('../ArtistOptionRow', () => ({
  ArtistOptionRow: () => null,
}));

const mockArtistSearchPicker = jest.fn();
jest.mock('../ArtistSearchPicker', () => ({
  ArtistSearchPicker: (props: unknown) => {
    mockArtistSearchPicker(props);
    return null;
  },
}));

function artist(id: string, name: string): Artist {
  return {
    id,
    name,
    short_name: null,
    artist_type: null,
    parent_id: null,
    avatar_uri: null,
    background_uri: null,
    background_color: null,
    url: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

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
    latestBottomInset = undefined;
    latestFooterMarginAdjustment = undefined;
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

  test('extends the sheet through the bottom safe area so navigation cannot show underneath', () => {
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    expect(latestBottomInset).toBe(0);
  });

  test('pins the apply action in a footer and reserves its space in the scroll area', () => {
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={sections}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
          onApply={jest.fn()}
        />
      );
    });

    expect(latestFooterMarginAdjustment).toBe(true);
    expect(renderer.root.findByProps({ accessibilityLabel: '应用筛选' })).toBeTruthy();
  });

  test('dialog shell separates reset, apply, and dismiss and handles Android back', () => {
    const onReset = jest.fn();
    const onApply = jest.fn();
    const onClose = jest.fn();
    const backListener = jest.spyOn(BackHandler, 'addEventListener');
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={sections}
          isDark={false}
          onReset={onReset}
          onClose={onClose}
          onApply={onApply}
        />,
      );
    });
    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(latestFooterMarginAdjustment).toBe(true);
    act(() => renderer.root.findByProps({ accessibilityLabel: '重置筛选' }).props.onPress());
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    act(() => renderer.root.findByProps({ accessibilityLabel: '应用筛选' }).props.onPress());
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByProps({ accessibilityLabel: '关闭', accessibilityRole: 'button' })).toHaveLength(0);
    act(() => latestOnDismiss?.());
    expect(onClose).toHaveBeenCalledTimes(1);
    const handleBack = backListener.mock.calls.find(([event]) => event === 'hardwareBackPress')![1];
    act(() => { expect(handleBack({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    backListener.mockRestore();
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

  test('tapping an already selected chip deselects it', () => {
    const onChange = jest.fn();
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[{ ...sections[0], value: 'done', onChange }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const chip = renderer.root.findByProps({ accessibilityLabel: '已完成' });
    act(() => {
      chip.props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('single-select chip selects on first tap and deselects on second', () => {
    const onChange = jest.fn();
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[{ ...sections[0], value: null, onChange }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const chip = renderer.root.findByProps({ accessibilityLabel: '已完成' });
    act(() => {
      chip.props.onPress();
    });
    expect(onChange).toHaveBeenNthCalledWith(1, 'done');

    act(() => {
      renderer.update(
        <FilterSheet
          visible
          sections={[{ ...sections[0], value: 'done', onChange }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });
    const selectedChip = renderer.root.findByProps({ accessibilityLabel: '已完成' });
    act(() => {
      selectedChip.props.onPress();
    });
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });

  test('renders multiple chip groups under one section title', () => {
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[{
            key: 'other',
            title: '其他条件',
            value: null,
            onChange: jest.fn(),
            options: [],
            chipGroups: [
              {
                key: 'linked',
                options: [{ value: 'linked', label: '已关联活动' }],
                value: null,
                onChange: jest.fn(),
              },
              {
                key: 'notes',
                options: [{ value: 'with_notes', label: '已有备注' }],
                value: 'with_notes',
                onChange: jest.fn(),
              },
              {
                key: 'spec',
                title: '规格',
                multiple: true,
                values: [],
                onValuesChange: jest.fn(),
                showAllChip: true,
                options: [
                  { value: 'three_inch_portrait', label: '三寸竖版' },
                  { value: 'square', label: '方形' },
                ],
              },
            ],
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    expect(renderer.root.findByProps({ accessibilityLabel: '已关联活动' })).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: '已有备注' })).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: '三寸竖版' })).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: '方形' })).toBeTruthy();
    // chip 组在页面内换行，不使用横向滚动
    expect(renderer.root.findAllByProps({ horizontal: true })).toHaveLength(0);
  });

  test('chip group toggle selects and deselects', () => {
    const onChange = jest.fn();
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[{
            key: 'other',
            title: '其他条件',
            value: null,
            onChange: jest.fn(),
            options: [],
            chipGroups: [{
              key: 'linked',
              options: [{ value: 'linked', label: '已关联活动' }],
              value: null,
              onChange,
            }],
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const chip = renderer.root.findByProps({ accessibilityLabel: '已关联活动' });
    act(() => {
      chip.props.onPress();
    });
    expect(onChange).toHaveBeenNthCalledWith(1, 'linked');

    act(() => {
      renderer.update(
        <FilterSheet
          visible
          sections={[{
            key: 'other',
            title: '其他条件',
            value: null,
            onChange: jest.fn(),
            options: [],
            chipGroups: [{
              key: 'linked',
              options: [{ value: 'linked', label: '已关联活动' }],
              value: 'linked',
              onChange,
            }],
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });
    const selectedChip = renderer.root.findByProps({ accessibilityLabel: '已关联活动' });
    act(() => {
      selectedChip.props.onPress();
    });
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });

  test('multiple chip group toggles values via onValuesChange', () => {
    const onValuesChange = jest.fn();
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[{
            key: 'other',
            title: '其他条件',
            value: null,
            onChange: jest.fn(),
            options: [],
            chipGroups: [{
              key: 'spec',
              multiple: true,
              values: [],
              onValuesChange,
              options: [
                { value: 'three_inch_portrait', label: '三寸竖版' },
                { value: 'square', label: '方形' },
              ],
            }],
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const portrait = renderer.root.findByProps({ accessibilityLabel: '三寸竖版' });
    act(() => {
      portrait.props.onPress();
    });
    expect(onValuesChange).toHaveBeenNthCalledWith(1, ['three_inch_portrait']);

    act(() => {
      renderer.update(
        <FilterSheet
          visible
          sections={[{
            key: 'other',
            title: '其他条件',
            value: null,
            onChange: jest.fn(),
            options: [],
            chipGroups: [{
              key: 'spec',
              multiple: true,
              values: ['three_inch_portrait'],
              onValuesChange,
              options: [
                { value: 'three_inch_portrait', label: '三寸竖版' },
                { value: 'square', label: '方形' },
              ],
            }],
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });
    const square = renderer.root.findByProps({ accessibilityLabel: '方形' });
    act(() => {
      square.props.onPress();
    });
    expect(onValuesChange).toHaveBeenNthCalledWith(2, ['three_inch_portrait', 'square']);

    act(() => {
      renderer.update(
        <FilterSheet
          visible
          sections={[{
            key: 'other',
            title: '其他条件',
            value: null,
            onChange: jest.fn(),
            options: [],
            chipGroups: [{
              key: 'spec',
              multiple: true,
              values: ['three_inch_portrait', 'square'],
              onValuesChange,
              options: [
                { value: 'three_inch_portrait', label: '三寸竖版' },
                { value: 'square', label: '方形' },
              ],
            }],
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });
    const selectedPortrait = renderer.root.findByProps({ accessibilityLabel: '三寸竖版' });
    act(() => {
      selectedPortrait.props.onPress();
    });
    expect(onValuesChange).toHaveBeenNthCalledWith(3, ['square']);
  });

  test('renders beforeContent inside its section', () => {
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[{
            key: 'artist',
            title: '艺人',
            value: null,
            onChange: jest.fn(),
            options: [{ value: 'a1', label: '艺人A' }],
            beforeContent: <View accessibilityLabel="快捷内容" />,
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    expect(renderer.root.findByProps({ accessibilityLabel: '快捷内容' })).toBeTruthy();
  });

  test('renders artist section through ArtistSearchPicker and wires selection callbacks', () => {
    mockArtistSearchPicker.mockClear();
    const onValuesChange = jest.fn();
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[{
            key: 'artist',
            title: '艺人',
            value: null,
            values: ['a1'],
            multiple: true,
            onChange: jest.fn(),
            onValuesChange,
            artistSearch: {
              artists: [artist('a1', '艺人A'), artist('a2', '艺人B')],
              oshiArtistId: 'a1',
              parentNameMap: {},
              placeholder: '搜索艺人…',
              typePreference: 'person',
              extraSelectedRows: [{ id: 'deleted', label: '未知艺人' }],
            },
          }]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const props = mockArtistSearchPicker.mock.calls[0][0] as {
      artists: Artist[];
      selectedIds: string[];
      oshiArtistId: string | null;
      typePreference: 'group' | 'person' | null;
      extraSelectedRows: Array<{ id: string; label: string }>;
      onSelectArtist: (item: Artist) => void;
      onRemoveArtist: (item: Artist) => void;
      onRemoveExtraSelectedRow: (id: string) => void;
    };
    expect(props.artists.map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(props.selectedIds).toEqual(['a1']);
    expect(props.oshiArtistId).toBe('a1');
    expect(props.typePreference).toBe('person');
    expect(props.extraSelectedRows).toEqual([{ id: 'deleted', label: '未知艺人' }]);

    act(() => props.onSelectArtist(artist('a2', '艺人B')));
    expect(onValuesChange).toHaveBeenCalledWith(['a1', 'a2']);
  });

  test('artist section removal updates values through FilterSheet', () => {
    mockArtistSearchPicker.mockClear();
    const onValuesChange = jest.fn();
    const section: FilterSection = {
      key: 'artist',
      title: '艺人',
      value: null,
      values: ['a1', 'deleted'],
      multiple: true,
      onChange: jest.fn(),
      onValuesChange,
      artistSearch: {
        artists: [artist('a1', '艺人A')],
        oshiArtistId: null,
        extraSelectedRows: [{ id: 'deleted', label: '未知艺人' }],
      },
    };
    act(() => {
      renderer = create(
        <FilterSheet
          visible
          sections={[section]}
          isDark={false}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );
    });

    const props = mockArtistSearchPicker.mock.calls[0][0] as {
      onRemoveArtist: (item: Artist) => void;
      onRemoveExtraSelectedRow: (id: string) => void;
    };
    act(() => props.onRemoveArtist(artist('a1', '艺人A')));
    expect(onValuesChange).toHaveBeenCalledWith(['deleted']);

    act(() => props.onRemoveExtraSelectedRow('deleted'));
    expect(onValuesChange).toHaveBeenCalledWith(['a1']);
  });
});

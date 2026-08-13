import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SearchFilterBar } from '../SearchFilterBar';

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      input: '#111',
      cardMuted: '#eee',
      inputBorder: '#ccc',
      placeholder: '#888',
      text: '#111',
      textMuted: '#777',
      textSecondary: '#666',
      accent: '#7c3aed',
      accentText: '#6d28d9',
      accentBorder: '#8b5cf6',
      onAccent: '#fff',
      danger: '#ef4444',
    },
  }),
}));

jest.mock('../AppIcon', () => ({
  AppIcon: () => null,
}));

describe('SearchFilterBar', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('can hide active chips while retaining the filter count and clear action', () => {
    const onKeywordChange = jest.fn();
    act(() => {
      renderer = create(
        <SearchFilterBar
          keyword="签售"
          onKeywordChange={onKeywordChange}
          placeholder="搜索艺人、活动或备注等关键词"
          onOpenFilter={jest.fn()}
          activeFilters={[{ id: 'artist', label: '测试艺人', onPress: jest.fn() }]}
          showActiveFilters={false}
          clearButtonBehavior="custom"
          activeCount={2}
          filterExpanded={false}
          isDark={false}
        />,
      );
    });

    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === '测试艺人')).toBe(false);
    const filterButton = renderer.root.findByProps({ accessibilityLabel: '筛选，已启用 2 项条件' });
    expect(filterButton.props.accessibilityState).toEqual({ expanded: false });

    act(() => renderer.root.findByProps({ accessibilityLabel: '清除搜索' }).props.onPress());
    expect(onKeywordChange).toHaveBeenCalledWith('');
  });
});

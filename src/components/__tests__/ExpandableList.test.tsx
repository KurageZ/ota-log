import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { ExpandableList } from '../ExpandableList';

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#7c3aed',
      divider: '#e5e7eb',
    },
  }),
}));

jest.mock('../AppIcon', () => ({
  AppIcon: () => null,
}));

describe('ExpandableList', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  function renderList(resetKey = 'period-a') {
    return (
      <ExpandableList
        items={['一', '二', '三', '四']}
        initialVisibleCount={2}
        resetKey={resetKey}
        expandLabel={(hiddenCount) => `展开其余 ${hiddenCount} 项`}
        collapseLabel={() => '收起列表'}
        renderItems={(items) => items.map((item) => <Text key={item}>{item}</Text>)}
      />
    );
  }

  test('shows a preview and toggles the full list', () => {
    act(() => {
      renderer = create(renderList());
    });

    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      '一',
      '二',
      '展开其余 2 项',
    ]);

    const toggle = renderer.root.findByProps({ accessibilityRole: 'button' });
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });

    act(() => toggle.props.onPress());

    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      '一',
      '二',
      '三',
      '四',
      '收起列表',
    ]);
    expect(renderer.root.findByProps({ accessibilityRole: 'button' }).props.accessibilityState)
      .toEqual({ expanded: true });
  });

  test('returns to the preview when the reset key changes', () => {
    act(() => {
      renderer = create(renderList());
    });
    act(() => renderer.root.findByProps({ accessibilityRole: 'button' }).props.onPress());
    act(() => renderer.update(renderList('period-b')));

    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      '一',
      '二',
      '展开其余 2 项',
    ]);

    act(() => renderer.root.findByProps({ accessibilityRole: 'button' }).props.onPress());
    act(() => renderer.update(renderList('period-a')));

    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      '一',
      '二',
      '展开其余 2 项',
    ]);
  });

  test('does not render a toggle when all items fit in the preview', () => {
    act(() => {
      renderer = create(
        <ExpandableList
          items={['一', '二']}
          initialVisibleCount={2}
          renderItems={(items) => items.map((item) => <Text key={item}>{item}</Text>)}
        />
      );
    });

    expect(renderer.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
  });
});

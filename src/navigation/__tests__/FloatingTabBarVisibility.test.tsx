import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
const {
  FloatingTabBarVisibilityProvider,
  useFloatingTabBarScroll,
  useFloatingTabBarVisibility,
} = require('../FloatingTabBarVisibility.tsx') as typeof import('../FloatingTabBarVisibility');

type ScrollProps = ReturnType<typeof useFloatingTabBarScroll>;

function Harness({ capture }: { capture: (props: ScrollProps, isHidden: boolean) => void }) {
  const props = useFloatingTabBarScroll();
  const { isHidden } = useFloatingTabBarVisibility();
  capture(props, isHidden);
  return null;
}

function layoutEvent(height: number) {
  return {
    nativeEvent: { layout: { height, width: 400, x: 0, y: 0 } },
  } as LayoutChangeEvent;
}

function scrollEvent(offsetY: number, contentHeight: number, viewportHeight: number) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: offsetY },
      contentSize: { height: contentHeight, width: 400 },
      layoutMeasurement: { height: viewportHeight, width: 400 },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

describe('useFloatingTabBarScroll', () => {
  let renderer: ReactTestRenderer;
  let props: ScrollProps;
  let isHidden = false;

  beforeEach(() => {
    act(() => {
      renderer = create(
        <FloatingTabBarVisibilityProvider>
          <Harness capture={(nextProps, nextIsHidden) => {
            props = nextProps;
            isHidden = nextIsHidden;
          }} />
        </FloatingTabBarVisibilityProvider>,
      );
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  test('restores the tab bar when content becomes too short to scroll', () => {
    act(() => {
      props.onScroll(scrollEvent(40, 1200, 600));
    });
    expect(isHidden).toBe(true);

    act(() => {
      props.onLayout(layoutEvent(600));
      props.onContentSizeChange(400, 500);
    });
    expect(isHidden).toBe(false);
  });

  test('does not hide the tab bar for non-scrollable content', () => {
    act(() => {
      props.onScroll(scrollEvent(40, 500, 600));
    });
    expect(isHidden).toBe(false);
  });
});

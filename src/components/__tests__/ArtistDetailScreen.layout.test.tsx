import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { ImageBackground, Text, View } from 'react-native';

import ArtistDetailScreen from '../../../app/artists/[id]/index';

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      FlatList: ReactNative.FlatList,
      ScrollView: ReactNative.ScrollView,
      View: ReactNative.View,
    },
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: () => 0,
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedReaction: () => undefined,
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
  };
});

const mockDb = {
  userConfig: {
    getConfig: jest.fn(),
  },
  artists: {
    findById: jest.fn(),
    findMembers: jest.fn(),
    findMembershipsForPerson: jest.fn(),
    findMembershipsForGroup: jest.fn(),
    findCurrentGroups: jest.fn(),
    findCurrentMembers: jest.fn(),
    update: jest.fn(),
    toggleFavorite: jest.fn(),
  },
  events: {
    findByArtistId: jest.fn(),
    findAll: jest.fn(),
  },
  cheki: {
    findByArtistId: jest.fn(),
  },
  chekiManualEntries: {
    findByArtistId: jest.fn(),
  },
};

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  return {
    Stack: { Screen: () => null },
    router: { back: jest.fn(), canGoBack: () => true, push: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: () => ({ id: 'artist-1' }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      ReactModule.createElement(View, props, children)
    ),
    useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
  };
});

jest.mock('expo-glass-effect', () => ({
  GlassView: ({ children, ...props }: { children: React.ReactNode }) => (
    require('react').createElement(require('react-native').View, props, children)
  ),
  isGlassEffectAPIAvailable: () => false,
  isLiquidGlassAvailable: () => false,
}));

jest.mock('../../context/DBContext', () => ({
  useDB: () => mockDb,
}));

jest.mock('../../utils/artistBackdrop', () => ({
  deriveArtistBackdropPalette: () => ({
    headerColor: '#1b1433',
    heroOverlayBottomColors: ['transparent', 'rgba(0,0,0,0.3)', '#1b1433'],
    heroOverlayTopColors: ['rgba(0,0,0,0.35)', 'transparent', 'transparent'],
    paletteIsDark: true,
    surfaceColor: '#1b1433',
  }),
  extractArtistBackgroundColor: jest.fn(),
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      accent: '#6750a4',
      accentBorder: '#8c75bd',
      accentSoft: '#eee8ff',
      accentSofter: '#f5f1ff',
      accentText: '#6750a4',
      card: '#fff',
      cardAlt: '#f5f5f5',
      chevron: '#888',
      danger: '#c00',
      divider: '#ddd',
      heading: '#111',
      inputBorder: '#ddd',
      onAccent: '#fff',
      screen: '#fafafa',
      scrim: '#222',
      text: '#222',
      textMuted: '#999',
      textSecondary: '#666',
      white: '#fff',
    },
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../ChekiManualEntryList', () => ({ ChekiManualEntryList: () => null }));
jest.mock('../ChekiViewerModal', () => ({ ChekiViewerModal: () => null }));
jest.mock('../EventCard', () => ({ EventCard: () => null }));
jest.mock('../EventSectionHeader', () => ({ EventSectionHeader: () => null }));
jest.mock('../Oshi', () => ({ OshiAvatar: () => null, OshiBadge: () => null }));
jest.mock('../BottomSheetDialog', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    BottomSheetDialog: ({
      visible,
      title,
      children,
    }: {
      visible: boolean;
      title: string;
      children: React.ReactNode;
    }) => (
      visible
        ? ReactModule.createElement(View, { testID: 'artist-attributes-sheet', accessibilityLabel: title }, children)
        : null
    ),
  };
});

function hasAncestorOfType(node: ReactTestInstance, type: unknown) {
  let parent = node.parent;
  while (parent) {
    if (parent.type === type) return true;
    parent = parent.parent;
  }
  return false;
}

function textContents(node: ReactTestInstance): string[] {
  return node.findAllByType(Text).map((textNode) => {
    const children = Array.isArray(textNode.props.children) ? textNode.props.children : [textNode.props.children];
    return children.map((child) => (typeof child === 'string' ? child : '')).join('');
  });
}

describe('ArtistDetailScreen background layout', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockDb.userConfig.getConfig.mockResolvedValue({ oshi_artist_id: null });
    mockDb.artists.findById.mockResolvedValue({
      id: 'artist-1',
      name: '测试艺人',
      short_name: null,
      artist_type: 'person',
      parent_id: null,
      avatar_uri: null,
      background_uri: 'file:///artist-background.jpg',
      background_color: '#6750a4',
      url: 'https://example.com/artist',
      is_favorite: 0,
      created_at: '2026-08-05T00:00:00.000Z',
    });
    mockDb.artists.findMembers.mockResolvedValue([]);
    mockDb.artists.findMembershipsForPerson.mockResolvedValue([]);
    mockDb.artists.findMembershipsForGroup.mockResolvedValue([]);
    mockDb.artists.findCurrentGroups.mockResolvedValue([]);
    mockDb.artists.findCurrentMembers.mockResolvedValue([]);
    mockDb.events.findByArtistId.mockResolvedValue([]);
    mockDb.events.findAll.mockResolvedValue([]);
    mockDb.cheki.findByArtistId.mockResolvedValue([]);
    mockDb.chekiManualEntries.findByArtistId.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.clearAllMocks();
  });

  test('keeps the backdrop fixed and presents more attributes in a bottom sheet', async () => {
    await act(async () => {
      renderer = create(<ArtistDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const collapsedBackdropHeights = renderer.root
      .findAllByType(ImageBackground)
      .map((node) => node.props.style.height);

    const moreButtons = renderer.root.findAllByProps({ accessibilityLabel: '更多' });
    expect(moreButtons.length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: 'artist-attributes-sheet' })).toHaveLength(0);

    await act(async () => {
      moreButtons[0].props.onPress();
    });

    const expandedBackdropHeights = renderer.root
      .findAllByType(ImageBackground)
      .map((node) => node.props.style.height);
    expect(expandedBackdropHeights).toEqual(collapsedBackdropHeights);

    const sheets = renderer.root.findAllByType(View).filter(
      (node) => node.props.testID === 'artist-attributes-sheet',
    );
    expect(sheets).toHaveLength(1);
    expect(sheets.every((node) => !hasAncestorOfType(node, ImageBackground))).toBe(true);

    const attributeCards = sheets[0].findAllByType(View).filter(
      (node) => node.props.testID === 'artist-attributes-card',
    );
    expect(attributeCards).toHaveLength(1);
    expect(attributeCards.every((node) => !hasAncestorOfType(node, ImageBackground))).toBe(true);

    const historyCards = sheets[0].findAllByType(View).filter(
      (node) => node.props.testID === 'artist-history-card',
    );
    const linkCards = sheets[0].findAllByType(View).filter(
      (node) => node.props.testID === 'artist-link-card',
    );
    expect(historyCards).toHaveLength(1);
    expect(linkCards).toHaveLength(1);
    expect(textContents(historyCards[0])).toEqual(expect.arrayContaining([
      '所属团体',
      '暂无记录',
      '还没有所属团体',
    ]));

    const heroContents = renderer.root.findAllByType(View).filter(
      (node) => node.props.testID === 'artist-hero-content',
    );
    const detailsRegions = renderer.root.findAllByType(View).filter(
      (node) => node.props.testID === 'artist-details-region',
    );
    expect(heroContents).toHaveLength(2);
    expect(detailsRegions).toHaveLength(2);
    expect(heroContents.every((node) => node.props.style.paddingBottom === 8)).toBe(true);
    expect(heroContents.every((node) => node.props.style.transform?.[0]?.translateY === -96)).toBe(true);
    expect(detailsRegions.every((node) => node.props.style.paddingTop === 8)).toBe(true);
    expect(detailsRegions.every((node) => node.props.style.marginTop === -96)).toBe(true);
    expect(renderer.root.findAllByType(ImageBackground).every(
      (node) => node.props.style.transform == null,
    )).toBe(true);

    const tabSwitchers = renderer.root.findAllByType(View).filter(
      (node) => node.props.testID === 'artist-section-tabs',
    );
    expect(tabSwitchers).toHaveLength(2);
    expect(tabSwitchers.every((node) => node.props.style?.position !== 'absolute')).toBe(true);

    const nativeSegmentedControls = renderer.root.findAll(
      (node) => node.props.testID === 'artist-section-segmented-control'
        && Array.isArray(node.props.values)
        && typeof node.props.selectedIndex === 'number',
    );
    expect(nativeSegmentedControls).toHaveLength(2);
    // 每个列表的控件固定显示自己列表的选中项：events 列表显示「活动」，cheki 列表显示「拍立得」。
    expect(nativeSegmentedControls.map((node) => node.props.selectedIndex).sort()).toEqual([0, 1]);
    expect(nativeSegmentedControls.every(
      (node) => node.props.values.join('|') === '活动 · 0|拍立得 · 0',
    )).toBe(true);

    const eventsSegmentedControl = nativeSegmentedControls.find(
      (node) => node.props.selectedIndex === 0,
    );
    expect(eventsSegmentedControl).toBeDefined();

    await act(async () => {
      eventsSegmentedControl!.props.onChange({
        nativeEvent: { selectedSegmentIndex: 1, value: '拍立得 · 0' },
      });
    });

    const switchedSegmentedControls = renderer.root.findAll(
      (node) => node.props.testID === 'artist-section-segmented-control'
        && Array.isArray(node.props.values)
        && typeof node.props.selectedIndex === 'number',
    );
    // 切换后选中项仍按列表固定，不随 activeTab 变化，避免原生组件播放选中动画导致闪烁。
    expect(switchedSegmentedControls.map((node) => node.props.selectedIndex).sort()).toEqual([0, 1]);
  });

  test('splits group memberships into current and past member cards', async () => {
    mockDb.artists.findById.mockResolvedValue({
      id: 'artist-group',
      name: '测试团体',
      short_name: null,
      artist_type: 'group',
      parent_id: null,
      avatar_uri: null,
      background_uri: null,
      background_color: null,
      url: null,
      is_favorite: 0,
      created_at: '2026-08-05T00:00:00.000Z',
    });
    mockDb.artists.findMembers.mockResolvedValue([]);
    mockDb.artists.findCurrentMembers.mockResolvedValue([]);
    mockDb.artists.findMembershipsForGroup.mockResolvedValue([
      {
        id: 'membership-current',
        person_artist_id: 'artist-member-current',
        group_artist_id: 'artist-group',
        start_date: null,
        end_date: null,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        artist: {
          id: 'artist-member-current',
          name: '现役成员',
          short_name: null,
          artist_type: 'person',
          parent_id: 'artist-group',
          avatar_uri: null,
          background_uri: null,
          background_color: null,
          url: null,
          is_favorite: 0,
          created_at: '2026-08-01T00:00:00.000Z',
        },
      },
      {
        id: 'membership-past',
        person_artist_id: 'artist-member-past',
        group_artist_id: 'artist-group',
        start_date: '2020-01-01',
        end_date: '2025-01-01',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        artist: {
          id: 'artist-member-past',
          name: '毕业成员',
          short_name: null,
          artist_type: 'person',
          parent_id: null,
          avatar_uri: null,
          background_uri: null,
          background_color: null,
          url: null,
          is_favorite: 0,
          created_at: '2026-08-01T00:00:00.000Z',
        },
      },
    ]);

    await act(async () => {
      renderer = create(<ArtistDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const moreButtons = renderer.root.findAllByProps({ accessibilityLabel: '更多' });
    await act(async () => {
      moreButtons[0].props.onPress();
    });

    const sheets = renderer.root.findAllByType(View).filter(
      (node) => node.props.testID === 'artist-attributes-sheet',
    );
    expect(sheets).toHaveLength(1);

    const sheetCards = sheets[0].findAllByType(View);
    const currentCard = sheetCards.find((node) => node.props.testID === 'artist-current-members-card');
    const pastCard = sheetCards.find((node) => node.props.testID === 'artist-past-members-card');
    expect(currentCard).toBeDefined();
    expect(pastCard).toBeDefined();
    expect(sheetCards.filter((node) => node.props.testID === 'artist-history-card')).toHaveLength(0);

    expect(textContents(currentCard!)).toEqual(expect.arrayContaining([
      '当前成员',
      '1 位',
      '现役成员',
      '更早 — 至今',
    ]));
    expect(textContents(pastCard!)).toEqual(expect.arrayContaining([
      '历史成员',
      '1 位',
      '毕业成员',
      '2020-01-01 — 2025-01-01',
    ]));
  });
});

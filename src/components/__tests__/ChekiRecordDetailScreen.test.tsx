import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ChekiRecordDetailScreen from '../../../app/cheki/records/[id]/index';

const mockDb = {
  chekiRecords: {
    findRecordById: jest.fn(),
  },
  artists: {
    findById: jest.fn(),
  },
  events: {
    findById: jest.fn(),
  },
};

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  return {
    Stack: { Screen: () => null },
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: () => ({ id: 'record-1' }),
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
  };
});

jest.mock('../../context/DBContext', () => ({
  useDB: () => mockDb,
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#6750a4',
      accentSofter: '#eee8ff',
      card: '#fff',
      cardAlt: '#f5f5f5',
      chevron: '#888',
      danger: '#c00',
      divider: '#ddd',
      heading: '#111',
      onAccent: '#fff',
      screen: '#fafafa',
      scrim: '#222',
      text: '#222',
      textMuted: '#999',
      textSecondary: '#666',
    },
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../ChekiViewerModal', () => ({ ChekiViewerModal: () => null }));
jest.mock('../Oshi', () => {
  const ReactModule = require('react');
  const { Image } = require('react-native');
  return {
    OshiAvatar: ({ source }: { source: { uri: string } | null }) => (
      ReactModule.createElement(Image, {
        testID: 'record-artist-avatar',
        source,
      })
    ),
  };
});

describe('ChekiRecordDetailScreen', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockDb.chekiRecords.findRecordById.mockResolvedValue({
      id: 'record-1',
      event_id: null,
      artist_id: 'artist-1',
      date: '2026-08-05',
      quantity: 1,
      total_price: 100,
      notes: null,
      created_at: '2026-08-05T00:00:00.000Z',
      updated_at: '2026-08-05T00:00:00.000Z',
      items: [],
    });
    mockDb.artists.findById.mockResolvedValue({
      id: 'artist-1',
      name: '测试艺人',
      short_name: null,
      parent_id: null,
      avatar_uri: 'file:///artist-avatar.jpg',
      background_uri: null,
      background_color: null,
      url: null,
      is_favorite: 0,
      created_at: '2026-08-05T00:00:00.000Z',
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.clearAllMocks();
  });

  test('renders the associated artist avatar instead of a generic artist icon', async () => {
    await act(async () => {
      renderer = create(<ChekiRecordDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const avatar = renderer.root.findByProps({ testID: 'record-artist-avatar' });
    expect(avatar.props.source).toEqual({ uri: 'file:///artist-avatar.jpg' });
  });

  test('shows a stable unassociated event label without extra empty-state copy', async () => {
    await act(async () => {
      renderer = create(<ChekiRecordDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const textContent = renderer.root
      .findAllByType(require('react-native').Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toContain('未关联活动');
    expect(textContent).not.toContain('尚未添加图片');
    expect(textContent).not.toContain('可以之后再添加。');
    expect(textContent).not.toContain('还可添加');
    const { TouchableOpacity } = require('react-native');
    const addImageButtons = renderer.root.findAllByType(TouchableOpacity).filter(
      (node) => node.props.accessibilityLabel === '添加图片',
    );
    expect(addImageButtons).toHaveLength(1);
  });
});

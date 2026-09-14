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
  userConfig: {
    getConfig: jest.fn(),
  },
};

const baseRecord = {
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
};

let mockDisplayMode: 'portrait' | 'original' = 'portrait';

const mockEventCardProps: { event?: { id: string } }[] = [];

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
    chekiDisplayMode: mockDisplayMode,
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
jest.mock('../EventCard', () => ({
  EventCard: (props: { event: { id: string } }) => {
    mockEventCardProps.push(props);
    return null;
  },
}));
jest.mock('../native-text-toolbar', () => ({ NativeTextToolbar: () => null }));
jest.mock('../Oshi', () => {
  const ReactModule = require('react');
  const { Image } = require('react-native');
  return {
    OshiAvatar: ({ source, isOshi }: { source: { uri: string } | null; isOshi?: boolean }) => (
      ReactModule.createElement(Image, {
        testID: 'record-artist-avatar',
        source,
        isOshi,
      })
    ),
    OshiBadge: () => null,
  };
});

describe('ChekiRecordDetailScreen', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockDisplayMode = 'portrait';
    mockDb.chekiRecords.findRecordById.mockResolvedValue({ ...baseRecord });
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
    mockDb.userConfig.getConfig.mockResolvedValue({ oshi_artist_id: null });
    mockEventCardProps.length = 0;
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.clearAllMocks();
  });

  test.each([0, 1, 2, 3, 4])('square mode keeps the add tile in the wrapping photo grid with %i photos', async (count) => {
    mockDisplayMode = 'original';
    mockDb.chekiRecords.findRecordById.mockResolvedValue({ ...baseRecord, quantity: count + 1,
      items: Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, sort_order: i, spec: 'three_inch_portrait',
        images: [{ side: 'front', photo_uri: `file:///photo-${i}.jpg` }], is_favorite: 0, notes: null })),
    });
    await act(async () => { renderer = create(<ChekiRecordDetailScreen />); });
    const { View, TouchableOpacity } = require('react-native');
    const add = renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === '添加图片')!;
    let grid = add.parent!;
    while (grid.type !== View) grid = grid.parent!;
    expect(grid.props.style).toEqual(expect.objectContaining({ flexDirection: 'row', flexWrap: 'wrap' }));
    const photoButtons = grid.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityRole === 'imagebutton');
    expect(photoButtons).toHaveLength(count);
    for (const photo of photoButtons) {
      let parent = photo.parent!;
      while (parent.props.style?.flexDirection !== 'row') parent = parent.parent!;
      expect(parent.props.style.flexWrap).toBe('wrap');
    }
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

  test('marks the artist avatar as oshi when the artist is the oshi artist', async () => {
    mockDb.userConfig.getConfig.mockResolvedValue({ oshi_artist_id: 'artist-1' });

    await act(async () => {
      renderer = create(<ChekiRecordDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const avatar = renderer.root.findByProps({ testID: 'record-artist-avatar' });
    expect(avatar.props.isOshi).toBe(true);
  });

  test('renders the date with weekday in the overview header', async () => {
    await act(async () => {
      renderer = create(<ChekiRecordDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const textContent = renderer.root
      .findAllByType(require('react-native').Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toContain('2026年8月5日 周三');
  });

  test('hides the activity section when no event is linked', async () => {
    await act(async () => {
      renderer = create(<ChekiRecordDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const textContent = renderer.root
      .findAllByType(require('react-native').Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).not.toContain('关联活动');
    expect(textContent).not.toContain('未关联活动');
    expect(textContent).not.toContain('尚未添加图片');
    expect(textContent).not.toContain('可以之后再添加。');
    expect(textContent).not.toContain('还可添加');
    const { TouchableOpacity } = require('react-native');
    const addImageButtons = renderer.root.findAllByType(TouchableOpacity).filter(
      (node) => node.props.accessibilityLabel === '添加图片',
    );
    expect(addImageButtons).toHaveLength(1);
  });

  test('shows the activity section when an event is linked', async () => {
    mockDb.chekiRecords.findRecordById.mockResolvedValue({ ...baseRecord, event_id: 'event-1' });
    mockDb.events.findById.mockResolvedValue({
      id: 'event-1',
      title: '测试活动',
      event_type: 'concert',
      actual_expense: null,
      event_date: '2026-08-05',
      event_time: null,
      open_time: null,
      start_time: null,
      end_time: null,
      city: null,
      venue: null,
      ticket_price: null,
      status: 'completed',
      review_score: null,
      notes: null,
      details: null,
      url: null,
      setlist_text: null,
      trip_id: null,
      created_at: '2026-08-05T00:00:00.000Z',
      updated_at: '2026-08-05T00:00:00.000Z',
    });

    await act(async () => {
      renderer = create(<ChekiRecordDetailScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const textContent = renderer.root
      .findAllByType(require('react-native').Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toContain('关联活动');
    expect(textContent).not.toContain('未关联活动');
    expect(mockEventCardProps).toHaveLength(1);
    expect(mockEventCardProps[0].event?.id).toBe('event-1');
  });
});

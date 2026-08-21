import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import WeiboFollowingScreen from '../../../app/tools/weibo-following';

const createdArtist = {
  id: 'artist-1',
  name: '测试艺人',
  short_name: null,
  artist_type: null,
  parent_id: null,
  avatar_uri: 'https://example.com/avatar.jpg',
  background_uri: null,
  background_color: null,
  url: 'https://m.weibo.cn/u/123',
  is_favorite: 0,
  created_at: '2026-08-21T00:00:00.000Z',
};

const mockDb = {
  artists: {
    create: jest.fn(),
    findAll: jest.fn(),
  },
};

const mockFetchWeiboFollowingPage = jest.fn();
const mockFetchWeiboUser = jest.fn();
const mockShowFailureAlert = jest.fn();

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { getString: jest.fn().mockResolvedValue('') },
}));

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  return {
    Stack: { Screen: () => null },
    router: { push: jest.fn() },
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../context/DBContext', () => ({
  useDB: () => mockDb,
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));

jest.mock('../../utils/weibo/cookieStore', () => ({
  loadWeiboCookie: jest.fn().mockResolvedValue('cookie'),
}));

jest.mock('../../utils/weibo/fetchFollowing', () => ({
  fetchWeiboFollowingPage: (...args: unknown[]) => mockFetchWeiboFollowingPage(...args),
}));

jest.mock('../../utils/weibo/fetchUser', () => ({
  cleanOfficialSuffix: (value: string) => value,
  fetchWeiboUser: (...args: unknown[]) => mockFetchWeiboUser(...args),
}));

jest.mock('../../utils/failureAlert', () => ({
  showFailureAlert: (...args: unknown[]) => mockShowFailureAlert(...args),
}));

function pressableContaining(root: ReactTestInstance, text: string): ReactTestInstance {
  const label = root.findAllByType(Text).find((node) => node.props.children === text);
  if (!label) throw new Error(`Missing text: ${text}`);

  let current: ReactTestInstance | null = label;
  while (current && typeof current.props.onPress !== 'function') current = current.parent;
  if (!current) throw new Error(`Missing pressable for: ${text}`);
  return current;
}

describe('WeiboFollowingScreen', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.artists.findAll
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('refresh failed'));
    mockDb.artists.create.mockResolvedValue(createdArtist);
    mockFetchWeiboUser.mockResolvedValue({
      ok: true,
      screen_name: '账号主人',
      avatar_url: null,
      following_count: 1,
    });
    mockFetchWeiboFollowingPage.mockResolvedValue({
      ok: true,
      uid: 'owner',
      containerId: 'container',
      users: [{
        id: '123',
        screenName: '测试艺人',
        description: null,
        avatarUrl: 'https://example.com/avatar.jpg',
        profileUrl: 'https://m.weibo.cn/u/123',
      }],
      hasMore: false,
    });
  });

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
  });

  test('keeps successfully created artists marked as existing when refreshing fails', async () => {
    await act(async () => {
      renderer = create(<WeiboFollowingScreen />);
    });

    const input = renderer.root.findByType(TextInput);
    await act(async () => {
      input.props.onChangeText('https://weibo.com/u/owner');
    });
    await act(async () => {
      await input.props.onSubmitEditing();
    });
    await act(async () => {
      pressableContaining(renderer.root, '测试艺人').props.onPress();
    });
    await act(async () => {
      await pressableContaining(renderer.root, '加入艺人数据库（1）').props.onPress();
    });

    expect(mockDb.artists.create).toHaveBeenCalledTimes(1);
    expect(mockShowFailureAlert).toHaveBeenCalledWith(expect.objectContaining({ title: '刷新失败' }));
    expect(renderer.root.findAllByType(Text).some(
      (node) => node.props.children === '已在艺人数据库中',
    )).toBe(true);
  });
});

jest.mock('../cookieBridge', () => ({
  setFetchCookies: jest.fn(),
}));

import { extractWeiboUid, fetchWeiboUser } from '../fetchUser';
import { parseWeiboFollowingResponse } from '../fetchFollowing';
import { findExistingWeiboUserIds } from '../importFollowing';

describe('extractWeiboUid', () => {
  it.each([
    ['https://weibo.com/u/1234567890', '1234567890'],
    ['https://m.weibo.cn/u/1234567890?foo=bar', '1234567890'],
    ['https://weibo.com/1234567890/profile', '1234567890'],
  ])('extracts the uid from %s', (url, expected) => {
    expect(extractWeiboUid(url)).toBe(expected);
  });

  it('rejects links without a numeric uid', () => {
    expect(() => extractWeiboUid('https://weibo.com/example')).toThrow('无法从 URL 解析 UID');
  });
});

describe('fetchWeiboUser', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the profile following count', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      type: 'default',
      json: async () => ({
        ok: 1,
        data: {
          userInfo: {
            screen_name: 'Example User',
            avatar_hd: 'https://example.com/avatar.jpg',
            follow_count: '120',
          },
        },
      }),
    } as Response);

    await expect(fetchWeiboUser('https://m.weibo.cn/u/1234567890', '')).resolves.toEqual({
      ok: true,
      screen_name: 'Example User',
      avatar_url: 'https://example.com/avatar.jpg',
      following_count: 120,
    });
  });

  it('returns null when the profile following count is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      type: 'default',
      json: async () => ({
        ok: 1,
        data: {
          userInfo: {
            screen_name: 'Example User',
          },
        },
      }),
    } as Response);

    const result = await fetchWeiboUser('https://m.weibo.cn/u/1234567890', '');

    expect(result.ok && result.following_count).toBeNull();
  });
});

describe('parseWeiboFollowingResponse', () => {
  it('reads nested card groups and removes duplicate users', () => {
    const users = parseWeiboFollowingResponse({
      ok: 1,
      data: {
        cards: [
          {
            card_group: [
              {
                desc1: '团体账号',
                user: {
                  id: 1234567890,
                  screen_name: 'Example_official',
                  profile_url: '/u/1234567890',
                  avatar_hd: 'https://example.com/avatar.jpg',
                },
              },
              {
                card_group: [
                  {
                    desc2: '<span>个人简介</span>',
                    user: {
                      idstr: '2345678901',
                      screen_name: 'Second User',
                    },
                  },
                  {
                    user: {
                      id: 1234567890,
                      screen_name: 'Example_official',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(users).toEqual([
      {
        id: '1234567890',
        screenName: 'Example_official',
        description: '团体账号',
        avatarUrl: 'https://example.com/avatar.jpg',
        profileUrl: 'https://m.weibo.cn/u/1234567890',
      },
      {
        id: '2345678901',
        screenName: 'Second User',
        description: '个人简介',
        avatarUrl: null,
        profileUrl: 'https://m.weibo.cn/u/2345678901',
      },
    ]);
  });

  it('returns an empty list for malformed responses', () => {
    expect(parseWeiboFollowingResponse({ ok: 1 })).toEqual([]);
    expect(parseWeiboFollowingResponse(null)).toEqual([]);
  });
});

describe('findExistingWeiboUserIds', () => {
  const users = [
    {
      id: '1234567890',
      screenName: 'Example_official',
      description: null,
      avatarUrl: null,
      profileUrl: 'https://m.weibo.cn/u/1234567890',
    },
    {
      id: '2345678901',
      screenName: '名字不同',
      description: null,
      avatarUrl: null,
      profileUrl: 'https://m.weibo.cn/u/2345678901',
    },
    {
      id: '3456789012',
      screenName: 'New Artist',
      description: null,
      avatarUrl: null,
      profileUrl: 'https://m.weibo.cn/u/3456789012',
    },
  ];

  it('matches existing artists by normalized name or Weibo UID', () => {
    const existingIds = findExistingWeiboUserIds(users, [
      {
        id: 'artist-1',
        name: 'Example',
        short_name: null,
        parent_id: null,
        avatar_uri: null,
        background_uri: null,
        background_color: null,
        url: null,
        is_favorite: 0,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'artist-2',
        name: '另一个名字',
        short_name: null,
        parent_id: null,
        avatar_uri: null,
        background_uri: null,
        background_color: null,
        url: 'https://weibo.com/u/2345678901',
        is_favorite: 0,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect([...existingIds]).toEqual(['1234567890', '2345678901']);
  });

  it('does not treat numeric IDs on non-Weibo URLs as Weibo matches', () => {
    const existingIds = findExistingWeiboUserIds(users, [
      {
        id: 'artist-1',
        name: 'Unrelated',
        short_name: null,
        parent_id: null,
        avatar_uri: null,
        background_uri: null,
        background_color: null,
        url: 'https://example.com/u/2345678901',
        is_favorite: 0,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(existingIds.size).toBe(0);
  });
});

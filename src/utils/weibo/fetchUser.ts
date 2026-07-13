import { WEIBO_HEADERS } from './fetchPost';

export type FetchUserResult =
  | {
      ok: true;
      screen_name: string;
      avatar_url: string | null;
      following_count: number | null;
    }
  | { ok: false; kind: 'captcha' | 'error'; message?: string };

const OFFICIAL_RE = /[\s_]?(?:_official|_jp|_cn|_kr|official|Official|公式|オフィシャル)[\s_]?$/;

export function cleanOfficialSuffix(name: string): string {
  let s = name;
  let prev: string;
  do {
    prev = s;
    s = s.replace(OFFICIAL_RE, '').trim();
  } while (s !== prev);
  return s;
}

export function extractWeiboUid(url: string): string {
  const cleaned = url.trim().split('?')[0].split('#')[0];
  const path = cleaned.replace(/^https?:\/\/[^/]+/, '');
  const parts = path.split('/').filter(Boolean);
  const uid = parts.find((p) => /^\d{7,12}$/.test(p));
  if (!uid) throw new Error(`无法从 URL 解析 UID：${url}`);
  return uid;
}

export async function fetchWeiboUser(userUrl: string, cookie: string): Promise<FetchUserResult> {
  let uid: string;
  try {
    uid = extractWeiboUid(userUrl);
  } catch (e: any) {
    return { ok: false, kind: 'error', message: e?.message ?? '解析 URL 失败' };
  }

  const apiUrl = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}`;
  let resp: Response;
  try {
    resp = await fetch(apiUrl, {
      headers: { ...WEIBO_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
    });
  } catch (e: any) {
    return { ok: false, kind: 'error', message: `请求失败：${e?.message ?? e}` };
  }

  if (resp.status === 401 || resp.type === 'opaqueredirect') {
    return { ok: false, kind: 'captcha' };
  }

  let json: any;
  try {
    json = await resp.json();
  } catch (e: any) {
    return { ok: false, kind: 'error', message: '解析响应失败' };
  }

  if (json?.ok === 0) {
    const msg: string = json?.msg ?? '';
    if (msg.includes('login') || msg.includes('登录') || msg.includes('auth')) {
      return { ok: false, kind: 'captcha' };
    }
    return { ok: false, kind: 'error', message: msg || '接口返回错误' };
  }

  const userInfo = json?.data?.userInfo;
  if (!userInfo) {
    return { ok: false, kind: 'error', message: '未找到用户信息，请确认 URL 是否为微博用户主页' };
  }

  const screen_name: string = String(userInfo.screen_name ?? '');
  const avatar_url: string | null =
    userInfo.avatar_hd ?? userInfo.avatar_large ?? userInfo.profile_image_url ?? null;
  const followingCountValue = userInfo.follow_count;
  const rawFollowingCount =
    followingCountValue === null ||
    followingCountValue === undefined ||
    followingCountValue === ''
      ? Number.NaN
      : Number(followingCountValue);
  const following_count = Number.isFinite(rawFollowingCount) && rawFollowingCount >= 0
    ? Math.floor(rawFollowingCount)
    : null;

  return { ok: true, screen_name, avatar_url, following_count };
}

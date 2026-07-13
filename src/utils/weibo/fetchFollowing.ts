import { setFetchCookies } from './cookieBridge';
import { WEIBO_HEADERS } from './fetchPost';
import { extractWeiboUid } from './fetchUser';

export interface WeiboFollowingUser {
  id: string;
  screenName: string;
  description: string | null;
  avatarUrl: string | null;
  profileUrl: string;
}

export type FetchWeiboFollowingResult =
  | {
      ok: true;
      uid: string;
      containerId: string;
      users: WeiboFollowingUser[];
      hasMore: boolean;
    }
  | { ok: false; kind: 'captcha' | 'error'; message?: string };

const REQUEST_TIMEOUT_MS = 15_000;

function stripHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeProfileUrl(value: unknown, uid: string): string {
  const url = String(value ?? '').trim();
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://m.weibo.cn${url}`;
  if (/^https?:\/\//.test(url)) return url;
  return `https://m.weibo.cn/u/${uid}`;
}

function parseUser(card: Record<string, unknown>): WeiboFollowingUser | null {
  const rawUser = card.user;
  if (!rawUser || typeof rawUser !== 'object') return null;

  const user = rawUser as Record<string, unknown>;
  const id = String(user.id ?? user.idstr ?? '').trim();
  const screenName = String(user.screen_name ?? '').trim();
  if (!id || !screenName) return null;

  const description =
    stripHtml(user.description) ||
    stripHtml(card.desc1) ||
    stripHtml(card.desc2) ||
    null;

  const avatarUrl = String(
    user.avatar_hd ?? user.avatar_large ?? user.profile_image_url ?? '',
  ).trim() || null;

  return {
    id,
    screenName,
    description,
    avatarUrl,
    profileUrl: normalizeProfileUrl(user.profile_url, id),
  };
}

function collectUsers(value: unknown, users: Map<string, WeiboFollowingUser>) {
  if (!Array.isArray(value)) return;

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const card = item as Record<string, unknown>;
    const user = parseUser(card);
    if (user && !users.has(user.id)) users.set(user.id, user);
    collectUsers(card.card_group, users);
  }
}

export function parseWeiboFollowingResponse(value: unknown): WeiboFollowingUser[] {
  if (!value || typeof value !== 'object') return [];
  const data = (value as Record<string, unknown>).data;
  if (!data || typeof data !== 'object') return [];

  const users = new Map<string, WeiboFollowingUser>();
  const record = data as Record<string, unknown>;
  collectUsers(record.cards, users);
  collectUsers(record.card_group, users);
  return [...users.values()];
}

function isAuthenticationMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('login') ||
    normalized.includes('auth') ||
    normalized.includes('登录') ||
    normalized.includes('验证') ||
    normalized.includes('访问频次')
  );
}

async function requestFollowingContainer(
  containerId: string,
  page: number,
  cookie: string,
): Promise<
  | { kind: 'success'; users: WeiboFollowingUser[] }
  | { kind: 'captcha' }
  | { kind: 'error'; message: string }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({
      containerid: containerId,
      page: String(page),
    });
    const response = await fetch(`https://m.weibo.cn/api/container/getIndex?${query}`, {
      headers: { ...WEIBO_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
      signal: controller.signal,
    });

    if ([401, 403, 418, 432].includes(response.status) || response.type === 'opaqueredirect') {
      return { kind: 'captcha' };
    }
    if (!response.ok) {
      return { kind: 'error', message: `微博接口返回 HTTP ${response.status}` };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { kind: 'error', message: '微博返回了无法解析的数据' };
    }

    const record = json && typeof json === 'object' ? json as Record<string, unknown> : null;
    if (record?.ok === 0) {
      const message = String(record.msg ?? '');
      return isAuthenticationMessage(message)
        ? { kind: 'captcha' }
        : { kind: 'error', message: message || '微博接口返回错误' };
    }

    return { kind: 'success', users: parseWeiboFollowingResponse(json) };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { kind: 'error', message: '请求超时，请检查网络后重试' };
    }
    return {
      kind: 'error',
      message: `请求失败：${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWeiboFollowingPage({
  userUrl,
  cookie,
  page,
  containerId,
}: {
  userUrl: string;
  cookie: string;
  page: number;
  containerId?: string;
}): Promise<FetchWeiboFollowingResult> {
  let uid: string;
  try {
    uid = extractWeiboUid(userUrl);
  } catch (error) {
    return {
      ok: false,
      kind: 'error',
      message: error instanceof Error ? error.message : '无法解析微博用户链接',
    };
  }

  try {
    if (cookie) await setFetchCookies(cookie);
  } catch {
    // The explicit Cookie header below remains the source of truth.
  }

  const candidates = containerId
    ? [containerId]
    : [
        `231051_-_followers_-_${uid}`,
        `231051_-_followersrecomm_-_${uid}`,
      ];
  let emptyResult: { containerId: string; users: WeiboFollowingUser[] } | null = null;

  for (const candidate of candidates) {
    const result = await requestFollowingContainer(candidate, page, cookie);
    if (result.kind === 'captcha') return { ok: false, kind: 'captcha' };
    if (result.kind === 'error') {
      if (containerId || candidate === candidates[candidates.length - 1]) {
        return { ok: false, kind: 'error', message: result.message };
      }
      continue;
    }
    if (result.users.length > 0) {
      return {
        ok: true,
        uid,
        containerId: candidate,
        users: result.users,
        hasMore: true,
      };
    }
    emptyResult = { containerId: candidate, users: result.users };
  }

  return {
    ok: true,
    uid,
    containerId: emptyResult?.containerId ?? candidates[0],
    users: [],
    hasMore: false,
  };
}

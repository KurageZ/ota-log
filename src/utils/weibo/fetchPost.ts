import { setFetchCookies } from './cookieBridge';
import type { FetchResult, WeiboPost } from '../../types/weibo';

export const WEIBO_HEADERS: Record<string, string> = {
  Referer: 'https://m.weibo.cn/',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
};

export const WEIBO_URL_RE = /^https?:\/\/(m\.)?weibo\.(cn|com)\//;

export function extractBid(url: string): string {
  const cleaned = url.split('?')[0].split('#')[0];
  const path = cleaned.replace(/^https?:\/\/[^/]+/, '');
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) throw new Error(`无法从 URL 解析 bid：${url}`);
  return parts[parts.length - 1];
}

function captchaUrlFor(bid: string): string {
  const target = encodeURIComponent(`https://m.weibo.cn/detail/${bid}`);
  return `https://passport.weibo.cn/sso/signin?entry=mweibo&r=${target}`;
}

function looksLikeLoginPage(html: string): boolean {
  if (!html) return true;
  const lower = html.slice(0, 2000).toLowerCase();
  return (
    (lower.includes('passport.weibo') && lower.includes('login')) ||
    lower.includes('sina visitor system') ||
    lower.includes('请输入验证码')
  );
}

function extractStatusJson(html: string): unknown {
  const start = html.indexOf('"status":');
  if (start === -1) return null;
  let body = html.slice(start);
  const callIdx = body.lastIndexOf('"call"');
  if (callIdx !== -1) body = body.slice(0, callIdx);
  const lastComma = body.lastIndexOf(',');
  if (lastComma !== -1) body = body.slice(0, lastComma);
  try {
    const parsed = JSON.parse(`{${body}}`);
    return (parsed as Record<string, unknown>).status ?? null;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeUrl(href: string): string {
  if (!href) return '';
  const h = href.trim();
  if (h.startsWith('//')) return 'https:' + h;
  if (h.startsWith('/')) return 'https://m.weibo.cn' + h;
  const sinaurl = h.match(/sinaurl[^?]*\?u=([^&]+)/);
  if (sinaurl) {
    try {
      return decodeURIComponent(sinaurl[1]);
    } catch {
      return h;
    }
  }
  return h;
}

const IMG_RE = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i;

function toInt(v: unknown): number {
  if (typeof v === 'number') return Math.trunc(v);
  const s = String(v ?? '');
  if (s.endsWith('万+')) return parseInt(s.slice(0, -2), 10) * 10000;
  if (s.endsWith('万')) return Math.trunc(parseFloat(s.slice(0, -1)) * 10000);
  if (s.endsWith('亿')) return Math.trunc(parseFloat(s.slice(0, -1)) * 100000000);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

export function parsePost(weiboInfo: Record<string, any>): WeiboPost {
  const user = weiboInfo.user || {};
  const rawText: string = weiboInfo.text ?? '';

  const pics: string[] = [];
  for (const p of weiboInfo.pics || []) {
    if (!p || typeof p !== 'object') continue;
    if (p.type === 'video') continue;
    const url = p?.large?.url ?? '';
    if (url) {
      pics.push(url.replace(/\/(mw\d+|bmiddle|thumb\d+|orj\d+|woriginal)\//, '/large/'));
    }
  }

  const links: string[] = [];
  const at_users: string[] = [];
  const topics: string[] = [];

  const anchorRe = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(rawText)) !== null) {
    const attrs = m[1];
    const innerHtml = m[2];
    const innerText = stripTags(innerHtml);
    const hrefMatch = attrs.match(/href\s*=\s*"([^"]*)"/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href.startsWith('/n/') || href.startsWith('#')) {
      // @mention or topic link
      if (innerText.startsWith('@')) {
        const name = innerText.slice(1);
        if (name && !at_users.includes(name)) at_users.push(name);
      }
      continue;
    }
    if (innerText.length > 2 && innerText.startsWith('#') && innerText.endsWith('#')) {
      const tag = innerText.slice(1, -1);
      if (!topics.includes(tag)) topics.push(tag);
      continue;
    }
    const norm = normalizeUrl(href);
    if (!norm) continue;
    if (IMG_RE.test(norm)) {
      if (!pics.includes(norm)) pics.push(norm);
    } else if (!links.includes(norm)) {
      links.push(norm);
    }
  }

  // hashtags from <span class="surl-text">#tag#</span>
  const spanRe = /<span\s+class="surl-text">([\s\S]*?)<\/span>/gi;
  while ((m = spanRe.exec(rawText)) !== null) {
    const t = stripTags(m[1]);
    if (t.length > 2 && t.startsWith('#') && t.endsWith('#')) {
      const tag = t.slice(1, -1);
      if (!topics.includes(tag)) topics.push(tag);
    }
  }

  // video extraction
  const video_urls: string[] = [];
  for (const p of weiboInfo.pics || []) {
    if (p && typeof p === 'object' && p.type === 'video' && p.videoSrc) {
      video_urls.push(p.videoSrc);
    }
  }
  if (video_urls.length === 0) {
    const pageInfo = weiboInfo.page_info || {};
    if (pageInfo.type === 'video') {
      const media = pageInfo.urls || pageInfo.media_info || {};
      const url =
        media.mp4_720p_mp4 ||
        media.mp4_hd_mp4 ||
        media.mp4_hd_url ||
        media.hevc_mp4_hd ||
        media.mp4_sd_url ||
        media.mp4_ld_mp4 ||
        media.stream_url_hd ||
        media.stream_url;
      if (url) video_urls.push(url);
    }
  }

  const post: WeiboPost = {
    id: Number(weiboInfo.id ?? 0),
    bid: String(weiboInfo.bid ?? ''),
    user_id: String(user.id ?? ''),
    screen_name: String(user.screen_name ?? ''),
    text: stripTags(rawText),
    pics,
    video_urls,
    live_photo_urls: Array.isArray(weiboInfo.live_photo) ? weiboInfo.live_photo : [],
    links,
    topics,
    at_users,
    created_at: String(weiboInfo.created_at ?? ''),
    source: stripTags(String(weiboInfo.source ?? '')),
    likes: toInt(weiboInfo.attitudes_count ?? 0),
    comments: toInt(weiboInfo.comments_count ?? 0),
    reposts: toInt(weiboInfo.reposts_count ?? 0),
  };

  if (weiboInfo.retweeted_status) {
    post.retweet = parsePost(weiboInfo.retweeted_status);
  }

  return post;
}

async function fetchWithCookie(url: string, cookie: string, manualRedirect: boolean): Promise<Response> {
  const headers: Record<string, string> = { ...WEIBO_HEADERS };
  if (cookie) headers.Cookie = cookie;
  return fetch(url, {
    method: 'GET',
    headers,
    redirect: manualRedirect ? 'manual' : 'follow',
  });
}

export async function fetchWeiboPost(url: string, cookie: string): Promise<FetchResult> {
  let bid: string;
  try {
    bid = extractBid(url);
  } catch (e: any) {
    return { ok: false, kind: 'error', message: e?.message ?? '解析 URL 失败' };
  }

  // best-effort cookie sync to fetch jar (legacy interop on new arch may no-op)
  try {
    if (cookie) await setFetchCookies(cookie);
  } catch {
    /* ignore */
  }

  // Warmup
  try {
    await fetchWithCookie('https://m.weibo.cn/', cookie, false);
  } catch {
    /* warmup is optional */
  }

  const detailUrl = `https://m.weibo.cn/detail/${bid}`;
  let resp: Response;
  try {
    resp = await fetchWithCookie(detailUrl, cookie, true);
  } catch (e: any) {
    return { ok: false, kind: 'error', message: `请求失败：${e?.message ?? e}` };
  }

  // Detect redirect / verification
  if (
    resp.type === 'opaqueredirect' ||
    resp.status === 301 ||
    resp.status === 302 ||
    (resp.status === 0 && resp.type !== 'basic')
  ) {
    const location = resp.headers?.get?.('location') || '';
    const captchaUrl = location || captchaUrlFor(bid);
    return { ok: false, kind: 'captcha', captchaUrl };
  }

  let html: string;
  try {
    html = await resp.text();
  } catch (e: any) {
    return { ok: false, kind: 'error', message: `读取响应失败：${e?.message ?? e}` };
  }

  if (!html || looksLikeLoginPage(html)) {
    return { ok: false, kind: 'captcha', captchaUrl: captchaUrlFor(bid) };
  }

  const status = extractStatusJson(html);
  if (!status || typeof status !== 'object') {
    // last resort – Weibo may return JSON endpoint via different path; surface as captcha
    if (html.includes('passport') || html.includes('login') || html.includes('Sina Visitor System')) {
      return { ok: false, kind: 'captcha', captchaUrl: captchaUrlFor(bid) };
    }
    return {
      ok: false,
      kind: 'error',
      message: '页面中未找到 status JSON。可能 cookie 失效或页面结构变化。',
    };
  }

  try {
    const post = parsePost(status as Record<string, any>);
    return { ok: true, post, rawJson: status };
  } catch (e: any) {
    return { ok: false, kind: 'error', message: `解析失败：${e?.message ?? e}` };
  }
}

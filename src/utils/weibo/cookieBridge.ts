import CookieManager, { Cookie } from '@react-native-cookies/cookies';

const WEIBO_DOMAINS = [
  'https://m.weibo.cn',
  'https://passport.weibo.cn',
  'https://weibo.com',
  'https://weibo.cn',
];

export function parseCookieString(cookie: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of cookie.split(';')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function stringifyCookies(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function setFetchCookies(cookie: string): Promise<void> {
  const map = parseCookieString(cookie);
  for (const url of WEIBO_DOMAINS) {
    for (const [name, value] of Object.entries(map)) {
      const c: Cookie = { name, value, path: '/', domain: extractHostname(url) };
      try {
        await CookieManager.set(url, c, false);
      } catch {
        // best-effort; new arch may reject
      }
    }
  }
}

export async function pullWebViewCookies(url: string): Promise<string> {
  try {
    const map = await CookieManager.get(url, true);
    const result: Record<string, string> = {};
    for (const k of Object.keys(map)) {
      result[k] = map[k].value;
    }
    return stringifyCookies(result);
  } catch {
    return '';
  }
}

export async function clearWeiboCookies(): Promise<void> {
  // Deliberately clear the whole cookie jar here. At the moment this app only
  // persists Weibo login state, and Android cannot reliably delete individual
  // cookies by name. If we add other cookie-backed integrations later, this
  // needs to be revisited and scoped per provider.
  await clearAllCookies(true);
  await clearAllCookies(false);
  await flushCookies();
}

async function pullWeiboCookies(): Promise<string> {
  const result: Record<string, string> = {};

  for (const url of WEIBO_DOMAINS) {
    const cookie = await pullWebViewCookies(url);
    const map = parseCookieString(cookie);
    for (const [name, value] of Object.entries(map)) {
      result[name] = value;
    }
  }

  return stringifyCookies(result);
}

export async function mirrorWebViewToFetch(): Promise<string> {
  const cookie = await pullWeiboCookies();
  if (cookie) await setFetchCookies(cookie);
  return cookie;
}

function extractHostname(url: string): string {
  const m = url.match(/^https?:\/\/([^/]+)/);
  return m ? m[1] : '';
}

async function clearAllCookies(useWebKit: boolean): Promise<void> {
  try {
    await CookieManager.clearAll(useWebKit);
  } catch {
    // ignore best-effort cleanup failures
  }
}

async function flushCookies(): Promise<void> {
  try {
    await CookieManager.flush();
  } catch {
    // ignore unsupported platforms
  }
}

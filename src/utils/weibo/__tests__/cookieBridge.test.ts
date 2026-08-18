import CookieManager from '@react-native-cookies/cookies';
import { mirrorWebViewToFetch, parseCookieString, stringifyCookies } from '../cookieBridge';

jest.mock('@react-native-cookies/cookies', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    clearAll: jest.fn().mockResolvedValue(true),
    flush: jest.fn().mockResolvedValue(true),
  },
}));

const mockGet = CookieManager.get as jest.Mock;

const LOGIN_COOKIES = {
  SUB: { name: 'SUB', value: 'session-token-123' },
  SUBP: { name: 'SUBP', value: '0033' },
  XSRF_TOKEN: { name: 'XSRF_TOKEN', value: 'csrf-456' },
};

describe('cookie string helpers', () => {
  it('round-trips a cookie string without losing values', () => {
    const raw = 'SUB=session-token-123; SUBP=0033; _T_WM=wm-value';
    expect(stringifyCookies(parseCookieString(raw))).toBe(raw);
  });
});

describe('mirrorWebViewToFetch (iOS)', () => {
  afterEach(() => {
    mockGet.mockReset();
  });

  it('reads the login cookie from the persistent WebKit store', async () => {
    // WebView with the default (persistent) WKWebsiteDataStore: CookieManager.get(url, true)
    // sees the cookies the WebView just set.
    mockGet.mockImplementation(async (_url: string, useWebKit: boolean) => {
      if (useWebKit) return { ...LOGIN_COOKIES };
      return {};
    });

    const cookie = await mirrorWebViewToFetch();

    expect(cookie).toContain('SUB=session-token-123');
    expect(cookie).toContain('SUBP=0033');
  });

  it('reads cookies mirrored into the Foundation store when the WebView uses an ephemeral store', async () => {
    // cacheEnabled={false} makes react-native-webview use a non-persistent store, which
    // CookieManager.get(url, true) cannot see; react-native-webview mirrors those cookies
    // into NSHTTPCookieStorage, so CookieManager.get(url, false) must be consulted too.
    mockGet.mockImplementation(async (_url: string, useWebKit: boolean) => {
      if (useWebKit) return {};
      return { ...LOGIN_COOKIES };
    });

    const cookie = await mirrorWebViewToFetch();

    expect(cookie).toContain('SUB=session-token-123');
  });

  it('keeps polling while the cookie store is still settling', async () => {
    jest.useFakeTimers();
    let calls = 0;
    mockGet.mockImplementation(async () => {
      calls += 1;
      // First full pass across all domains returns nothing; the store catches up later.
      return calls <= 8 ? {} : { ...LOGIN_COOKIES };
    });

    const promise = mirrorWebViewToFetch();
    await jest.advanceTimersByTimeAsync(2500);
    const cookie = await promise;

    expect(cookie).toContain('SUB=session-token-123');
  });
});

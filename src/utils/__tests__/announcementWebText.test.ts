import { fetch as expoFetch } from 'expo/fetch';
import { extractAnnouncementWebText, fetchAnnouncementText, isAnnouncementUrl } from '../announcementWebText';
import { parseAnnouncement } from '../parseAnnouncement';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

// Reduced HTML fixture preserving the supplied page's labels, links and noisy sections.
const html = `
<head><title>Site</title></head><nav>Another LIVE 2025-01-01</nav>
<h2>演出详情</h2><h1>Poppin&#x27;Party×Roselia 合同ライブ「DREAMS GO ON」</h1>
<dl><dt>日期</dt><dd>2026-05-03 18:00 (JST)</dd>
<dt>会场</dt><dd><a>有明アリーナ</a><a>地图 ↗</a></dd>
<dt>备注</dt><dd>開場16:30 / 開演18:00</dd></dl>
<h2>出演艺人</h2><ul><li><a><span>Poppin'Party</span><span>出演</span></a></li>
<li><a><span>Roselia</span><span>出演</span></a></li></ul>
<h2>持这些碟的抽選券可参加</h2>
<p>official_live</p><h2>贩售地点</h2><p>有明アリーナ サブアリーナ内</p>
<p>・信用卡结算【VISA/Mastercard/JCB/Diners/AmericanExpress/Discover】</p>
<p>ネームキーホルダー ¥990(含税)先行贩卖售罄</p>
<p>¥990(含税)</p><p>タオル ¥3300(含税)</p><script>"fake event"</script><footer>Footer LIVE 2024</footer>`;

describe('ordinary announcement sources', () => {
  afterEach(() => { jest.clearAllMocks(); jest.useRealTimers(); });

  test('only treats a standalone HTTP(S) URL as a link', () => {
    expect(isAnnouncementUrl('https://example.com/event?id=1')).toBe(true);
    expect(isAnnouncementUrl('HTTP://example.com/event')).toBe(true);
    for (const input of ['https://', 'file:///tmp/event', '公告 https://example.com', 'https://example.com\n开演18:00']) {
      expect(isAnnouncementUrl(input)).toBe(false);
    }
  });

  test('preserves field boundaries and uses the same parser as pasted text', () => {
    const text = extractAnnouncementWebText(html);
    expect(text).not.toMatch(/Another LIVE|fake event|Footer LIVE/);
    expect(text).toContain('会场\n有明アリーナ\n地图');
    const parsed = parseAnnouncement(text);
    expect(parsed).toMatchObject({
      title: "Poppin'Party×Roselia 合同ライブ「DREAMS GO ON」",
      event_date: '2026-05-03', open_time: '16:30', start_time: '18:00',
      venue: '有明アリーナ', ticket_price: null,
    });
    expect(parsed.artist_mentions.map((artist) => artist.rawName)).toEqual(["Poppin'Party", 'Roselia']);
  });

  test('keeps explicitly labeled tax-inclusive admission prices', () => {
    expect(parseAnnouncement('LIVE\n一般票 ¥3500(税込)').ticket_price).toBe(3500);
  });

  test('decodes entities after stripping markup', () => {
    expect(extractAnnouncementWebText('<p>A&amp;B&nbsp;&#39; &#x1F3B5; &lt;LIVE&gt;</p><br><p>Next</p>'))
      .toBe("A&B ' 🎵 <LIVE>\nNext");
  });

  function mockResponse(body: string, contentType = 'text/html', status = 200) {
    const reader = {
      read: jest.fn().mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(body) }).mockResolvedValue({ done: true }),
      cancel: jest.fn(), releaseLock: jest.fn(),
    };
    jest.mocked(expoFetch).mockResolvedValue({
      ok: status === 200, status, headers: { get: () => contentType },
      body: { getReader: () => reader },
    } as unknown as Awaited<ReturnType<typeof expoFetch>>);
    return reader;
  }

  test('fetches HTML without site credentials and accepts plain text', async () => {
    mockResponse(html);
    await expect(fetchAnnouncementText('https://example.com')).resolves.toBe(extractAnnouncementWebText(html));
    expect(expoFetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ credentials: 'omit' }));
    mockResponse('  LIVE\n開演18:00  ', 'text/plain; charset=utf-8');
    await expect(fetchAnnouncementText('https://example.com')).resolves.toBe('LIVE\n開演18:00');
  });

  test('reports HTTP, unsupported content and empty response errors', async () => {
    mockResponse('', 'text/html', 403);
    await expect(fetchAnnouncementText('https://example.com')).rejects.toThrow('HTTP 403');
    mockResponse('binary', 'image/png');
    await expect(fetchAnnouncementText('https://example.com')).rejects.toThrow('网页或纯文本');
    mockResponse('<script>render()</script>');
    await expect(fetchAnnouncementText('https://example.com')).rejects.toThrow('没有可读取的正文');
  });

  test('cancels oversized bodies and releases the reader', async () => {
    const reader = mockResponse('x'.repeat(3_000_001));
    await expect(fetchAnnouncementText('https://example.com')).rejects.toThrow('网页过大');
    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  test('aborts a stalled request', async () => {
    jest.useFakeTimers();
    jest.mocked(expoFetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const result = expect(fetchAnnouncementText('https://example.com')).rejects.toThrow('aborted');
    jest.advanceTimersByTime(15_000);
    await result;
  });
});

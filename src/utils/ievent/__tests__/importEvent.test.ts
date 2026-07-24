import {
  fetchImportedEvent,
  IEVENT_URL_RE,
  parseImportedEventPage,
} from '../importEvent';

const sourceUrl = 'https://ievent.life/event/10365';

const performerNames = [
  'Arena',
  'Ame',
  'Astoria',
  'ANNYX',
  'EMBEFUSE',
  'F1owSec',
  'idolzoo',
  'Misology',
  'ReRa',
  'solamente',
  'SUSURRO',
  'Starling椋鸟镜辉',
  'Token',
  '花与心事Affloret',
  '华乐神应纪',
  '火山残响 VolcanoEcho',
  '幻夢YUMEUTSUTSU',
  '碎夜瑠璃LapisLazuli',
  '她蝶效应Psychelles',
  ' 蛋黄派Sizzle',
  '砂糖心跳DokiDoki',
  '小熊水滴',
  '月令时Mirage',
];

function buildOriginalEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 10365,
    title: 'YGG IDOL Fes -麻乐栖&猫猫虫生日SP-',
    cover: 'https://image.ievent.life/cover/event.jpg',
    description: '本场演出禁止一切形式的摄影摄像，谢谢大家的理解与配合。',
    date: '2026-07-25',
    currency: 'CNY',
    props: {
      openTime: [{ value: '10:45' }],
      startTime: [{ value: '11:00' }],
      price: [
        {
          value: '预售票 | 78',
          property_addition: {
            ticket_name: '预售票',
            price: 78,
            benefit: '+1d（15元）,本场活动1d含饮料券',
          },
        },
        {
          value: '当日票 | 98',
          property_addition: {
            ticket_name: '当日票',
            price: 98,
            benefit: '+1d（15元）,本场活动1d含饮料券',
          },
        },
      ],
      officialSite: [{ value: 'https://weibo.com/7925328421/Ra2QY3Yzy' }],
    },
    persons: performerNames.map((name, index) => ({ pid: index + 1, name })),
    locations: [{
      location_id: 418,
      area_code: '310100',
      address: '黄浦区南京东路800号第一百货C馆7楼',
      name: '世界树剧场一号馆',
    }],
    tags: [
      { tag_id: 2, name: '拼盘演出' },
      { tag_id: 5, name: '地下偶像' },
      { tag_id: 9, name: '偶像' },
    ],
    ...overrides,
  };
}

function flightHtml(event: Record<string, unknown>): string {
  const eventId = event.event_id;
  const payload =
    `6:["$","component",null,{"value":{"fallback":{`
    + `"@\\"/Event/find\\",${eventId},":${JSON.stringify(event)}`
    + '}}}]';
  return `<script>self.__next_f.push(${JSON.stringify([1, payload])})</script>`;
}

function jsonLdHtml(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

function streamingResponse(
  chunks: Uint8Array[],
  options: {
    status?: number;
    url?: string;
    contentLength?: string | null;
  } = {},
): Response {
  let index = 0;
  const reader = {
    read: jest.fn(async () => (
      index < chunks.length
        ? { done: false as const, value: chunks[index++] }
        : { done: true as const, value: undefined }
    )),
    cancel: jest.fn(async () => undefined),
    releaseLock: jest.fn(),
  };
  return {
    ok: (options.status ?? 200) >= 200 && (options.status ?? 200) < 300,
    status: options.status ?? 200,
    url: options.url ?? sourceUrl,
    headers: {
      get: () => options.contentLength ?? null,
    },
    body: {
      getReader: () => reader,
    },
  } as unknown as Response;
}

describe('parseImportedEventPage', () => {
  test('projects the reference activity through the existing draft contract', () => {
    const parsed = parseImportedEventPage(flightHtml(buildOriginalEvent()), sourceUrl);

    expect(parsed).not.toBeNull();
    expect(parsed?.sourceUrl).toBe(sourceUrl);
    expect(parsed?.coverUrl).toBe('https://image.ievent.life/cover/event.jpg');
    expect(parsed?.parsed).toMatchObject({
      title: 'YGG IDOL Fes -麻乐栖&猫猫虫生日SP-',
      event_date: '2026-07-25',
      event_time: '11:00',
      city: '上海',
      venue: '世界树剧场一号馆',
      ticket_price: 93,
    });
    expect(parsed?.parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      ...performerNames.slice(0, 19),
      '蛋黄派Sizzle',
      ...performerNames.slice(20),
    ]);
    expect(parsed?.details).toBe(
      '本场演出禁止一切形式的摄影摄像，谢谢大家的理解与配合。\n\n'
      + '开场：10:45\n'
      + '开演：11:00\n'
      + '票价：预售票 ¥78 / 当日票 ¥98\n'
      + '入场附加：1D ¥15\n'
      + '最低实际支出：¥93\n'
      + '场地地址：黄浦区南京东路800号第一百货C馆7楼\n'
      + '标签：拼盘演出、地下偶像、偶像\n'
      + '官方链接：https://weibo.com/7925328421/Ra2QY3Yzy',
    );
  });

  test('uses JSON-LD whitelist fields when original data is unavailable', () => {
    const html = jsonLdHtml({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: '降级活动',
      description: '不应导入的搜索摘要',
      startDate: '2026-08-02T18:30:00+08:00',
      endDate: '2026-08-02T20:30:00+08:00',
      image: 'https://image.ievent.life/cover/fallback.jpg',
      location: {
        '@type': 'Place',
        name: '上海测试剧场',
        address: '上海市黄浦区测试路1号',
      },
      performer: [
        { '@type': 'Person', name: '测试艺人A' },
        { '@type': 'Person', name: '测试艺人B' },
      ],
    });

    const parsed = parseImportedEventPage(html, sourceUrl);

    expect(parsed?.parsed).toMatchObject({
      title: '降级活动',
      event_date: '2026-08-02',
      event_time: '18:30',
      city: '上海',
      venue: '上海测试剧场',
      ticket_price: null,
    });
    expect(parsed?.coverUrl).toBe('https://image.ievent.life/cover/fallback.jpg');
    expect(parsed?.parsed.artist_mentions.map((mention) => mention.rawName))
      .toEqual(['测试艺人A', '测试艺人B']);
    expect(parsed?.details).not.toContain('20:30');
    expect(parsed?.details).not.toContain('搜索摘要');
  });

  test('derives fallback city from a structured postal address', () => {
    const html = jsonLdHtml({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: '结构化地址活动',
      startDate: '2026-08-02T18:30:00+08:00',
      location: {
        '@type': 'Place',
        name: '测试剧场',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '测试路1号',
          addressLocality: '上海市',
        },
      },
    });

    const parsed = parseImportedEventPage(html, sourceUrl);

    expect(parsed?.parsed.city).toBe('上海');
    expect(parsed?.details).toContain('场地地址：测试路1号');
  });

  test('lower-priority data only fills missing original fields', () => {
    const original = buildOriginalEvent({
      title: '原始标题',
      cover: '',
      props: {
        openTime: [{ value: '17:00' }],
        startTime: [],
        price: [],
        officialSite: [],
      },
    });
    const fallback = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: '降级标题',
      startDate: '2026-07-25T18:00:00+08:00',
      image: 'https://image.ievent.life/cover/fallback.jpg',
      location: {
        '@type': 'Place',
        name: '错误场地',
        address: '北京市测试路1号',
      },
    };

    const parsed = parseImportedEventPage(
      `${flightHtml(original)}${jsonLdHtml(fallback)}`,
      sourceUrl,
    );

    expect(parsed?.parsed.title).toBe('原始标题');
    expect(parsed?.parsed.event_time).toBe('18:00');
    expect(parsed?.parsed.venue).toBe('世界树剧场一号馆');
    expect(parsed?.parsed.city).toBe('上海');
    expect(parsed?.coverUrl).toBe('https://image.ievent.life/cover/fallback.jpg');
  });

  test('falls back to opening time when no start time exists anywhere', () => {
    const original = buildOriginalEvent({
      props: {
        openTime: [{ value: '10:45' }],
        startTime: [],
        price: [],
        officialSite: [],
      },
    });

    const parsed = parseImportedEventPage(flightHtml(original), sourceUrl);

    expect(parsed?.parsed.event_time).toBe('10:45');
    expect(parsed?.details).toContain('开场：10:45');
    expect(parsed?.details).not.toContain('开演：');
  });

  test('does not add optional or ambiguous fees to the minimum price', () => {
    const original = buildOriginalEvent({
      props: {
        openTime: [],
        startTime: [{ value: '11:00' }],
        price: [{
          value: '预售票 | 78',
          property_addition: {
            ticket_name: '预售票',
            price: 78,
            benefit: '可选饮料券15元',
          },
        }],
        officialSite: [],
      },
    });

    const parsed = parseImportedEventPage(flightHtml(original), sourceUrl);

    expect(parsed?.parsed.ticket_price).toBe(78);
    expect(parsed?.details).not.toContain('入场附加');
  });

  test('leaves city and cover empty when neither can be resolved safely', () => {
    const original = buildOriginalEvent({
      cover: 'http://image.ievent.life/cover/insecure.jpg',
      locations: [{
        location_id: 1,
        area_code: '999999',
        address: '测试区测试路1号',
        name: '测试剧场',
      }],
    });

    const parsed = parseImportedEventPage(flightHtml(original), sourceUrl);

    expect(parsed?.parsed.city).toBeNull();
    expect(parsed?.coverUrl).toBeNull();
  });

  test('uses Open Graph only as a title and cover fallback', () => {
    const original = buildOriginalEvent({ title: '', cover: '' });
    const html = `${flightHtml(original)}
      <meta property="og:title" content="OG 活动 | 推活日记">
      <meta content="https://image.ievent.life/cover/og.jpg" property="og:image">`;

    const parsed = parseImportedEventPage(html, sourceUrl);

    expect(parsed?.parsed.title).toBe('OG 活动');
    expect(parsed?.coverUrl).toBe('https://image.ievent.life/cover/og.jpg');
  });

  test('requires title, date, and location for a usable draft', () => {
    const html = jsonLdHtml({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: '信息不足',
      startDate: '2026-08-02T18:30:00+08:00',
    });

    expect(parseImportedEventPage(html, sourceUrl)).toBeNull();
  });
});

describe('fetchImportedEvent', () => {
  test('recognizes only supported activity URL shapes', async () => {
    expect(IEVENT_URL_RE.test(sourceUrl)).toBe(true);
    expect(IEVENT_URL_RE.test('https://ievent.life/event/index')).toBe(false);
    expect(IEVENT_URL_RE.test('http://ievent.life/event/10365')).toBe(false);

    const fetcher = jest.fn();
    await expect(fetchImportedEvent('https://example.com/event/10365', fetcher))
      .resolves.toEqual({ ok: false, message: '链接格式不正确。' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('fetches and parses a supported page', async () => {
    const html = flightHtml(buildOriginalEvent());
    const fetcher = jest.fn(async () => streamingResponse(
      [new TextEncoder().encode(html)],
      { contentLength: String(new TextEncoder().encode(html).byteLength) },
    ));

    const result = await fetchImportedEvent(`${sourceUrl}?from=share`, fetcher);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.parsed.ticket_price).toBe(93);
    expect(fetcher).toHaveBeenCalledWith(
      sourceUrl,
      expect.objectContaining({ method: 'GET', redirect: 'follow' }),
    );
  });

  test('rejects redirects away from the supported host', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      url: 'https://example.com/login',
      headers: { get: () => null },
      text: async () => '',
    } as unknown as Response));

    await expect(fetchImportedEvent(sourceUrl, fetcher)).resolves.toEqual({
      ok: false,
      message: '页面跳转到了不受支持的地址。',
    });
  });

  test('returns a generic failure for HTTP errors', async () => {
    const fetcher = jest.fn(async () => ({
      ok: false,
      status: 503,
      url: sourceUrl,
      headers: { get: () => '0' },
    } as unknown as Response));

    await expect(fetchImportedEvent(sourceUrl, fetcher)).resolves.toEqual({
      ok: false,
      message: '请求失败（HTTP 503）。',
    });
  });

  test('rejects malformed page data', async () => {
    const html = '<script type="application/ld+json">{not json}</script>';
    const fetcher = jest.fn(async () => streamingResponse(
      [new TextEncoder().encode(html)],
      { contentLength: String(new TextEncoder().encode(html).byteLength) },
    ));

    await expect(fetchImportedEvent(sourceUrl, fetcher)).resolves.toEqual({
      ok: false,
      message: '页面中没有找到足够的活动信息。',
    });
  });

  test('aborts requests that exceed the timeout', async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn((_url: string, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
    ));

    const resultPromise = fetchImportedEvent(sourceUrl, fetcher);
    await jest.advanceTimersByTimeAsync(15_000);

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      message: '请求超时。',
    });
    jest.useRealTimers();
  });

  test('cancels a streaming response once it exceeds the byte limit', async () => {
    const response = streamingResponse([new Uint8Array(3_000_001)]);
    const reader = response.body!.getReader();
    const fetcher = jest.fn(async () => response);

    await expect(fetchImportedEvent(sourceUrl, fetcher)).resolves.toEqual({
      ok: false,
      message: '页面内容过大。',
    });
    expect(reader.cancel).toHaveBeenCalled();
  });
});

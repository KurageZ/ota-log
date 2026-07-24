import { fetch as expoFetch } from 'expo/fetch';
import type { ParsedAnnouncement } from '../parseAnnouncement';

const MAX_HTML_LENGTH = 3_000_000;
const REQUEST_TIMEOUT_MS = 15_000;

export const IEVENT_URL_RE = /^https:\/\/(?:www\.)?ievent\.life\/event\/\d+(?:[/?#]|$)/i;

interface SourceTicket {
  name: string;
  price: number;
  mandatoryAddition: number;
  mandatoryAdditionLabel: string | null;
}

interface SourcePerformer {
  name: string;
}

interface SourceEvent {
  title: string | null;
  date: string | null;
  openTime: string | null;
  startTime: string | null;
  description: string | null;
  coverUrl: string | null;
  officialUrl: string | null;
  locationName: string | null;
  address: string | null;
  areaCode: string | null;
  city: string | null;
  tags: string[];
  tickets: SourceTicket[];
  performers: SourcePerformer[];
}

export interface ImportedEventPage {
  sourceUrl: string;
  coverUrl: string | null;
  details: string;
  parsed: ParsedAnnouncement;
}

export type FetchImportedEventResult =
  | { ok: true; event: ImportedEventPage }
  | { ok: false; message: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const CITY_BY_AREA_CODE: Record<string, string> = {
  '110100': '北京',
  '120100': '天津',
  '210100': '沈阳',
  '310100': '上海',
  '320100': '南京',
  '330100': '杭州',
  '370200': '青岛',
  '420100': '武汉',
  '440100': '广州',
  '440300': '深圳',
  '500100': '重庆',
  '510100': '成都',
  '610100': '西安',
  '810000': '香港',
  '820000': '澳门',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => item != null)
    : [];
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asSafeCoverUrl(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'image.ievent.life'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function firstPropValue(props: Record<string, unknown> | null, key: string): string | null {
  return asString(asRecords(props?.[key])[0]?.value);
}

function normalizeEventUrl(input: string): { eventId: number; sourceUrl: string } | null {
  try {
    const url = new URL(input.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:'
      || (hostname !== 'ievent.life' && hostname !== 'www.ievent.life')
    ) {
      return null;
    }
    const match = url.pathname.match(/^\/event\/(\d+)\/?$/);
    if (!match) return null;
    const eventId = Number(match[1]);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) return null;
    return {
      eventId,
      sourceUrl: `https://ievent.life/event/${eventId}`,
    };
  } catch {
    return null;
  }
}

function extractBalancedObject(text: string, start: number): string | null {
  if (start < 0 || text[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function extractOriginalEvent(html: string, eventId: number): Record<string, unknown> | null {
  const scriptPattern =
    /<script\b[^>]*>\s*self\.__next_f\.push\((\[[\s\S]*?\])\)\s*<\/script>/gi;
  const marker = `@\\"/Event/find\\",${eventId},`;

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const payload = JSON.parse(match[1]) as unknown;
      if (!Array.isArray(payload) || typeof payload[1] !== 'string') continue;
      const serialized = payload[1];
      const markerIndex = serialized.indexOf(marker);
      if (markerIndex < 0) continue;
      const objectStart = serialized.indexOf('{', markerIndex + marker.length);
      const rawObject = extractBalancedObject(serialized, objectStart);
      if (!rawObject) continue;
      const event = asRecord(JSON.parse(rawObject));
      if (asNumber(event?.event_id) === eventId) return event;
    } catch {
      // Ignore malformed flight-data chunks and continue to structured fallbacks.
    }
  }

  return null;
}

function findJsonLdEvent(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonLdEvent(item);
      if (found) return found;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;
  const type = record['@type'];
  if (type === 'Event' || (Array.isArray(type) && type.includes('Event'))) return record;
  return findJsonLdEvent(record['@graph']);
}

function extractJsonLdEvent(html: string): Record<string, unknown> | null {
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const event = findJsonLdEvent(JSON.parse(match[1]));
      if (event) return event;
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return null;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractMetaContent(html: string, key: string): string | null {
  const metaPattern = /<meta\b[^>]*>/gi;
  const attributePattern = /([:\w-]+)\s*=\s*(["'])(.*?)\2/gi;

  for (const match of html.matchAll(metaPattern)) {
    const attributes: Record<string, string> = {};
    for (const attribute of match[0].matchAll(attributePattern)) {
      attributes[attribute[1].toLowerCase()] = decodeHtmlAttribute(attribute[3]);
    }
    if (attributes.property === key || attributes.name === key) {
      return asString(attributes.content);
    }
  }

  return null;
}

function parseDateTime(value: string | null): { date: string | null; time: string | null } {
  if (!value) return { date: null, time: null };
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  return {
    date: match?.[1] ?? null,
    time: match?.[2] ?? null,
  };
}

function parseMandatoryAddition(benefit: string | null): {
  amount: number;
  label: string | null;
} {
  if (!benefit) return { amount: 0, label: null };

  const oneDrink = benefit.match(
    /(?:\+\s*)?1\s*d\s*[（(\s]*([0-9]+(?:\.[0-9]+)?)\s*元/iu,
  );
  if (oneDrink) {
    return { amount: Number(oneDrink[1]), label: `1D ¥${formatMoney(Number(oneDrink[1]))}` };
  }

  const explicitAddition = benefit.match(
    /(?:另加|另付|加收|入场(?:需|另需)|入場(?:需|別途))[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*元/iu,
  );
  if (explicitAddition) {
    return {
      amount: Number(explicitAddition[1]),
      label: `¥${formatMoney(Number(explicitAddition[1]))}`,
    };
  }

  return { amount: 0, label: null };
}

function parseTickets(props: Record<string, unknown> | null): SourceTicket[] {
  return asRecords(props?.price).flatMap((ticket): SourceTicket[] => {
    const addition = asRecord(ticket.property_addition);
    const value = asString(ticket.value);
    const name = asString(addition?.ticket_name)
      ?? value?.split('|')[0]?.trim()
      ?? '票价';
    const explicitPrice = asNumber(addition?.price);
    const valuePrice = value?.match(/(?:\||¥|￥)\s*([0-9]+(?:\.[0-9]+)?)/)?.[1];
    const isFree = value != null && /免费|无料|無料/u.test(value);
    const price = explicitPrice ?? asNumber(valuePrice) ?? (isFree ? 0 : null);
    if (price == null || price < 0) return [];
    const benefit = asString(addition?.benefit);
    const mandatory = parseMandatoryAddition(benefit);
    return [{
      name,
      price,
      mandatoryAddition: mandatory.amount,
      mandatoryAdditionLabel: mandatory.label,
    }];
  });
}

function sourceFromOriginal(event: Record<string, unknown> | null): SourceEvent {
  const props = asRecord(event?.props);
  const location = asRecords(event?.locations)[0] ?? null;
  return {
    title: asString(event?.title),
    date: asString(event?.date),
    openTime: firstPropValue(props, 'openTime'),
    startTime: firstPropValue(props, 'startTime'),
    description: asString(event?.description),
    coverUrl: asSafeCoverUrl(event?.cover),
    officialUrl: firstPropValue(props, 'officialSite'),
    locationName: asString(location?.name),
    address: asString(location?.address),
    areaCode: asString(location?.area_code),
    city: null,
    tags: asRecords(event?.tags)
      .map((tag) => asString(tag.name))
      .filter((name): name is string => name != null),
    tickets: parseTickets(props),
    performers: asRecords(event?.persons).flatMap((person): SourcePerformer[] => {
      const name = asString(person.name);
      return name ? [{ name }] : [];
    }),
  };
}

function sourceFromJsonLd(event: Record<string, unknown> | null): SourceEvent {
  const start = parseDateTime(asString(event?.startDate));
  const location = asRecord(event?.location);
  const addressValue = location?.address;
  const addressRecord = asRecord(addressValue);
  const performers = Array.isArray(event?.performer)
    ? asRecords(event?.performer)
    : asRecord(event?.performer) ? [asRecord(event?.performer)!] : [];

  return {
    title: asString(event?.name),
    date: start.date,
    openTime: null,
    startTime: start.time,
    description: null,
    coverUrl: Array.isArray(event?.image)
      ? asSafeCoverUrl(event.image[0])
      : asSafeCoverUrl(event?.image),
    officialUrl: null,
    locationName: asString(location?.name),
    address: asString(addressValue) ?? asString(addressRecord?.streetAddress),
    areaCode: null,
    city: asString(addressRecord?.addressLocality) ?? asString(addressRecord?.addressRegion),
    tags: [],
    tickets: [],
    performers: performers.flatMap((person): SourcePerformer[] => {
      const name = asString(person.name);
      return name ? [{ name }] : [];
    }),
  };
}

function preferPrimary(primary: SourceEvent, fallback: SourceEvent): SourceEvent {
  return {
    title: primary.title ?? fallback.title,
    date: primary.date ?? fallback.date,
    openTime: primary.openTime,
    startTime: primary.startTime ?? fallback.startTime,
    description: primary.description ?? fallback.description,
    coverUrl: primary.coverUrl ?? fallback.coverUrl,
    officialUrl: primary.officialUrl,
    locationName: primary.locationName ?? fallback.locationName,
    address: primary.address ?? fallback.address,
    areaCode: primary.areaCode,
    city: primary.city ?? fallback.city,
    tags: primary.tags.length > 0 ? primary.tags : fallback.tags,
    tickets: primary.tickets.length > 0 ? primary.tickets : fallback.tickets,
    performers: primary.performers.length > 0 ? primary.performers : fallback.performers,
  };
}

function cityFromSource(source: SourceEvent): string | null {
  if (source.city) {
    return source.city.replace(/(?:市|特别行政区)$/u, '').trim() || null;
  }
  if (source.areaCode && CITY_BY_AREA_CODE[source.areaCode]) {
    return CITY_BY_AREA_CODE[source.areaCode];
  }
  const city = source.address?.match(
    /(北京|上海|天津|重庆|广州|深圳|成都|武汉|杭州|南京|西安|沈阳|青岛|香港|澳门)(?:市|特别行政区)?/u,
  );
  return city?.[1] ?? null;
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function buildDetails(source: SourceEvent, ticketPrice: number | null): string {
  const sections: string[] = [];
  if (source.description) sections.push(source.description);

  const facts: string[] = [];
  if (source.openTime) facts.push(`开场：${source.openTime}`);
  if (source.startTime) facts.push(`开演：${source.startTime}`);
  if (source.tickets.length > 0) {
    facts.push(`票价：${source.tickets
      .map((ticket) => `${ticket.name} ¥${formatMoney(ticket.price)}`)
      .join(' / ')}`);
  }
  const additions = [...new Set(
    source.tickets
      .map((ticket) => ticket.mandatoryAdditionLabel)
      .filter((label): label is string => label != null),
  )];
  if (additions.length > 0) facts.push(`入场附加：${additions.join(' / ')}`);
  if (ticketPrice != null) facts.push(`最低实际支出：¥${formatMoney(ticketPrice)}`);
  if (source.address) facts.push(`场地地址：${source.address}`);
  if (source.tags.length > 0) facts.push(`标签：${source.tags.join('、')}`);
  if (source.officialUrl) facts.push(`官方链接：${source.officialUrl}`);
  if (facts.length > 0) sections.push(facts.join('\n'));

  return sections.join('\n\n');
}

export function parseImportedEventPage(html: string, inputUrl: string): ImportedEventPage | null {
  const normalizedUrl = normalizeEventUrl(inputUrl);
  if (!normalizedUrl || !html || html.length > MAX_HTML_LENGTH) return null;

  const original = sourceFromOriginal(extractOriginalEvent(html, normalizedUrl.eventId));
  const jsonLd = sourceFromJsonLd(extractJsonLdEvent(html));
  const source = preferPrimary(original, jsonLd);
  source.title ??= extractMetaContent(html, 'og:title')?.replace(/\s*\|\s*推活日记\s*$/u, '') ?? null;
  source.coverUrl ??= asSafeCoverUrl(extractMetaContent(html, 'og:image'));

  if (!source.title || !source.date || !source.locationName) return null;

  const ticketPrice = source.tickets.length > 0
    ? Math.min(...source.tickets.map((ticket) => ticket.price + ticket.mandatoryAddition))
    : null;
  const eventTime = source.startTime ?? source.openTime;
  const details = buildDetails(source, ticketPrice);

  return {
    sourceUrl: normalizedUrl.sourceUrl,
    coverUrl: source.coverUrl,
    details,
    parsed: {
      title: source.title,
      event_date: source.date,
      event_time: eventTime,
      city: cityFromSource(source),
      venue: source.locationName,
      artist: null,
      ticket_price: ticketPrice,
      artist_mentions: source.performers.map((performer, order) => ({
        rawName: performer.name,
        source: 'lineup',
        order,
      })),
    },
  };
}

function isAllowedResponseUrl(value: string): boolean {
  if (!value) return true;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'ievent.life' || hostname === 'www.ievent.life';
  } catch {
    return false;
  }
}

class ResponseTooLargeError extends Error {
  constructor() {
    super('页面内容过大。');
    this.name = 'ResponseTooLargeError';
  }
}

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers?.get?.('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ResponseTooLargeError();
  }

  if (!response.body) {
    throw new Error('响应不支持安全读取。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new ResponseTooLargeError();
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock();
  }
}

export async function fetchImportedEvent(
  inputUrl: string,
  fetcher: FetchLike = expoFetch as FetchLike,
): Promise<FetchImportedEventResult> {
  const normalizedUrl = normalizeEventUrl(inputUrl);
  if (!normalizedUrl) {
    return { ok: false, message: '链接格式不正确。' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(normalizedUrl.sourceUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, message: `请求失败（HTTP ${response.status}）。` };
    }
    if (!isAllowedResponseUrl(response.url)) {
      return { ok: false, message: '页面跳转到了不受支持的地址。' };
    }
    const html = await readResponseTextWithLimit(response, MAX_HTML_LENGTH);
    const event = parseImportedEventPage(html, normalizedUrl.sourceUrl);
    return event
      ? { ok: true, event }
      : { ok: false, message: '页面中没有找到足够的活动信息。' };
  } catch (error) {
    const message = error instanceof ResponseTooLargeError
      ? error.message
      : error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)
        ? '请求超时。'
        : `请求失败：${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}

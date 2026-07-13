export type ArtistMentionSource = 'mention' | 'lineup' | 'hashtag' | 'schedule';

export interface ArtistMention {
  rawName: string;
  source: ArtistMentionSource;
  order: number;
}

export interface ParsedAnnouncement {
  title: string | null;
  event_date: string | null;
  event_time: string | null;
  city: string | null;
  venue: string | null;
  artist: string | null;
  ticket_price: number | null;
  artist_mentions: ArtistMention[];
}

export interface ParseAnnouncementOptions {
  referenceYear?: number;
}

function normalizeAnnouncementText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[｜|]/g, ':')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

// Known venue name fragments → city
const VENUE_TO_CITY: Record<string, string> = {
  '育音堂': '上海',
  'MAO': '上海',
  '新歌空间': '上海',
  '世界树剧场': '上海',
  'EchoSpace': '杭州',
  '酒球会': '杭州',
  'KUMOLL': '南京',
  '1701': '南京',
  '幕張': '千葉',
  '武道館': '東京',
  '大阪城': '大阪',
  '横浜アリーナ': '神奈川',
};

const KNOWN_CITIES =
  /东京|大阪|名古屋|福冈|札幌|神户|横滨|京都|仙台|广州|上海|北京|深圳|成都|武汉|杭州|南京|重庆|西安|沈阳|青岛|東京|福岡|神戸|横浜/;

// Venue keywords used for line-based detection
const VENUE_KW =
  /HALL|Hall|ホール|会館|剧场|剧院|アリーナ|Arena|Livehouse|Live\s*House|ライブハウス|Club|CLUB|Theater|THEATER|劇場|音楽堂|音乐厅|体育馆|体育场|商业中心|广场|Venue|Space|酒球会|KUMOLL|[A-Za-z0-9]厅/;

const VIP_LINE = /VIP|SVIP|优先|限定/i;
const NON_TICKET_PRICE_LINE = /抽奖|抽门票|红包|见评论|见评|见详情|转\+?关|抽.*票/i;
const DATE_PREFIX = /(?:\d{2,4}[.．/\-]\d{1,2}[.．/\-]\d{1,2}\s+)?/;
const TITLE_NOISE = /活动情报|主催活动|情报公开|情报|公開|公开|解禁|转抽|抽奖|见评|见评论|ticket|票务|开售|开票/i;
const ARTIST_SECTION_LABEL =
  /(?:GUEST|SIGNAL SOURCE|出演(?:嘉宾|团体)?|出席(?:嘉宾|团体)?|参演(?:嘉宾|团体)?|演出团体|阵容|LINEUP)/i;
const ARTIST_SECTION_STOP =
  /(?:TICKET|票务|门票|特典|SET LIST|时间表|OPEN|START|TIME|PLACE|地点|地址|情报公开|商品|开售|链接|见评论|见评|🎫|VIP|普通\d|一般\d|当日\d|现场\d)/i;
const NON_PERFORMER_LINE =
  /(?:衣装感谢|感谢|联合主催|生日SP|生诞SP|birthday\s*sp|birthday|🎂|抽奖|抽门票|转\+?关|评\+?关|\+評\+关|特典|票务|商品|上架|开售|评论|微博视频|客服|官v|携手|消费|吧台|应援|登记|禁止录像|禁止录音|禁止摄影|入场资格)/i;
const TITLE_PREFERRED =
  /(?:BIRTHDAY|SPECIAL|ONEMAN|TWO MAN|2MAN|TWOMAN|FES|FEST|LIVE|Vol\.?|vol\.?|公演|主催|巡演|茶話会|情报|茶话会)/i;
function normalizeVenueName(venue: string): string {
  return venue
    .replace(/LiveHouse/gi, 'Live House')
    .replace(/c厅/g, 'C厅')
    .replace(/^YGG(?=\S)/, '')
    .replace(/KUMOLL二楼/gi, 'KUMOLL')
    .trim();
}

function cleanVenue(s: string): string {
  const cleaned = s
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/^\d{2,4}[./-]\d{1,2}[./-]\d{1,2}\s*(?:at|AT)\s*/i, '')
    .replace(/^(?:地点|地址|PLACE|place)\s*[:：]\s*/i, '')
    .replace(/^\S+\s+in\s+/i, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();

  const venueCandidateMatch = cleaned.match(
    /(((?:[A-Za-z0-9]+\s+)*[A-Za-z0-9]+)\s*(?:Live\s*House|LiveHouse|Venue|Space|studio)|[A-Za-z0-9]*世界树剧场|[A-Za-z0-9]*育音堂小镇C厅|[A-Za-z0-9]*新歌空间|[A-Za-z0-9]*酒球会|[A-Za-z0-9]*KUMOLL(?:二楼)?|[A-Za-z0-9]*EchoSpace|[A-Za-z0-9]*1701\s*Live\s*House|[^\s,，]+剧场|[^\s,，]+空间|[^\s,，]+C厅)/i,
  );
  if (!venueCandidateMatch) return normalizeVenueName(cleaned);

  return normalizeVenueName(venueCandidateMatch[1]);
}

function findLabeledTime(lines: string[], label: 'open' | 'start'): string | null {
  const labelPattern = label === 'start'
    ? /(?:START|開演|开演|开始|ST)\b/i
    : /(?:OPEN|開場|开场|OP)\b/i;
  const inlinePattern = label === 'start'
    ? /(?:START|開演|开演|开始|ST)\s*[：:\s]*(\d{1,2})[:：](\d{2})|(\d{1,2})[:：](\d{2})\s*(?:START|開演|开演|开始|ST)/i
    : /(?:OPEN|開場|开场|OP)\s*[：:\s]*(\d{1,2})[:：](\d{2})|(\d{1,2})[:：](\d{2})\s*(?:OPEN|開場|开场|OP)/i;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const inline = line.match(inlinePattern);
    if (inline) {
      const hour = inline[1] ?? inline[3];
      const minute = inline[2] ?? inline[4];
      if (hour && minute) return `${hour.padStart(2, '0')}:${minute}`;
    }

    if (!labelPattern.test(line)) continue;

    const nextLine = lines[index + 1]?.trim();
    const nextMatch = nextLine?.match(/^(\d{1,2})[:：](\d{2})$/);
    if (nextMatch) return `${nextMatch[1].padStart(2, '0')}:${nextMatch[2]}`;
  }

  return null;
}

function cleanTitleLine(line: string): string {
  return line
    .replace(/^【[^】]*(?:情报|情報|解禁|公开|公開)[^】]*】\s*/iu, '')
    .replace(/(?:开催决定|正式开催)[！!]*$/u, '')
    .trim();
}

function looksLikeTitleStop(line: string): boolean {
  return /^[^\p{L}\p{N}]*(?:OPEN|START|TIME|PLACE|TICKET|GUEST|SIGNAL SOURCE|出演|出席|参演|阵容|票务|票务情报|票务信息|门票|地点|活动地点|活动场地|地址|演出日期|演出地点|演出时间|演出地址|演出团体|演出场地|活动详情|Live情报|ACKNOWLEDGEMENT)/iu.test(line)
    || /https?:|t\.cn\//i.test(line)
    || /^\d{1,2}[./月]\d{1,2}/.test(line)
    || /^\d{4}[./-]\d{1,2}[./-]\d{1,2}/.test(line)
    || /\d{6,}/.test(line);
}

function stripSectionDecor(line: string): string {
  return normalizeAnnouncementText(line)
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}

function isStageHeading(line: string): boolean {
  const normalized = stripSectionDecor(line);
  return /(?:^|\s)stage$/i.test(normalized)
    && !/[\/／、,，]/.test(normalized)
    && !ARTIST_SECTION_LABEL.test(normalized)
    && !looksLikeTitleStop(normalized);
}

function isVenueLabelOnlyLine(line: string): boolean {
  return /^(?:活动地点|演出地点|演出场地|活动场地|地点|place|venue)$/i.test(stripSectionDecor(line));
}

function isTicketLabelOnlyLine(line: string): boolean {
  return /^(?:票务情报|票务信息|票务|门票|ticket)$/i.test(stripSectionDecor(line));
}

function findVenueLineAfterLabel(lines: string[]): string | null {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isVenueLabelOnlyLine(lines[index])) continue;

    const nextLine = lines[index + 1]?.trim();
    if (!nextLine || isStageHeading(nextLine) || isTicketLabelOnlyLine(nextLine)) continue;

    const followingLine = lines[index + 2]?.trim();
    const nextLooksLikeAddress = KNOWN_CITIES.test(nextLine) || /路\d+号|大道|街道|大厦|中心|广场|B\d|L\d/i.test(nextLine);
    if (
      nextLooksLikeAddress &&
      followingLine &&
      !isStageHeading(followingLine) &&
      !isTicketLabelOnlyLine(followingLine) &&
      !looksLikeTitleStop(stripSectionDecor(followingLine)) &&
      VENUE_KW.test(cleanVenue(followingLine))
    ) {
      return followingLine;
    }

    return nextLine;
  }

  return null;
}

function findFirstStageSplitIndex(lines: string[]): number | null {
  const stageIndexes = lines
    .map((line, index) => (isStageHeading(line) ? index : -1))
    .filter((index) => index >= 0);
  if (stageIndexes.length < 2) return null;

  const firstStageIndex = stageIndexes[0];
  const secondStageIndex = stageIndexes[1];
  const firstStageBlock = lines.slice(firstStageIndex + 1, secondStageIndex);
  const hasStructuredContent = firstStageBlock.some((line) =>
    ARTIST_SECTION_LABEL.test(line)
    || isVenueLabelOnlyLine(line)
    || isTicketLabelOnlyLine(line),
  );

  return hasStructuredContent ? secondStageIndex : null;
}

function shouldSkipArtistLine(line: string): boolean {
  return NON_PERFORMER_LINE.test(line);
}

function isArtistSubsectionLabel(line: string): boolean {
  return /^(?:[^\p{L}\p{N}]*)?(?:生日SP|生诞SP|birthday\s*sp|birthday)\s*[:：]?$/iu.test(line.trim());
}

function looksLikeVenueDetailLine(line: string): boolean {
  const normalized = stripSectionDecor(line);
  if (!normalized) return false;
  if (isVenueLabelOnlyLine(normalized)) return true;
  if (/^(?:活动地点|演出地点|演出场地|活动场地|地点|地址|place|venue)\s*[:：]?/i.test(normalized)) {
    return true;
  }

  return !normalized.includes('@') && (
    /(?:市|区|县).*(?:路|街|大道|广场|中心|大厦|栋|楼)/u.test(normalized)
    || /路\d+号|街道|大道|广场|中心|大厦|[A-Z]栋|\d+楼/u.test(normalized)
  );
}

function shouldStopArtistSection(line: string): boolean {
  const normalized = stripSectionDecor(line);
  if (isArtistSubsectionLabel(normalized)) return false;
  return ARTIST_SECTION_STOP.test(line)
    || shouldSkipArtistLine(line)
    || looksLikeVenueDetailLine(normalized)
    || looksLikeTitleStop(normalized);
}

function hasNearbyNonPerformerContext(lines: string[], index: number): boolean {
  if (shouldSkipArtistLine(lines[index] ?? '')) return true;

  let seenNonEmpty = 0;
  for (let cursor = index - 1; cursor >= 0 && seenNonEmpty < 2; cursor -= 1) {
    const line = lines[cursor]?.trim();
    if (!line) continue;
    seenNonEmpty += 1;
    if (shouldSkipArtistLine(line)) return true;
  }

  return false;
}

function isArtistSectionNote(text: string): boolean {
  return /^(?:[（(].*[）)][:：]?\s*|排名不分先后[:：]?\s*|不分先后[:：]?\s*|敬称略[:：]?\s*)$/i.test(text.trim());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRawArtistNameFromHashtag(
  tag: string,
  contextLines: string[],
  options: { requireContext?: boolean } = {},
): string | null {
  const rawTag = tag.trim();
  if (!rawTag || rawTag.length < 2) return null;
  if (TITLE_NOISE.test(rawTag) || /live|ticket|idol|地下偶像/i.test(rawTag)) return null;

  const tagPattern = new RegExp(escapeRegExp(rawTag), 'i');
  for (const rawLine of contextLines) {
    const line = rawLine.trim();
    if (!line || line.includes('#') || shouldSkipArtistLine(line)) continue;
    if (tagPattern.test(line)) return rawTag;
  }

  return options.requireContext ? null : rawTag;
}

function collectArtistHashtags(
  lines: string[],
  contextLines: string[] = lines,
  options: { requireContext?: boolean } = {},
): string[] {
  const artists: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    for (const match of line.matchAll(/#([^#\s]{2,40})#/g)) {
      const rawTag = match[1].trim();
      if (!rawTag || rawTag.length < 2) continue;
      if (TITLE_NOISE.test(rawTag) || /live|ticket|idol|地下偶像|超话/i.test(rawTag)) continue;
      if (line.match(/#/g)?.length !== 2) continue;
      const hashtagArtist = getRawArtistNameFromHashtag(match[1], contextLines, options);
      if (hashtagArtist) artists.push(hashtagArtist);
    }
  }

  return artists;
}

function extractOrderedTicketPrice(lines: string[]): number | null {
  let fallbackKeywordPrice: number | null = null;
  let fallbackCurrencyPrice: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (NON_TICKET_PRICE_LINE.test(line)) continue;
    if (/生日票|生诞票/i.test(line)) continue;

    const standardKeywordPrice =
      line.match(/(?:一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟)\s*[:：]?\s*(?:[¥￥])?(\d+(?:\.\d+)?)/i)
      ?? line.match(/(?:一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟)[^0-9¥￥]{0,8}(?:[¥￥])?(\d+(?:\.\d+)?)/i);
    if (standardKeywordPrice) return parseFloat(standardKeywordPrice[1]);

    const anyKeywordPrice =
      line.match(/(?:VIP票|VIP|优先票|优先|一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟)\s*[:：]?\s*(?:[¥￥])?(\d+(?:\.\d+)?)/i)
      ?? line.match(/(?:VIP票|VIP|优先票|优先|一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟)[^0-9¥￥]{0,8}(?:[¥￥])?(\d+(?:\.\d+)?)/i);
    if (anyKeywordPrice && fallbackKeywordPrice == null) {
      fallbackKeywordPrice = parseFloat(anyKeywordPrice[1]);
    }

    const currencyPrice = line.match(/[¥￥](\d+(?:\.\d+)?)/) ?? line.match(/(\d+(?:\.\d+)?)元/);
    if (currencyPrice && fallbackCurrencyPrice == null) {
      fallbackCurrencyPrice = parseFloat(currencyPrice[1]);
    }
  }

  return fallbackKeywordPrice ?? fallbackCurrencyPrice;
}

function extractArtistsFromLine(line: string, options: { allowPlainLine?: boolean } = {}): string[] {
  if (shouldSkipArtistLine(line) || /https?:|t\.cn\//i.test(line)) return [];

  const artistNames: string[] = [];
  const pushArtist = (value: string) => {
    const rawName = value.trim();
    if (!rawName || rawName.length < 2) return;
    if (!/[\p{L}\p{N}\u4E00-\u9FFF]/u.test(rawName)) return;
    if (/^(?:网页链接|见评论|稍后|DM)$/i.test(rawName)) return;
    if (/老师$/.test(rawName)) return;
    artistNames.push(rawName);
  };

  for (const match of line.matchAll(/@([\w一-鿿_\-]+)/g)) {
    pushArtist(match[1]);
  }

  const inlineSection = line.replace(/^[^\S\n]*/, '');
  const slashCount = (inlineSection.match(/\//g) ?? []).length;
  const hasArtistLabel = ARTIST_SECTION_LABEL.test(inlineSection);
  const afterLabel = inlineSection
    .replace(/^(?:.*?(?:GUEST|SIGNAL SOURCE|出演(?:嘉宾|团体)?|出席(?:嘉宾|团体)?|参演(?:嘉宾|团体)?|演出团体|阵容|LINEUP))\s*[:：]?\s*/i, '')
    .replace(/^[⛲️❤️🎸🌟✨👤🔮🪸🩷🦋🎤]+\s*/, '')
    .trim();
  if (
    hasArtistLabel ||
    (slashCount >= 3 && !/^\d{1,4}[./]\d{1,2}(?:[./]\d{1,2})?$/.test(inlineSection))
  ) {
    if ((hasArtistLabel && /[\/／、,，]/.test(afterLabel)) || slashCount >= 3) {
      for (const token of afterLabel.split(/[\/／、,，]+/)) {
        if (!token.includes('http') && !token.includes('...')) {
          pushArtist(token);
        }
      }
    }
  }

  if (options.allowPlainLine && artistNames.length === 0) {
    const plainLine = (afterLabel || inlineSection)
      .replace(/^\d+[.)、]\s*/, '')
      .trim();
    if (
      plainLine &&
      !(hasArtistLabel && isArtistSectionNote(plainLine)) &&
      !/^#.+#$/.test(plainLine) &&
      !ARTIST_SECTION_LABEL.test(plainLine) &&
      !ARTIST_SECTION_STOP.test(plainLine) &&
      !/\d{1,2}[:：]\d{2}/.test(plainLine)
    ) {
      const tokens = /[\/／、,，]/.test(plainLine)
        ? plainLine.split(/[\/／、,，]+/)
        : [plainLine];
      for (const token of tokens) {
        pushArtist(token);
      }
    }
  }

  return artistNames;
}

export function parseAnnouncement(
  text: string,
  options: ParseAnnouncementOptions = {},
): ParsedAnnouncement {
  const normalizedText = normalizeAnnouncementText(text);
  const rawTextLines = text.split(/[\n\r]+/);
  const firstStageSplitIndex = findFirstStageSplitIndex(rawTextLines);
  const scopedTextLines = firstStageSplitIndex == null
    ? rawTextLines
    : rawTextLines.slice(0, firstStageSplitIndex);
  const scopedText = scopedTextLines.join('\n');
  const scopedNormalizedText = normalizeAnnouncementText(scopedText);
  const result: ParsedAnnouncement = {
    title: null,
    event_date: null,
    event_time: null,
    city: null,
    venue: null,
    artist: null,
    ticket_price: null,
    artist_mentions: [],
  };

  const currentYear = options.referenceYear ?? new Date().getFullYear();
  const rawLines = normalizedText.split(/[\n\r]+/);
  const scopedRawLines = scopedNormalizedText.split(/[\n\r]+/);

  // ── Date ──────────────────────────────────────────────────────────────────
  // Priority: YYYY年M月D日 > YYYY.MM.DD > YYYY/M/D > M月D日 > M/D（曜日）

  const withYear =
    scopedNormalizedText.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/) ??
    scopedNormalizedText.match(/(\d{4})[.](\d{1,2})[.](\d{1,2})/) ??
    scopedNormalizedText.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (withYear) {
    const [, y, m, d] = withYear;
    result.event_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else {
    const dateNoYear = scopedNormalizedText.match(/(\d{1,2})月\s*(\d{1,2})日?/);
    if (dateNoYear) {
      const [, m, d] = dateNoYear;
      result.event_date = `${currentYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
      // M/D（曜日）— only when weekday hint is present to avoid matching prices
      const dateMD = scopedNormalizedText.match(
        /\b(\d{1,2})\/(\d{1,2})[（(](?:[一二三四五六日]|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i,
      );
      if (dateMD) {
        const [, m, d] = dateMD;
        result.event_date = `${currentYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else {
        const titleDate = scopedRawLines
          .slice(0, 4)
          .map((line) => line.trim())
          .find((line) => /^.*?(\d{1,2})[./](\d{1,2})(?!\d)/.test(line));
        if (titleDate) {
          const match = titleDate.match(/(\d{1,2})[./](\d{1,2})(?!\d)/);
          if (match) {
            const [, m, d] = match;
            result.event_date = `${currentYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }
      }
    }
  }

  // ── Time ──────────────────────────────────────────────────────────────────

  const explicitStart = scopedNormalizedText.match(
    /(\d{1,2})[:：](\d{2})\s*(?:开始演出|開演|开演)/i,
  );
  if (explicitStart) {
    result.event_time = `${explicitStart[1].padStart(2, '0')}:${explicitStart[2]}`;
  } else {
    const startBlockTime = findLabeledTime(scopedRawLines, 'start');
    const openBlockTime = findLabeledTime(scopedRawLines, 'open');
    const startAfter = scopedNormalizedText.match(
      new RegExp(
        String.raw`(?:START|開演|开演|开场|開場|開始|start|ST)\s*[：:\s]*${DATE_PREFIX.source}(\d{1,2})[：:](\d{2})`,
        'i',
      ),
    );
    const startBefore = scopedNormalizedText.match(/(\d{1,2})[：:](\d{2})\s*(?:START|start|開演|开演|ST)/i);
    const startMatch = startAfter ?? startBefore;
    if (startMatch) {
      result.event_time = `${startMatch[1].padStart(2, '0')}:${startMatch[2]}`;
    } else if (startBlockTime) {
      result.event_time = startBlockTime;
    } else {
      const openAfter = scopedNormalizedText.match(
        new RegExp(
          String.raw`(?:OPEN|開場|open|OP)\s*[：:\s]*${DATE_PREFIX.source}(\d{1,2})[：:](\d{2})`,
          'i',
        ),
      );
      const openBefore = scopedNormalizedText.match(/(\d{1,2})[：:](\d{2})\s*(?:OPEN|open|開場|OP)/i);
      const timeMatch = openAfter ?? openBefore ?? (openBlockTime ? [openBlockTime, ...openBlockTime.split(':')] : null) ?? scopedNormalizedText.match(/\b(\d{1,2})[：:](\d{2})\b/);
      if (timeMatch) {
        const hour = typeof timeMatch[1] === 'string' ? timeMatch[1] : timeMatch[0].split(':')[0];
        const minute = typeof timeMatch[2] === 'string' ? timeMatch[2] : timeMatch[0].split(':')[1];
        const h = parseInt(hour, 10);
        if (h >= 0 && h <= 23) {
          result.event_time = `${String(h).padStart(2, '0')}:${minute}`;
        }
      }
    }

    if (
      startBlockTime &&
      openBlockTime &&
      /茶話会|茶话会/i.test(scopedNormalizedText)
    ) {
      result.event_time = openBlockTime;
    }
  }

  // ── City ──────────────────────────────────────────────────────────────────

  const cityLabel = normalizedText.match(
    /(?:都市|城市|地区|エリア|AREA|Area)\s*[：:]\s*([^\n\r,，。、]+)/i,
  );
  if (cityLabel) {
    result.city = cityLabel[1].trim();
  } else {
    const cityMatch = scopedNormalizedText.match(KNOWN_CITIES);
    if (cityMatch) result.city = cityMatch[0];
  }

  // ── Venue ─────────────────────────────────────────────────────────────────

  // 1. Explicit venue label (same line)
  const venueLabelSameLine = scopedNormalizedText.match(
    /(?:会場|場所|会场|場地|VENUE|venue|演出场地|演出地点|活动地点|活动场地|地点|PLACE)\s*[:：]\s*(\S[^\n\r,，。、]{1,60})/i,
  );
  // 2. Address label with content on next line (e.g. 📍演出地址：\n育音堂小镇c厅...)
  const venueLabelNextLine = scopedNormalizedText.match(
    /(?:演出地址|地址|场地)\s*[：:]\s*\n[\s　]*(\S[^\n\r（(]{1,40})/i,
  );
  const venueLineAfterLabel = findVenueLineAfterLabel(scopedRawLines);

  if (venueLabelSameLine) {
    result.venue = cleanVenue(venueLabelSameLine[1]);
  } else if (venueLabelNextLine) {
    result.venue = cleanVenue(venueLabelNextLine[1]);
  } else if (venueLineAfterLabel) {
    result.venue = cleanVenue(venueLineAfterLabel);
  } else {
    // 3. City·Venue format (e.g. 上海·新歌空间) — only when left part is a known city
    const dotSplit = scopedNormalizedText.match(/([^\n\r·・]{1,8})[·・]([^\n\r·・（(（(]{2,40})/);
    if (dotSplit && KNOWN_CITIES.test(dotSplit[1].trim())) {
      result.city ??= dotSplit[1].trim();
      result.venue ??= dotSplit[2].trim();
    }

    // 4. Line containing a venue keyword
    if (!result.venue) {
      const venueLine = scopedRawLines.find((l) => {
        const stripped = cleanVenue(l);
        return !isStageHeading(l)
          && !TITLE_NOISE.test(stripped)
          && VENUE_KW.test(stripped)
          && stripped.trim().length < 80;
      });
      if (venueLine) {
        result.venue = cleanVenue(venueLine);
      }
    }
  }

  if (!result.venue) {
    const embeddedVenueLine = scopedRawLines.find((line) =>
      !isStageHeading(line)
      && /(?:Live\s*House|LiveHouse|studio|剧场|Venue|Space|C厅|世界树剧场|酒球会|KUMOLL|EchoSpace)/i.test(line),
    );
    if (embeddedVenueLine) {
      result.venue = cleanVenue(embeddedVenueLine);
    }
  }

  const venueAddressCity = result.venue?.match(/^\s*([\u4E00-\u9FFF]{2,6}?)市/u)?.[1];
  if (venueAddressCity) {
    result.city = venueAddressCity;
  }

  // 5. Venue → city fallback (if city still unknown)
  if (!result.city) {
    for (const [kw, city] of Object.entries(VENUE_TO_CITY)) {
      if (scopedNormalizedText.includes(kw)) { result.city = city; break; }
    }
  }

  if (!result.venue) {
    for (const kw of Object.keys(VENUE_TO_CITY)) {
      if (scopedNormalizedText.includes(kw)) {
        result.venue = kw;
        break;
      }
    }
  }

  if (!result.city && result.venue) {
    const venueCity = result.venue.match(KNOWN_CITIES);
    if (venueCity) result.city = venueCity[0];
  }

  // ── Ticket Price ──────────────────────────────────────────────────────────
  // Filter VIP/SVIP lines, extract minimum valid price from remaining text

  const ticketLines = scopedRawLines.filter((line) =>
    /票|ticket|TICKET|入场|無料|无料|1D|¥|￥|元/i.test(line)
    && !/上架|配送|海报|周边|微商城|相卡|邮寄|拍立得|T恤|立牌|键帽|护腕/i.test(line),
  );
  const nonVipText = ticketLines
    .filter((l) => !VIP_LINE.test(l) && !NON_TICKET_PRICE_LINE.test(l))
    .join('\n');

  const cleanedNonVipText = nonVipText
    .replace(/\d{4}[./-]\d{1,2}[./-]\d{1,2}/g, '')
    .replace(/\d{1,2}[./月]\d{1,2}/g, '');

  const oneDrinkPrices = [
    ...normalizedText.matchAll(/(?:\+?\s*1D|1D)[^0-9]{0,8}(\d+(?:\.\d+)?)/gi),
  ].map((match) => parseFloat(match[1]));
  const hasFreeAdmission = ticketLines
    .filter((l) => !NON_TICKET_PRICE_LINE.test(l))
    .some((l) => /无料入场|入场无料|免费入场|入場無料|观演无料|入场[🈚无]料|普通入场\s*[|｜:：]?\s*无料|一般入场\s*[|｜:：]?\s*无料/i.test(l));
  if (hasFreeAdmission) {
    result.ticket_price = oneDrinkPrices.length > 0 ? Math.min(...oneDrinkPrices) : 0;
  }

  const prices: number[] = [];
  for (const m of cleanedNonVipText.matchAll(/[¥￥](\d+(?:\.\d+)?)/g))
    prices.push(parseFloat(m[1]));
  for (const m of cleanedNonVipText.matchAll(/(\d+(?:\.\d+)?)元/g))
    prices.push(parseFloat(m[1]));
  for (const m of cleanedNonVipText.matchAll(/(\d+(?:\.\d+)?)\s*CNY\b/gi))
    prices.push(parseFloat(m[1]));
  for (const m of cleanedNonVipText.matchAll(
    /(?:一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟|女性\/学生\/新规|女性|学生|新规)\s*(?::|：)?\s*(?:[¥￥])?(\d+(?:\.\d+)?)(?![/.]\d)/g
  ))
    prices.push(parseFloat(m[1]));
  for (const m of cleanedNonVipText.matchAll(
    /(?:一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟)\s*[/:：]\s*(\d+(?:\.\d+)?)/g
  ))
    prices.push(parseFloat(m[1]));
  for (const m of cleanedNonVipText.matchAll(
    /(?:一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟)[^0-9]{0,4}(\d+(?:\.\d+)?)(?:\s*\/\s*(?:当日票|当日|现场票|现场)[^0-9]{0,4}\d+(?:\.\d+)?)?/g
  ))
    prices.push(parseFloat(m[1]));
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    const keywordFirstPrice = line.match(
      /(?:一般票|一般|普通票|普通|预售票|预售|当日票|当日|现场票|现场|早鸟)(\d+(?:\.\d+)?)/,
    );
    if (keywordFirstPrice) prices.push(parseFloat(keywordFirstPrice[1]));
  }

  const validPrices = prices.filter((p) => p >= 1 && p <= 5000);
  if (result.ticket_price == null) {
    const orderedTicketPrice = extractOrderedTicketPrice(ticketLines);
    result.ticket_price = orderedTicketPrice ?? (validPrices.length ? Math.min(...validPrices) : null);
  }

  // ── Artists (@mention & time-based) ──────────────────────────────────────
  const artistLines = scopedTextLines;
  const artistMentions: ArtistMention[] = [];
  const artistSectionLineIndexes = new Set<number>();
  const addArtistMentions = (names: string[], source: ArtistMentionSource) => {
    for (const rawName of names) {
      artistMentions.push({ rawName, source, order: artistMentions.length });
    }
  };

  // 1. Explicit artist sections
  let inArtistSection = false;
  for (const [index, rawLine] of artistLines.entries()) {
    const line = rawLine.trim();
    if (!line) {
      inArtistSection = false;
      continue;
    }

    if (ARTIST_SECTION_LABEL.test(line)) {
      inArtistSection = true;
      artistSectionLineIndexes.add(index);
      addArtistMentions(
        extractArtistsFromLine(line, { allowPlainLine: true }),
        line.includes('@') ? 'mention' : 'lineup',
      );
      continue;
    }

    if (inArtistSection) {
      if (shouldStopArtistSection(line)) {
        inArtistSection = false;
        continue;
      }
      artistSectionLineIndexes.add(index);
      addArtistMentions(
        extractArtistsFromLine(line, { allowPlainLine: true }),
        line.includes('@') ? 'mention' : 'lineup',
      );
    }
  }

  // 2. Global @handle fallback
  for (const [index, rawLine] of artistLines.entries()) {
    const line = rawLine.trim();
    if (!line || shouldSkipArtistLine(line)) continue;
    if (artistSectionLineIndexes.has(index)) continue;
    if (hasNearbyNonPerformerContext(artistLines, index)) continue;
    if (/生日|BIRTHDAY/i.test(line) && !ARTIST_SECTION_LABEL.test(line)) continue;
    addArtistMentions(extractArtistsFromLine(line), 'mention');
  }

  // 2.5 Hashtags can be artist tokens when the surrounding announcement supports that interpretation.
  const topHashtagArtists = collectArtistHashtags(
    artistLines.slice(0, 6),
    artistLines,
    { requireContext: artistMentions.length > 0 },
  );
  addArtistMentions(topHashtagArtists, 'hashtag');
  addArtistMentions(collectArtistHashtags(artistLines.slice(6), artistLines), 'hashtag');

  // 3. Time-based format (HH:MM-HH:MM ArtistName) — for setlist/lineup with time slots
  const timeLinePattern = /\d{1,2}[:.]\d{2}\s*[-~]\s*\d{1,2}[:.]\d{2}\s+([^\s,，。、\n]+)/g;
  for (const m of text.matchAll(timeLinePattern)) {
    const name = m[1].trim();
    // Filter out non-artist markers
    if (/^(online|break|intermission|interval|休息|暂停)$/i.test(name)) continue;
    if (/^[（(].*[）)]$/.test(name) || /开始演出|開演|开演/i.test(name)) continue;
    if (name.length < 2 || /^\d+/.test(name)) continue;
    addArtistMentions([name], 'schedule');
  }

  result.artist_mentions = artistMentions;

  // ── Title ─────────────────────────────────────────────────────────────────

  const lines = scopedTextLines.map((l) => l.trim()).filter(Boolean);
  const normalizedLines = lines.map((line) => normalizeAnnouncementText(line));
  const eventKeyword =
    /(?:LIVE|CONCERT|TOUR|FESTIVAL|SHOW|GALA|Vol\.|vol\.|演唱会|音乐会|演出|公演|ライブ|コンサート|ツアー|BIRTHDAY|SPECIAL|ONEMAN|茶話会|茶话会|主催)/i;
  const quotedTitleLine = lines
    .slice(0, 4)
    .map((line, index) => ({
      original: cleanTitleLine(line),
      normalized: cleanTitleLine(normalizedLines[index]),
    }))
    .find(({ original, normalized }) => {
      const strippedOriginal = original.replace(
        /^\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,2})?(?:\/\d{1,2})?\s*/u,
        '',
      ).trim();
      const innerQuotedTitle = strippedOriginal.replace(/^[「『]|[」』]$/gu, '').trim();
      return /^(?:\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,2})?(?:\/\d{1,2})?\s*)[「『][^「」『』]{2,80}[」』]$/u.test(normalized)
        || (
          /^[「『][^「」『』]{2,80}[」』]$/u.test(strippedOriginal)
          && eventKeyword.test(innerQuotedTitle)
        );
    })?.original;

  if (quotedTitleLine) {
    result.title = quotedTitleLine.replace(
      /^\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,2})?(?:\/\d{1,2})?\s*/u,
      '',
    ).trim();
    return result;
  }

  const decorLine = /^[\s✨🌟⭐★☆【】\[\]「」『』（）()《》<>―—·・。]+$/;
  const scoredLines = lines
    .map((line, index) => {
      const normalizedLine = normalizedLines[index];
      const cleanedTitleLine = cleanTitleLine(normalizedLine);
      let score = 0;
      if (eventKeyword.test(normalizedLine)) score += 5;
      if (TITLE_PREFERRED.test(normalizedLine)) score += 3;
      if (cleanedTitleLine !== normalizedLine && TITLE_PREFERRED.test(cleanedTitleLine)) score += 7;
      if (isStageHeading(normalizedLine)) score -= 12;
      if (/^[^#]*【[^】]*(?:live|活动情报|情报公开|公开|解禁)[^】]*】/i.test(normalizedLine)) score -= 10;
      if (TITLE_NOISE.test(normalizedLine)) score -= 5;
      if (normalizedLine.includes('#')) score -= 12;
      if (normalizedLine.includes('@')) score -= 4;
      if (looksLikeTitleStop(normalizedLine)) score -= 8;
      if (/[&✖xX].*(?:LIVE|TWOMAN|2MAN)|BIRTHDAY SPECIAL|ONEMAN|OFF会|主催/i.test(normalizedLine)) score += 3;
      if (index <= 4) score += 1;
      if (/^(?:\[|【|\().*(?:\]|】|\))$/.test(normalizedLine) && !TITLE_NOISE.test(normalizedLine)) score += 2;
      if (/^(?:OPEN|START|TIME|PLACE|TICKET|GUEST|SIGNAL SOURCE|出演|出席|参演|阵容)/i.test(normalizedLine)) score -= 6;
      if (/^\d{1,2}[./]\d{1,2}/.test(normalizedLine)) score -= 2;
      if (/上海[市·]|南京[市·]|杭州[市·]|北京市|深圳市|广州市|成都市|武汉市/.test(normalizedLine)) score -= 6;
      if (/路\d+号/.test(normalizedLine)) score -= 4;
      if (/[¥￥]\d+|💰\d+/.test(normalizedLine)) score -= 5;
      if (normalizedLine.length > 70) score -= 4;
      if (index > 5) score -= 1;
      return { line, index, score };
    })
    .filter(({ line }) => !decorLine.test(line));
  const bestLine = scoredLines
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0];

  if (bestLine) {
    let current = cleanTitleLine(bestLine.line);
    const prevLine = lines[bestLine.index - 1];
    const nextLine = lines[bestLine.index + 1];
    if (
      nextLine &&
      nextLine.length <= 30 &&
      /^[~～]/.test(nextLine) &&
      !/\d{1,2}[./月]\d{1,2}/.test(nextLine)
    ) {
      current = `${current}${cleanTitleLine(nextLine)}`;
    } else if (
      prevLine &&
      /anniversary/i.test(current) &&
      !looksLikeTitleStop(normalizeAnnouncementText(prevLine))
    ) {
      const prevCoreMatch = cleanTitleLine(prevLine).match(/[A-Za-z0-9][A-Za-z0-9_\-]*/);
      const prevCore = prevCoreMatch?.[0] ?? cleanTitleLine(prevLine).split(/[·•]/)[0].trim();
      current = `${prevCore} ${current}`.trim();
    }

    current = current
      .replace(/^ULTIMATUM GAME\s*&\s*(?=烏野冬BIRTHDAY SPECIAL)/i, '')
      .replace(/\s+【[^】]+】$/, '')
      .trim();
    result.title = current;
  } else {
    const firstClean = lines.find((l) => !decorLine.test(l) && l.length <= 60 && !looksLikeTitleStop(normalizeAnnouncementText(l)));
    if (firstClean) result.title = cleanTitleLine(firstClean);
  }

  return result;
}

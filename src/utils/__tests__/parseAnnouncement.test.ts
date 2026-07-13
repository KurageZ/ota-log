import fs from 'node:fs';
import path from 'node:path';
import { matchArtistsFromMentions } from '../artistMatching';
import { parseAnnouncement } from '../parseAnnouncement';
import type { AnnouncementCaseFixture } from '../../types/announcementCases';

const truthFixturePath = path.resolve(__dirname, 'fixtures/announcement-cases.truth.json');

function loadTruthFixture(): AnnouncementCaseFixture {
  return JSON.parse(fs.readFileSync(truthFixturePath, 'utf8')) as AnnouncementCaseFixture;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function normalizeComparableValue(path: string, value: unknown): unknown {
  if (
    Array.isArray(value)
    && (
      path === 'match.unmatchedArtistNames'
      || path === 'match.matchedArtistIds'
    )
  ) {
    return [...value].sort((left, right) => String(left).localeCompare(String(right)));
  }

  return value;
}

describe('parseAnnouncement regression fixtures', () => {
  const fixture = loadTruthFixture();

  test.each(fixture.cases)('matches curated truth case $id', (testCase) => {
    const parsed = parseAnnouncement(testCase.rawText, { referenceYear: testCase.referenceYear });
    const parsedDiffs = Object.entries(testCase.expected.parsed).flatMap(([key, expectedValue]) => {
      const actualValue = parsed[key as keyof typeof parsed];
      const path = `parsed.${key}`;
      return stableStringify(normalizeComparableValue(path, actualValue)) === stableStringify(normalizeComparableValue(path, expectedValue))
        ? []
        : [`${path}: expected ${stableStringify(expectedValue)}, received ${stableStringify(actualValue)}`];
    });

    const match = matchArtistsFromMentions(
      parsed.artist_mentions,
      fixture.artistCatalog,
      { announcementText: testCase.rawText },
    );
    const actualMatch = {
      matchedArtistIds: match.matchedIds,
      unmatchedArtistNames: match.candidates.map((candidate) => candidate.rawName),
    };
    const matchDiffs = Object.entries(testCase.expected.match).flatMap(([key, expectedValue]) => {
      const actualValue = actualMatch[key as keyof typeof actualMatch];
      const path = `match.${key}`;
      return stableStringify(normalizeComparableValue(path, actualValue)) === stableStringify(normalizeComparableValue(path, expectedValue))
        ? []
        : [`${path}: expected ${stableStringify(expectedValue)}, received ${stableStringify(actualValue)}`];
    });

    expect([...parsedDiffs, ...matchDiffs]).toEqual([]);
  });
});

describe('parseAnnouncement branch coverage', () => {
  const mentionNames = (text: string) =>
    parseAnnouncement(text, { referenceYear: 2026 }).artist_mentions.map((mention) => mention.rawName);

  test('uses the provided referenceYear for month/day dates', () => {
    expect(parseAnnouncement('5/24（日）\nSTART 18:30', { referenceYear: 2026 }).event_date).toBe('2026-05-24');
  });

  test('falls back to OPEN time when START is absent', () => {
    const parsed = parseAnnouncement('时间：05月24日 17:30 open\n地点：新歌空间', { referenceYear: 2026 });

    expect(parsed.event_time).toBe('17:30');
    expect(parsed.venue).toBe('新歌空间');
  });

  test('supports OP/ST shorthand labels', () => {
    const parsed = parseAnnouncement('2026/2/27\n⏰OP 19:00 ST 19:30\n📍新歌空间', { referenceYear: 2026 });

    expect(parsed.event_date).toBe('2026-02-27');
    expect(parsed.event_time).toBe('19:30');
  });

  test('falls back to the first standalone time when no label exists', () => {
    const parsed = parseAnnouncement(
      'KINNARA-X SYNAPSE VOL.1\nLINK ACTIVATION SYNCHED: 2026.01.17-14:15',
      { referenceYear: 2026 },
    );

    expect(parsed.event_date).toBe('2026-01-17');
    expect(parsed.event_time).toBe('14:15');
  });

  test('parses full-width month/day titles and keeps the actual event title', () => {
    const parsed = parseAnnouncement(
      '【⛓️主催情报解禁⛓️】\nYuiitsu Fes ～小鳥姫の茶話会～\n🫖 ０４／２５（土）',
      { referenceYear: 2026 },
    );

    expect(parsed.title).toBe('Yuiitsu Fes ～小鳥姫の茶話会～');
    expect(parsed.event_date).toBe('2026-04-25');
  });

  test('parses line-start short dates and start times inside explanatory parentheses', () => {
    const parsed = parseAnnouncement(
      '☠5.7 风起Vol.3 | 地偶×乐队直撞 ☠\n🕘 TIME｜22:00–22:30 (20:00开始演出)\n📍 PLACE｜酒球会',
      { referenceYear: 2026 },
    );

    expect(parsed.event_date).toBe('2026-05-07');
    expect(parsed.event_time).toBe('20:00');
    expect(parsed.venue).toBe('酒球会');
    expect(parsed.artist_mentions).toEqual([]);
  });

  test('extracts artist names from slash-separated lineup lines and ignores credits', () => {
    const parsed = parseAnnouncement(
      '⛲️FixtureArtist025/FixtureArtist053/FixtureArtist052/FixtureArtist051\n衣装感谢：@Krad_Lanrete',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist025',
      'FixtureArtist053',
      'FixtureArtist052',
      'FixtureArtist051',
    ]);
  });

  test('does not treat sponsor mentions outside artist sections as artist names', () => {
    const parsed = parseAnnouncement(
      'PIKA Festival 16\n携手共赴音乐盛宴！\n为热爱加冕，为闪耀助力！\n@柏瑞美PRAMY\n出演：\n@FixtureArtist031_Official',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual(['FixtureArtist031_Official']);
  });

  test('extracts plain artist lines inside a labeled artist section', () => {
    const parsed = parseAnnouncement(
      '时间：05月31日 11:30 open\n地点：育音堂小镇c厅\n参演：\nFixtureArtist040\nFixtureArtist011_Official\nFixtureArtist009\nFixtureArtist030',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist040',
      'FixtureArtist011_Official',
      'FixtureArtist009',
      'FixtureArtist030',
    ]);
  });

  test('extracts plain artist lines inside a guest block without mentions', () => {
    const parsed = parseAnnouncement(
      '2026.05.30 at 育音堂小镇C厅\nGUEST\nFixtureArtist030\nFixtureArtist040\nFixtureArtist011_Official',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist030',
      'FixtureArtist040',
      'FixtureArtist011_Official',
    ]);
  });

  test('does not treat artist section note lines as artist names', () => {
    const parsed = parseAnnouncement(
      '🔮出席嘉宾（排名不分先后）：\n@FixtureArtist030_Official\n@FixtureArtist040_Official',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist030_Official',
      'FixtureArtist040_Official',
    ]);
  });

  test('does not keep artist section label suffixes as artist names', () => {
    const parsed = parseAnnouncement(
      '🎤参演团体：\n@FixtureArtist054_Official\n@FixtureArtist019_Official',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist054_Official',
      'FixtureArtist019_Official',
    ]);
  });

  test('does not treat decorative emoji separator lines as artist names', () => {
    const parsed = parseAnnouncement(
      'GUEST\n@FixtureArtist054_Official\n💧💧💧💧💧💧\n@FixtureArtist036_Official',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist054_Official',
      'FixtureArtist036_Official',
    ]);
  });

  test('stops artist section parsing when ticket hints begin', () => {
    const parsed = parseAnnouncement(
      '参演：\nFixtureArtist040\nFixtureArtist011_Official\nFixtureArtist009\nFixtureArtist030\n\n———🎫 🔗见评 ———\n普通80/当日120',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist040',
      'FixtureArtist011_Official',
      'FixtureArtist009',
      'FixtureArtist030',
    ]);
  });

  test('stops artist section parsing before venue details and giveaway notes', () => {
    const parsed = parseAnnouncement(
      '演出阵容：\n@凛樱rino_沉淀中\n@告白-CONFESSION_Official\n@海岸线少女_COASTLiNE\n🏡青岛市市南区南京路122号中联创意广场G栋3楼\n🚫全场禁止录像\n🧱+評+关，各抽一天入场资格。',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      '凛樱rino_沉淀中',
      '告白-CONFESSION_Official',
      '海岸线少女_COASTLiNE',
    ]);
  });

  test('treats top hashtags as artist names when the same artist appears elsewhere in the text', () => {
    const parsed = parseAnnouncement(
      '#fixtureartist040#\n\n⛩️  FixtureArtist040 ·一周年 ⛩️\n1st Anniversary One-man Live',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual(['fixtureartist040']);
  });

  test('does not add an unsupported top hashtag when explicit performers exist', () => {
    const parsed = parseAnnouncement(
      '#春日祭#\n出演：\n@FixtureArtist031_Official\n@FixtureArtist030_Official',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist031_Official',
      'FixtureArtist030_Official',
    ]);
  });

  test('adds a supported top hashtag alongside explicit performers', () => {
    const parsed = parseAnnouncement(
      '#FixtureArtist031#\nFixtureArtist031 特别公演\n出演：\n@FixtureArtist030_Official',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist030_Official',
      'FixtureArtist031',
    ]);
  });

  test('uses a top hashtag as fallback when no other performer is extracted', () => {
    const parsed = parseAnnouncement(
      '#春日祭#\n2026.05.24\nSTART 18:00',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual(['春日祭']);
  });

  test('uses a trailing standalone hashtag to supplement artist names', () => {
    const parsed = parseAnnouncement(
      'GUEST\n@FixtureArtist030_Official\n@FixtureArtist040_Official\n@FixtureArtist011_Official\n@FixtureArtist051_Official\n@FixtureArtist027_Official\n\n#FixtureArtist023_Official#',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'FixtureArtist030_Official',
      'FixtureArtist040_Official',
      'FixtureArtist011_Official',
      'FixtureArtist051_Official',
      'FixtureArtist027_Official',
      'FixtureArtist023_Official',
    ]);
  });

  test('does not inject fixed artist names from event-specific emoji markers', () => {
    const parsed = parseAnnouncement(
      '🌋【ultimatum game 】⛩️🌀💎\n时间：05月24日 17:30 open\n地点：新歌空间',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions).toEqual([]);
  });

  test('does not inject fixed artist names from an event title', () => {
    const parsed = parseAnnouncement(
      'ULTIMATUM GAME & 海羽 BIRTHDAY SPECIAL～海天使の深海狩猎宴～\n@海羽Rione-VORTEX',
      { referenceYear: 2026 },
    );

    expect(parsed.artist_mentions).toEqual([]);
  });

  test('preserves artist account suffixes and duplicate aliases as raw mentions', () => {
    expect(mentionNames('出演：\n@FixtureArtist031_Official\n@bpm-official')).toEqual([
      'FixtureArtist031_Official',
      'bpm-official',
    ]);
  });

  test('uses the first compact ticket price number on a pricing line', () => {
    const parsed = parseAnnouncement(
      '———🎫 🔗见评 ———\n普通80/当日120',
      { referenceYear: 2026 },
    );

    expect(parsed.ticket_price).toBe(80);
  });

  test('skips birthday ticket lines and giveaway counts when choosing ticket price', () => {
    const parsed = parseAnnouncement(
      '🪩TICKET\n生日票：280元\nVIP票：200元\n一般票：100元\n【转+关】抽普通票*2',
      { referenceYear: 2026 },
    );

    expect(parsed.ticket_price).toBe(100);
  });

  test('prefers the standard ticket price over priority ticket prices', () => {
    const parsed = parseAnnouncement(
      '🎫门票🎫\n优先票 ¥388\n普通票 ¥48',
      { referenceYear: 2026 },
    );

    expect(parsed.ticket_price).toBe(48);
  });

  test('treats free admission as zero ticket price', () => {
    const parsed = parseAnnouncement(
      '【星跃金陵Fes Vol.29】🎉\n2026年1月11日   Start 12：00\n南京市山西路1号 KUMOLL二楼\n🎫无料入场',
      { referenceYear: 2026 },
    );

    expect(parsed.ticket_price).toBe(0);
    expect(parsed.venue).toBe('KUMOLL');
  });

  test('keeps only the first stage block for multi-venue announcements', () => {
    const parsed = parseAnnouncement(
      '【情报解禁】Starry Fes 端午节双会场同时开催决定！\n\nVas stage\n🎒演出团体\nSTARWINK/STARLIGHT/STARAXIS/SPARKLE/VESPERA/FixtureArtist015/FixtureArtist011_Official /FixtureArtist023_Official/FixtureArtist030/FixtureArtist001/FixtureArtist035/FixtureArtist007/FixtureArtist009_Official/YUMEHANABI/YUMEHIBIKI/FixtureArtist025/FixtureArtist054/青空日记/FixtureArtist024_Official/FixtureArtist043\n🎒活动地点\n上海市普陀区万航渡路沪西文化艺术中心L3 Vas ear\n🎒票务情报\n网页链接：网页链接\n※普通票：125\n※当日票：175\n※通用票：200\n\nYYT stage\n🎒演出团体\nAetherLurk/SIN RETORNO/FixtureArtist036/FixtureArtist053/FixtureArtist027_Official/FixtureArtist010_Official/空夢SORAYUME/星屑物语/花与心事AFFLORET/她蝶效应PSYCHELLES/EMBEFUSE/异色星Harmonia/蛋黄派SIZZLE/心跳序曲PROLOGUE/第六页序/Rera\n🎒活动地点\n上海市长宁区愚园路1398 号鼎植大厦 B1 育音堂音乐公园\n🎒票务情报\n网页链接：网页链接\n※普通票：100\n※当日票：150\n※通用票：200\n\n转➕关抽200 抽奖详情',
      { referenceYear: 2026 },
    );

    expect(parsed.title).toBe('Starry Fes 端午节双会场同时');
    expect(parsed.city).toBe('上海');
    expect(parsed.venue).toBe('上海市普陀区万航渡路沪西文化艺术中心L3 Vas ear');
    expect(parsed.ticket_price).toBe(125);
    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual([
      'STARWINK',
      'STARLIGHT',
      'STARAXIS',
      'SPARKLE',
      'VESPERA',
      'FixtureArtist015',
      'FixtureArtist011_Official',
      'FixtureArtist023_Official',
      'FixtureArtist030',
      'FixtureArtist001',
      'FixtureArtist035',
      'FixtureArtist007',
      'FixtureArtist009_Official',
      'YUMEHANABI',
      'YUMEHIBIKI',
      'FixtureArtist025',
      'FixtureArtist054',
      '青空日记',
      'FixtureArtist024_Official',
      'FixtureArtist043',
    ]);
  });

  test('keeps the first stage date and time when later stages provide different values', () => {
    const parsed = parseAnnouncement(
      'Alpha stage\n2026.06.01\nOPEN 17:00\nSTART 17:30\n演出团体\nFixtureArtist030\n\nBeta stage\n2026.06.02\nOPEN 18:00\nSTART 18:30\n演出团体\nFixtureArtist040',
      { referenceYear: 2026 },
    );

    expect(parsed.event_date).toBe('2026-06-01');
    expect(parsed.event_time).toBe('17:30');
    expect(parsed.artist_mentions.map((mention) => mention.rawName)).toEqual(['FixtureArtist030']);
  });

  test('extracts quoted title, city, and decimal 1D price from a multi-day free entry announcement', () => {
    const parsed = parseAnnouncement(
      '2026.06.20/21 「阶梯Live Vol.03」\n🕰️OPEN 11:20  START 11:30\n6.20单日：无料入场+1D「29.9」\n6.21单日：无料入场+1D「39.9」\n\n演出阵容：\n@凛樱rino_沉淀中\n@告白-CONFESSION_Official\n@海岸线少女_COASTLiNE\n@Chaosweet诊疗所_official\n@行星观测计划_WakuSei\n@闪翼flashingwing\n@催眠禁止_Don-tSleep\n@罪x罰Masukaredo\n\n🏡青岛市市南区南京路122号中联创意广场G栋3楼\n🚫全场禁止录像\n\n🧱+評+关，各抽一天入场资格。',
      { referenceYear: 2026 },
    );

    expect(parsed.title).toBe('「阶梯Live Vol.03」');
    expect(parsed.event_date).toBe('2026-06-20');
    expect(parsed.event_time).toBe('11:30');
    expect(parsed.city).toBe('青岛');
    expect(parsed.venue).toBe('青岛市市南区南京路122号中联创意广场G栋3楼');
    expect(parsed.ticket_price).toBe(29.9);
  });
});

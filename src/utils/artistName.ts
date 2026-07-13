const ARTIST_ACCOUNT_SUFFIX =
  /(?:official|offical|info|jp|cn|weibo|global|korea|kr|tw|hk|公式)$/i;

const HAN_VARIANT_GROUPS = [
  '电電',
  '乐樂楽',
  '国國',
  '会會',
  '广廣広',
  '滨濱浜',
  '泽澤沢',
  '龙龍竜',
  '术術',
  '艺藝芸',
  '梦夢',
  '华華',
  '叶葉',
  '台臺',
  '发發',
  '后後',
  '里裏',
  '万萬',
  '气氣',
  '体體',
  '学學',
  '馆館',
  '剧劇',
  '场場',
  '时時',
  '间間',
  '门門',
  '风風',
  '云雲',
] as const;

const HAN_VARIANT_MAP = new Map<string, string>(
  HAN_VARIANT_GROUPS.flatMap((group) => [...group].map((character) => [character, group[0]])),
);

export function foldArtistHanVariants(value: string): string {
  return [...value].map((character) => HAN_VARIANT_MAP.get(character) ?? character).join('');
}

function foldArtistVisualVariants(value: string): string {
  return value
    .replace(/[Ии]/g, 'n')
    .replace(/1/g, 'i');
}

export function normalizeArtistSurfaceText(value: string): string {
  return foldArtistHanVariants(value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim());
}

export function normalizeArtistComparisonText(value: string): string {
  return normalizeArtistSurfaceText(value)
    .replace(/[_\-\s]+/g, '')
    .replace(ARTIST_ACCOUNT_SUFFIX, '')
    .trim();
}

export function normalizeArtistSearchText(value: string): string {
  return normalizeArtistSurfaceText(value)
    .replace(/[_\-\s]+/g, '')
    .trim();
}

export function normalizeArtistVisualComparisonText(value: string): string {
  return foldArtistVisualVariants(normalizeArtistComparisonText(value));
}

export function splitArtistHandle(handle: string): { name: string; short_name: string | null } {
  const cjk = (handle.match(/[一-鿿]+/g) ?? []).join('');
  const latin = handle.replace(/[一-鿿]+/g, '').trim();
  if (cjk && latin) return { name: latin, short_name: cjk };
  return { name: handle, short_name: null };
}

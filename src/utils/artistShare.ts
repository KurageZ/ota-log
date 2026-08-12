import { hslToRgb, parseColor, rgbToHsl, toHex } from './color';

export interface ArtistShareInput {
  id: string | null;
  name: string;
  value: number;
  avatarUri?: string | null;
  isOshi?: boolean;
}

export interface ArtistShareSegment extends ArtistShareInput {
  isOther: boolean;
}

export function formatSharePercentage(value: number, total: number): string {
  if (value <= 0 || total <= 0) return '0%';
  const percentage = (value / total) * 100;
  if (percentage < 0.1) return '<0.1%';
  return `${Number(percentage.toFixed(1))}%`;
}

export function buildArtistShareSegments(
  items: ArtistShareInput[],
  total: number,
  visibleLimit = 3,
): ArtistShareSegment[] {
  if (total <= 0 || visibleLimit <= 0) return [];

  const visible = items
    .filter((item) => item.id != null && item.value > 0)
    .slice(0, visibleLimit)
    .map((item) => ({ ...item, isOther: false }));
  const visibleTotal = visible.reduce((sum, item) => sum + item.value, 0);
  const otherValue = Math.max(0, total - visibleTotal);

  return otherValue > 0
    ? [...visible, { id: null, name: '其他', value: otherValue, isOther: true }]
    : visible;
}

export function prepareArtistShareColors(
  extractedColors: Array<string | null>,
  fallbackColors: string[],
  isDark: boolean,
): string[] {
  const resolved: string[] = [];

  extractedColors.forEach((extracted, index) => {
    const fallback = fallbackColors[index] ?? fallbackColors[0] ?? '#7c3aed';
    let candidate = tuneShareColor(extracted, fallback, isDark);
    if (resolved.some((color) => colorDistance(color, candidate) < 72)) {
      candidate = tuneShareColor(fallback, fallback, isDark);
    }
    if (resolved.some((color) => colorDistance(color, candidate) < 72)) {
      const rgb = parseColor(candidate) ?? parseColor(fallback)!;
      const hsl = rgbToHsl(rgb);
      candidate = toHex(hslToRgb({ ...hsl, h: (hsl.h + (index + 1) * 0.23) % 1 }));
    }
    resolved.push(candidate);
  });

  return resolved;
}

function tuneShareColor(value: string | null, fallback: string, isDark: boolean): string {
  const fallbackRgb = parseColor(fallback) ?? { r: 124, g: 58, b: 237 };
  const sourceRgb = parseColor(value) ?? fallbackRgb;
  const sourceHsl = rgbToHsl(sourceRgb);
  const selectedHsl = value && sourceHsl.s >= 0.12 ? sourceHsl : rgbToHsl(fallbackRgb);
  return toHex(hslToRgb({
    h: selectedHsl.h,
    s: Math.max(0.82, Math.min(0.98, selectedHsl.s)),
    l: isDark
      ? Math.max(0.66, Math.min(0.76, selectedHsl.l))
      : Math.max(0.52, Math.min(0.62, selectedHsl.l)),
  }));
}

function colorDistance(left: string, right: string): number {
  const a = parseColor(left);
  const b = parseColor(right);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

import { getColors } from 'react-native-image-colors';
import type { ThemeColors } from '../theme/appTheme';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

const COLOR_EXTRACTION_FALLBACK = '#6d28d9';

export interface ArtistBackdropPalette {
  sourceColor: string | null;
  surfaceColor: string;
  headerColor: string;
  paletteIsDark: boolean;
  transitionColors: readonly [string, string, string];
  heroOverlayTopColors: readonly [string, string, string];
  heroOverlayBottomColors: readonly [string, string, string];
}

export async function extractArtistBackgroundColor(uri: string): Promise<string | null> {
  if (!uri.trim()) return null;

  try {
    const result = await getColors(uri, {
      fallback: COLOR_EXTRACTION_FALLBACK,
      cache: true,
      key: uri,
    });
    const candidate = pickDominantColor(result);
    return normalizeColor(candidate);
  } catch {
    return null;
  }
}

export function deriveArtistBackdropPalette(
  backgroundColor: string | null,
  colors: ThemeColors,
): ArtistBackdropPalette {
  const sourceColor = normalizeColor(backgroundColor);
  const baseScreen = parseColor(colors.screen) ?? parseColor(COLOR_EXTRACTION_FALLBACK)!;
  const fallbackTint = parseColor(colors.heroBg) ?? parseColor(COLOR_EXTRACTION_FALLBACK)!;
  const sourceRgb = parseColor(sourceColor) ?? fallbackTint;
  const rawLuminance = (sourceRgb.r * 0.299 + sourceRgb.g * 0.587 + sourceRgb.b * 0.114) / 255;
  const paletteIsDark = rawLuminance < 0.5;
  const tonedSource = tuneSourceColor(sourceRgb, paletteIsDark);

  if (paletteIsDark) {
    const surface = mixRgb(baseScreen, tonedSource, 0.66);
    const elevatedSurface = mixRgb(surface, tonedSource, 0.18);
    const header = mixRgb(surface, { r: 0, g: 0, b: 0 }, 0.22);
    const topScrimBase = mixRgb(tonedSource, { r: 0, g: 0, b: 0 }, 0.82);
    const bottomScrimBase = mixRgb(surface, { r: 0, g: 0, b: 0 }, 0.48);
    return {
      sourceColor,
      paletteIsDark: true,
      surfaceColor: toHex(surface),
      headerColor: toHex(header),
      transitionColors: [toRgba(elevatedSurface, 0), toRgba(elevatedSurface, 0.72), toHex(surface)],
      heroOverlayTopColors: [toRgba(topScrimBase, 0.16), toRgba(topScrimBase, 0.28), toRgba(bottomScrimBase, 0.56)],
      heroOverlayBottomColors: [toRgba(elevatedSurface, 0), toRgba(bottomScrimBase, 0.74), toHex(surface)],
    };
  }

  const white = { r: 255, g: 255, b: 255 };
  const surface = mixRgb(white, tonedSource, 0.60);
  const elevatedSurface = mixRgb(surface, tonedSource, 0.12);
  const header = mixRgb(white, tonedSource, 0.1);
  const topScrimBase = mixRgb(tonedSource, white, 0.62);
  const bottomScrimBase = mixRgb(surface, white, 0.18);
  return {
    sourceColor,
    paletteIsDark: false,
    surfaceColor: toHex(surface),
    headerColor: toHex(header),
    transitionColors: [toRgba(elevatedSurface, 0), toRgba(elevatedSurface, 0.72), toHex(surface)],
    heroOverlayTopColors: [toRgba(topScrimBase, 0.06), toRgba(topScrimBase, 0.16), toRgba(bottomScrimBase, 0.32)],
    heroOverlayBottomColors: [toRgba(elevatedSurface, 0), toRgba(bottomScrimBase, 0.72), toHex(surface)],
  };
}

function pickDominantColor(result: Awaited<ReturnType<typeof getColors>>): string | null {
  if ('dominant' in result && typeof result.dominant === 'string') {
    return result.dominant;
  }
  if ('primary' in result && typeof result.primary === 'string') {
    return result.primary;
  }
  if ('background' in result && typeof result.background === 'string') {
    return result.background;
  }
  if ('detail' in result && typeof result.detail === 'string') {
    return result.detail;
  }
  return null;
}

function normalizeColor(value: string | null | undefined): string | null {
  const parsed = parseColor(value ?? null);
  return parsed ? toHex(parsed) : null;
}

function parseColor(value: string | null): RGB | null {
  if (!value) return null;
  const trimmed = value.trim();

  if (/^#([0-9a-f]{3})$/i.test(trimmed)) {
    const [, short] = trimmed.match(/^#([0-9a-f]{3})$/i)!;
    return {
      r: Number.parseInt(short[0] + short[0], 16),
      g: Number.parseInt(short[1] + short[1], 16),
      b: Number.parseInt(short[2] + short[2], 16),
    };
  }

  if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    const hex = trimmed.slice(1);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) return null;

  const [r, g, b] = rgbMatch[1]
    .split(',')
    .slice(0, 3)
    .map((part) => Number.parseFloat(part.trim()));

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return {
    r: clampChannel(r),
    g: clampChannel(g),
    b: clampChannel(b),
  };
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(color: RGB): string {
  return `#${[color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function toRgba(color: RGB, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function mixRgb(base: RGB, target: RGB, weight: number): RGB {
  const ratio = Math.max(0, Math.min(1, weight));
  return {
    r: clampChannel(base.r + (target.r - base.r) * ratio),
    g: clampChannel(base.g + (target.g - base.g) * ratio),
    b: clampChannel(base.b + (target.b - base.b) * ratio),
  };
}

function tuneSourceColor(color: RGB, paletteIsDark: boolean): RGB {
  const hsl = rgbToHsl(color);
  if (paletteIsDark) {
    return hslToRgb({
      h: hsl.h,
      s: clampUnit(Math.min(0.74, hsl.s * 0.98)),
      l: clampUnit(Math.max(0.26, hsl.l * 0.72)),
    });
  }
  return hslToRgb({
    h: hsl.h,
    s: clampUnit(Math.min(0.78, hsl.s * 0.92)),
    l: clampUnit(Math.min(0.78, Math.max(0.62, hsl.l * 1.08))),
  });
}

function rgbToHsl(color: RGB): HSL {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0);
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

function hslToRgb(color: HSL): RGB {
  if (color.s === 0) {
    const channel = clampChannel(color.l * 255);
    return { r: channel, g: channel, b: channel };
  }

  const q = color.l < 0.5 ? color.l * (1 + color.s) : color.l + color.s - color.l * color.s;
  const p = 2 * color.l - q;

  return {
    r: clampChannel(hueToRgb(p, q, color.h + 1 / 3) * 255),
    g: clampChannel(hueToRgb(p, q, color.h) * 255),
    b: clampChannel(hueToRgb(p, q, color.h - 1 / 3) * 255),
  };
}

function hueToRgb(p: number, q: number, t: number): number {
  let hue = t;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

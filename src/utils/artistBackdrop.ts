import { getColors } from 'react-native-image-colors';
import type { ThemeColors } from '../theme/appTheme';
import { hslToRgb, parseColor, rgbToHsl, toHex, type RGB } from './color';

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
    const surface = mixRgb(baseScreen, tonedSource, 0.38);
    const elevatedSurface = mixRgb(surface, tonedSource, 0.12);
    const header = mixRgb(surface, { r: 0, g: 0, b: 0 }, 0.18);
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

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
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
      s: clampUnit(Math.min(0.56, hsl.s * 0.78)),
      l: clampUnit(Math.max(0.2, hsl.l * 0.58)),
    });
  }
  return hslToRgb({
    h: hsl.h,
    s: clampUnit(Math.min(0.78, hsl.s * 0.92)),
    l: clampUnit(Math.min(0.78, Math.max(0.62, hsl.l * 1.08))),
  });
}


function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

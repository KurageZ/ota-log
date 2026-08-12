export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

export function withAlpha(color: string, alpha: number): string {
  const normalized = color.trim();
  if (!normalized.startsWith('#')) return normalized;

  const hex = normalized.slice(1);
  const fullHex = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex;
  const r = Number.parseInt(fullHex.slice(0, 2), 16);
  const g = Number.parseInt(fullHex.slice(2, 4), 16);
  const b = Number.parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function parseColor(value: string | null | undefined): RGB | null {
  if (!value) return null;
  const trimmed = value.trim();

  const shortHexMatch = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch) {
    const short = shortHexMatch[1];
    return {
      r: Number.parseInt(short[0] + short[0], 16),
      g: Number.parseInt(short[1] + short[1], 16),
      b: Number.parseInt(short[2] + short[2], 16),
    };
  }

  const hexMatch = trimmed.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
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
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;

  return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b) };
}

export function toHex(color: RGB): string {
  return `#${[color.r, color.g, color.b].map((channel) => (
    clampChannel(channel).toString(16).padStart(2, '0')
  )).join('')}`;
}

export function rgbToHsl(color: RGB): HSL {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return { h: hue / 6, s: saturation, l: lightness };
}

export function hslToRgb(color: HSL): RGB {
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

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hueToRgb(p: number, q: number, value: number): number {
  let hue = value;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

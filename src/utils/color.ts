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

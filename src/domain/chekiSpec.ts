export const CHEKI_SPECS = [
  { id: 'three_inch_portrait', label: '三寸竖版', aspectRatio: 54 / 86 },
  { id: 'three_inch_landscape', label: '三寸横版', aspectRatio: 86 / 54 },
  { id: 'five_inch_portrait', label: '五寸竖版', aspectRatio: 86 / 108 },
  { id: 'five_inch_landscape', label: '五寸横版', aspectRatio: 108 / 86 },
  { id: 'square', label: '方形', aspectRatio: 1 },
] as const;

export type ChekiSpec = typeof CHEKI_SPECS[number]['id'];

export const DEFAULT_CHEKI_SPEC: ChekiSpec = 'three_inch_portrait';

const SPEC_BY_ID = new Map<ChekiSpec, typeof CHEKI_SPECS[number]>(
  CHEKI_SPECS.map((spec) => [spec.id, spec]),
);

export function isChekiSpec(value: unknown): value is ChekiSpec {
  return typeof value === 'string' && SPEC_BY_ID.has(value as ChekiSpec);
}

export function normalizeChekiSpec(value: unknown): ChekiSpec {
  return isChekiSpec(value) ? value : DEFAULT_CHEKI_SPEC;
}

export function getChekiSpecLabel(spec: ChekiSpec): string {
  return SPEC_BY_ID.get(spec)?.label ?? SPEC_BY_ID.get(DEFAULT_CHEKI_SPEC)!.label;
}

export function getChekiSpecAspectRatio(spec: ChekiSpec): number {
  return SPEC_BY_ID.get(spec)?.aspectRatio
    ?? SPEC_BY_ID.get(DEFAULT_CHEKI_SPEC)!.aspectRatio;
}

/**
 * 根据图片宽高推断新增拍立得的规格方向。
 * 尺寸族固定为三寸；只推断竖版/横版，不推断方形。
 * 宽大于高视为横版，否则（含方形）视为竖版。
 */
export function inferChekiSpecFromImageSize(width: number, height: number): ChekiSpec {
  return width > height ? 'three_inch_landscape' : 'three_inch_portrait';
}

export function formatChekiSpecDistribution(specs: readonly ChekiSpec[]): string {
  const counts = new Map<ChekiSpec, number>();
  for (const spec of specs) counts.set(spec, (counts.get(spec) ?? 0) + 1);
  return CHEKI_SPECS
    .flatMap((spec) => {
      const count = counts.get(spec.id) ?? 0;
      return count > 0 ? [`${spec.label} ${count}`] : [];
    })
    .join(' · ');
}

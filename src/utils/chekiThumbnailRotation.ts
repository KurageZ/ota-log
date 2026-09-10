import type { ChekiSpec } from '../domain/chekiSpec';
import type { ChekiLandscapeRotation } from './chekiViewPreferences';

export interface RotatedChekiImageFrame {
  width: number;
  height: number;
  rotate: '90deg' | '-90deg';
}

export function isLandscapeChekiSpec(spec: ChekiSpec | undefined): boolean {
  return spec === 'three_inch_landscape' || spec === 'five_inch_landscape';
}

export function isLandscapeImageSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > height && height > 0;
}

export function resolveChekiLandscapeRotation({
  displayMode,
  preference,
  spec,
  isImageLandscape,
  fiveInchLandscape = false,
}: {
  displayMode: 'portrait' | 'original';
  preference: ChekiLandscapeRotation;
  spec: ChekiSpec | undefined;
  isImageLandscape: boolean;
  fiveInchLandscape?: boolean;
}): ChekiLandscapeRotation {
  if (displayMode !== 'portrait') return 'original';
  if (fiveInchLandscape && spec === 'five_inch_portrait') return 'clockwise';
  if (fiveInchLandscape && spec === 'five_inch_landscape') return 'original';
  if (preference === 'original') return 'original';
  if (!isLandscapeChekiSpec(spec) || !isImageLandscape) return 'original';
  return preference;
}

export function getRotatedChekiImageFrame(
  outerWidth: number,
  outerHeight: number,
  rotation: Exclude<ChekiLandscapeRotation, 'original'>,
): RotatedChekiImageFrame {
  return {
    width: outerHeight,
    height: outerWidth,
    rotate: rotation === 'clockwise' ? '90deg' : '-90deg',
  };
}

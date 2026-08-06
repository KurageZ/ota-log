export const STICKER_CAMERA_ASPECT_RATIO = 3 / 4;
export const STICKER_CAMERA_MAX_OUTPUT_DIMENSION = 2400;

export interface StickerPreset {
  maxWidthRatio: number;
  maxHeightRatio: number;
  rightMarginRatio: number;
  bottomMarginRatio: number;
  cornerRadiusRatio: number;
  rotationDegrees: number;
}

export interface StickerLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  rotationDegrees: number;
}

export const DEFAULT_STICKER_PRESET: StickerPreset = {
  maxWidthRatio: 0.38,
  maxHeightRatio: 0.46,
  rightMarginRatio: 0.045,
  bottomMarginRatio: 0.045,
  cornerRadiusRatio: 0.035,
  rotationDegrees: -7,
};

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function resolveStickerLayout(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  preset: StickerPreset = DEFAULT_STICKER_PRESET,
): StickerLayout {
  const safeCanvasWidth = positiveDimension(canvasWidth);
  const safeCanvasHeight = positiveDimension(canvasHeight);
  const imageAspectRatio = positiveDimension(imageWidth) / positiveDimension(imageHeight);
  const maxStickerWidth = safeCanvasWidth * preset.maxWidthRatio;
  const maxStickerHeight = safeCanvasHeight * preset.maxHeightRatio;

  let stickerWidth = maxStickerWidth;
  let stickerHeight = stickerWidth / imageAspectRatio;
  if (stickerHeight > maxStickerHeight) {
    const scale = maxStickerHeight / stickerHeight;
    stickerWidth *= scale;
    stickerHeight *= scale;
  }

  const x = safeCanvasWidth - (safeCanvasWidth * preset.rightMarginRatio) - stickerWidth;
  const y = safeCanvasHeight - (safeCanvasHeight * preset.bottomMarginRatio) - stickerHeight;

  return {
    x,
    y,
    width: stickerWidth,
    height: stickerHeight,
    cornerRadius: stickerWidth * preset.cornerRadiusRatio,
    rotationDegrees: preset.rotationDegrees,
  };
}

/**
 * Expo Camera on iOS already processes a captured photo to match CameraView.
 * Only cap the preview-matched photo's long edge; cropping again changes framing.
 */
export function getPreviewMatchedResizeHeight(
  width: number,
  height: number,
): number {
  const safeWidth = positiveDimension(width);
  const safeHeight = positiveDimension(height);
  const scale = Math.min(
    1,
    STICKER_CAMERA_MAX_OUTPUT_DIMENSION / Math.max(safeWidth, safeHeight),
  );
  return Math.max(1, Math.round(safeHeight * scale));
}

export const STICKER_CAMERA_ASPECT_RATIO = 3 / 4;
export const STICKER_CAMERA_MAX_OUTPUT_DIMENSION = 2400;

const FAN_MIN_HALF_ANGLE_DEGREES = 6;
const FAN_MAX_HALF_ANGLE_DEGREES = 70;

export interface StickerPreset {
  singleMaxWidthRatio: number;
  singleMaxHeightRatio: number;
  fanMaxWidthRatio: number;
  fanMaxHeightRatio: number;
  horizontalMarginRatio: number;
  bottomMarginRatio: number;
  cornerRadiusRatio: number;
  singleRotationDegrees: number;
  fanArcDropRatio: number;
  fanPairSpanRatio: number;
}

export interface StickerLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  rotationDegrees: number;
}

export interface StickerLayoutSource {
  width: number;
  height: number;
}

export const DEFAULT_STICKER_PRESET: StickerPreset = {
  singleMaxWidthRatio: 0.36,
  singleMaxHeightRatio: 0.44,
  fanMaxWidthRatio: 0.31,
  fanMaxHeightRatio: 0.39,
  horizontalMarginRatio: 0.055,
  bottomMarginRatio: 0.045,
  cornerRadiusRatio: 0.035,
  singleRotationDegrees: -6,
  fanArcDropRatio: 0.1,
  fanPairSpanRatio: 0.65,
};

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function resolveStickerSize(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  maxWidthRatio: number,
  maxHeightRatio: number,
): { width: number; height: number } {
  const safeCanvasWidth = positiveDimension(canvasWidth);
  const safeCanvasHeight = positiveDimension(canvasHeight);
  const imageAspectRatio = positiveDimension(imageWidth) / positiveDimension(imageHeight);
  const maxStickerWidth = safeCanvasWidth * maxWidthRatio;
  const maxStickerHeight = safeCanvasHeight * maxHeightRatio;

  let width = maxStickerWidth;
  let height = width / imageAspectRatio;
  if (height > maxStickerHeight) {
    const scale = maxStickerHeight / height;
    width *= scale;
    height *= scale;
  }
  return { width, height };
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
  const size = resolveStickerSize(
    safeCanvasWidth,
    safeCanvasHeight,
    imageWidth,
    imageHeight,
    preset.singleMaxWidthRatio,
    preset.singleMaxHeightRatio,
  );

  return {
    x: safeCanvasWidth * preset.horizontalMarginRatio,
    y: safeCanvasHeight - (safeCanvasHeight * preset.bottomMarginRatio) - size.height,
    width: size.width,
    height: size.height,
    cornerRadius: size.width * preset.cornerRadiusRatio,
    rotationDegrees: preset.singleRotationDegrees,
  };
}

export function resolveStickerStackLayouts(
  canvasWidth: number,
  canvasHeight: number,
  sources: StickerLayoutSource[],
  preset: StickerPreset = DEFAULT_STICKER_PRESET,
): StickerLayout[] {
  if (sources.length === 0) return [];
  if (sources.length === 1) {
    return [resolveStickerLayout(
      canvasWidth,
      canvasHeight,
      sources[0].width,
      sources[0].height,
      preset,
    )];
  }

  const safeCanvasWidth = positiveDimension(canvasWidth);
  const safeCanvasHeight = positiveDimension(canvasHeight);
  const sizes = sources.map((source) => resolveStickerSize(
    safeCanvasWidth,
    safeCanvasHeight,
    source.width,
    source.height,
    preset.fanMaxWidthRatio,
    preset.fanMaxHeightRatio,
  ));
  const maxHeight = Math.max(...sizes.map(({ height }) => height));
  const edgeWidth = Math.max(sizes[0].width, sizes[sizes.length - 1].width);
  const bottomMargin = safeCanvasHeight * preset.bottomMarginRatio;
  const horizontalMargin = safeCanvasWidth * preset.horizontalMarginRatio;
  const fullHalfSpan = Math.max(
    1,
    (safeCanvasWidth / 2) - horizontalMargin - (edgeWidth / 2),
  );
  // 两张时向中间靠拢，不铺满整个画面宽度。
  const halfSpan = sources.length === 2
    ? Math.max(1, fullHalfSpan * preset.fanPairSpanRatio)
    : fullHalfSpan;
  // 拍立得中心连线落在圆弧上：中间中心最高，两侧沿弧线下沉 sag。
  const sag = maxHeight * preset.fanArcDropRatio;
  const rawHalfAngleDegrees = 2 * Math.atan(sag / halfSpan) * (180 / Math.PI);
  const halfAngleDegrees = Math.min(
    FAN_MAX_HALF_ANGLE_DEGREES,
    Math.max(FAN_MIN_HALF_ANGLE_DEGREES, rawHalfAngleDegrees),
  );
  const halfAngleRadians = halfAngleDegrees * (Math.PI / 180);
  const radius = halfSpan / Math.sin(halfAngleRadians);
  const middleCenterY = safeCanvasHeight - bottomMargin - (maxHeight / 2) - sag;
  const pivotY = middleCenterY + radius;

  return sizes.map((size, index) => {
    const progress = index / (sizes.length - 1);
    const rotationDegrees = -halfAngleDegrees + (halfAngleDegrees * 2 * progress);
    const radians = rotationDegrees * (Math.PI / 180);
    const centerX = (safeCanvasWidth / 2) + (Math.sin(radians) * radius);
    const centerY = pivotY - (Math.cos(radians) * radius);

    return {
      x: centerX - (size.width / 2),
      y: centerY - (size.height / 2),
      width: size.width,
      height: size.height,
      cornerRadius: size.width * preset.cornerRadiusRatio,
      rotationDegrees,
    };
  });
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

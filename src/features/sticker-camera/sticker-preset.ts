import type { ChekiSpec } from '../../domain/chekiSpec';

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
  spec?: ChekiSpec;
  width: number;
  height: number;
}

export interface StickerCameraPhotoTransform {
  crop: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  } | null;
  resizeHeight: number;
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
  if (sources.some(({ spec }) => spec === 'five_inch_landscape')) {
    // 一个单位为三寸竖版的宽度；五寸横版占两个单位。
    const single = sources.length === 1;
    const unit = Math.min(
      canvasWidth * (single ? preset.singleMaxWidthRatio : preset.fanMaxWidthRatio),
      canvasHeight * (single ? preset.singleMaxHeightRatio : preset.fanMaxHeightRatio) * 54 / 86,
    );
    const sizes = sources.map((source) => {
      const ratio = positiveDimension(source.width) / positiveDimension(source.height);
      const boxWidth = source.spec === 'five_inch_landscape' ? 108
        : source.spec === 'three_inch_landscape' ? 86 : 54;
      const boxHeight = source.spec === 'three_inch_landscape' ? 54 : 86;
      const width = Math.min(boxWidth, boxHeight * ratio) * unit / 54;
      return { width, height: width / ratio, slots: boxWidth / 54 };
    });
    const totalSlots = sizes.reduce((sum, size) => sum + size.slots, 0);
    const firstCenter = sizes[0].slots / 2;
    const lastCenter = totalSlots - sizes[sizes.length - 1].slots / 2;
    const halfSpan = canvasWidth * 0.32 * (sources.length === 2 ? preset.fanPairSpanRatio : 1);
    let cursor = 0;
    const layouts = sizes.map((size) => {
      const progress = single ? 0.5 : (cursor + size.slots / 2 - firstCenter) / (lastCenter - firstCenter);
      cursor += size.slots;
      const angle = single ? preset.singleRotationDegrees : (progress * 2 - 1) * 12;
      return {
        x: (progress * 2 - 1) * halfSpan - size.width / 2,
        y: Math.pow(progress * 2 - 1, 2) * unit * preset.fanArcDropRatio - size.height / 2,
        width: size.width,
        height: size.height,
        cornerRadius: size.width * preset.cornerRadiusRatio,
        rotationDegrees: angle,
      };
    });
    // 以旋转后的实际外沿整体适配画布，保持所有规格的共同缩放比例。
    const bounds = layouts.map((layout) => {
      const radians = layout.rotationDegrees * Math.PI / 180;
      const width = Math.abs(Math.cos(radians)) * layout.width + Math.abs(Math.sin(radians)) * layout.height;
      const height = Math.abs(Math.sin(radians)) * layout.width + Math.abs(Math.cos(radians)) * layout.height;
      const x = layout.x + layout.width / 2;
      const y = layout.y + layout.height / 2;
      return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
    });
    const left = Math.min(...bounds.map((bound) => bound.left));
    const right = Math.max(...bounds.map((bound) => bound.right));
    const top = Math.min(...bounds.map((bound) => bound.top));
    const bottom = Math.max(...bounds.map((bound) => bound.bottom));
    const margin = canvasWidth * preset.horizontalMarginRatio;
    const scale = Math.min(1, (canvasWidth - margin * 2) / (right - left),
      canvasHeight * (1 - preset.bottomMarginRatio * 2) / (bottom - top));
    const offsetX = single ? margin - left * scale : canvasWidth / 2 - (left + right) / 2 * scale;
    const offsetY = canvasHeight * (1 - preset.bottomMarginRatio) - bottom * scale;
    return layouts.map((layout) => ({
      ...layout,
      x: layout.x * scale + offsetX,
      y: layout.y * scale + offsetY,
      width: layout.width * scale,
      height: layout.height * scale,
      cornerRadius: layout.cornerRadius * scale,
    }));
  }
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
 * Keep the exported photo aligned with the fixed 3:4 preview. Android camera
 * implementations can still return a nearby sensor size when 4:3 is requested,
 * so center-crop only when needed and then cap the long edge.
 */
export function resolveStickerCameraPhotoTransform(
  width: number,
  height: number,
): StickerCameraPhotoTransform {
  const safeWidth = positiveDimension(width);
  const safeHeight = positiveDimension(height);
  const sourceAspectRatio = safeWidth / safeHeight;
  let cropWidth = safeWidth;
  let cropHeight = safeHeight;

  if (sourceAspectRatio > STICKER_CAMERA_ASPECT_RATIO) {
    cropWidth = Math.max(1, Math.min(
      safeWidth,
      Math.round(safeHeight * STICKER_CAMERA_ASPECT_RATIO),
    ));
  } else if (sourceAspectRatio < STICKER_CAMERA_ASPECT_RATIO) {
    cropHeight = Math.max(1, Math.min(
      safeHeight,
      Math.round(safeWidth / STICKER_CAMERA_ASPECT_RATIO),
    ));
  }

  const needsCrop = cropWidth !== safeWidth || cropHeight !== safeHeight;
  const scale = Math.min(
    1,
    STICKER_CAMERA_MAX_OUTPUT_DIMENSION / Math.max(cropWidth, cropHeight),
  );
  return {
    crop: needsCrop ? {
      originX: Math.max(0, Math.floor((safeWidth - cropWidth) / 2)),
      originY: Math.max(0, Math.floor((safeHeight - cropHeight) / 2)),
      width: cropWidth,
      height: cropHeight,
    } : null,
    resizeHeight: Math.max(1, Math.round(cropHeight * scale)),
  };
}

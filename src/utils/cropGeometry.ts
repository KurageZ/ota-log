export interface CropTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export const MIN_CROP_SCALE = 1;
export const MAX_CROP_SCALE = 5;

/**
 * Display size (in container points) needed to cover the crop frame while
 * preserving the image's natural aspect ratio.
 */
export function getCoverDisplaySize(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): { width: number; height: number } {
  'worklet';
  if (imageWidth <= 0 || imageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { width: Math.max(0, containerWidth), height: Math.max(0, containerHeight) };
  }

  const imageAspect = imageWidth / imageHeight;
  const containerAspect = containerWidth / containerHeight;
  if (imageAspect >= containerAspect) {
    return { width: containerHeight * imageAspect, height: containerHeight };
  }
  return { width: containerWidth, height: containerWidth / imageAspect };
}

/**
 * Clamps scale to [MIN_CROP_SCALE, MAX_CROP_SCALE] and clamps the translation
 * so the scaled image always covers the entire crop frame.
 */
export function clampCropTransform(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  scale: number,
  translateX: number,
  translateY: number,
): CropTransform {
  'worklet';
  const clampedScale = Math.min(MAX_CROP_SCALE, Math.max(MIN_CROP_SCALE, scale));
  const display = getCoverDisplaySize(containerWidth, containerHeight, imageWidth, imageHeight);
  const displayWidth = display.width * clampedScale;
  const displayHeight = display.height * clampedScale;
  const maxX = Math.max(0, (displayWidth - containerWidth) / 2);
  const maxY = Math.max(0, (displayHeight - containerHeight) / 2);

  return {
    scale: clampedScale,
    translateX: Math.min(maxX, Math.max(-maxX, translateX)),
    translateY: Math.min(maxY, Math.max(-maxY, translateY)),
  };
}

/**
 * Converts the current on-screen transform into a crop rectangle in original
 * image pixel coordinates. The returned rect always lies within the image.
 */
export function getCropRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  scale: number,
  translateX: number,
  translateY: number,
): CropRect {
  'worklet';
  if (imageWidth <= 0 || imageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return {
      originX: 0,
      originY: 0,
      width: Math.max(0, imageWidth),
      height: Math.max(0, imageHeight),
    };
  }

  const transform = clampCropTransform(
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
    scale,
    translateX,
    translateY,
  );
  const display = getCoverDisplaySize(containerWidth, containerHeight, imageWidth, imageHeight);
  const displayWidth = display.width * transform.scale;
  const displayHeight = display.height * transform.scale;
  const pixelsPerDisplayX = imageWidth / displayWidth;
  const pixelsPerDisplayY = imageHeight / displayHeight;

  // The scaled image's top-left corner in container coordinates.
  const left = containerWidth / 2 + transform.translateX - displayWidth / 2;
  const top = containerHeight / 2 + transform.translateY - displayHeight / 2;

  const width = Math.min(imageWidth, Math.round(containerWidth * pixelsPerDisplayX));
  const height = Math.min(imageHeight, Math.round(containerHeight * pixelsPerDisplayY));
  const originX = Math.min(
    Math.max(0, Math.round(-left * pixelsPerDisplayX)),
    Math.max(0, imageWidth - width),
  );
  const originY = Math.min(
    Math.max(0, Math.round(-top * pixelsPerDisplayY)),
    Math.max(0, imageHeight - height),
  );

  return { originX, originY, width, height };
}

import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  BlurStyle,
  ClipOp,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  type SkData,
  type SkImage,
  type SkMaskFilter,
  type SkPaint,
  type SkSurface,
} from '@shopify/react-native-skia';
import {
  getPreviewMatchedResizeHeight,
  resolveStickerLayout,
} from './sticker-preset';
import type { StickerAsset } from './sticker-overlay';
import { deleteTemporaryStickerFile } from './file-utils';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface ComposedStickerPhoto {
  uri: string;
  width: number;
  height: number;
}

function outputFilename(): string {
  return `sticker_camera_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
}

function dispose(resource: { dispose(): void } | null | undefined): void {
  try {
    resource?.dispose();
  } catch {
    // Releasing graphics resources is best effort after the result has been encoded.
  }
}

async function decodeImage(uri: string): Promise<{ data: SkData; image: SkImage }> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) {
    dispose(data);
    throw new Error('无法读取图片，请重新选择后再试');
  }
  return { data, image };
}

function drawBackground(
  surface: SkSurface,
  background: SkImage,
  width: number,
  height: number,
  paint: SkPaint,
): void {
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('#000000'));
  canvas.drawImageRectOptions(
    background,
    Skia.XYWHRect(0, 0, background.width(), background.height()),
    Skia.XYWHRect(0, 0, width, height),
    FilterMode.Linear,
    MipmapMode.None,
    paint,
  );
}

function drawSticker(
  surface: SkSurface,
  sticker: SkImage,
  width: number,
  height: number,
): { paints: SkPaint[]; maskFilter: SkMaskFilter } {
  const canvas = surface.getCanvas();
  const layout = resolveStickerLayout(
    width,
    height,
    sticker.width(),
    sticker.height(),
  );
  const centerX = layout.x + (layout.width / 2);
  const centerY = layout.y + (layout.height / 2);
  const imageRect = Skia.XYWHRect(layout.x, layout.y, layout.width, layout.height);
  const imageRRect = Skia.RRectXY(imageRect, layout.cornerRadius, layout.cornerRadius);

  const shadowPaint = Skia.Paint();
  shadowPaint.setAntiAlias(true);
  shadowPaint.setColor(Skia.Color('rgba(0, 0, 0, 0.3)'));
  const maskFilter = Skia.MaskFilter.MakeBlur(
    BlurStyle.Normal,
    Math.max(2, layout.width * 0.035),
    true,
  );
  shadowPaint.setMaskFilter(maskFilter);

  const imagePaint = Skia.Paint();
  imagePaint.setAntiAlias(true);

  canvas.save();
  canvas.rotate(layout.rotationDegrees, centerX, centerY);
  canvas.save();
  canvas.translate(0, Math.max(2, layout.width * 0.025));
  canvas.drawRRect(imageRRect, shadowPaint);
  canvas.restore();
  canvas.save();
  canvas.clipRRect(
    imageRRect,
    ClipOp.Intersect,
    true,
  );
  canvas.drawImageRectOptions(
    sticker,
    Skia.XYWHRect(0, 0, sticker.width(), sticker.height()),
    imageRect,
    FilterMode.Linear,
    MipmapMode.None,
    imagePaint,
  );
  canvas.restore();
  canvas.restore();

  return { paints: [shadowPaint, imagePaint], maskFilter };
}

export async function composeStickerPhoto(
  photo: CapturedPhoto,
  sticker: StickerAsset,
): Promise<ComposedStickerPhoto> {
  const resizeHeight = getPreviewMatchedResizeHeight(photo.width, photo.height);
  let normalizedPhotoUri: string | null = null;
  let backgroundData: SkData | null = null;
  let stickerData: SkData | null = null;
  let backgroundImage: SkImage | null = null;
  let stickerImage: SkImage | null = null;
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
  let backgroundPaint: SkPaint | null = null;
  let stickerPaints: SkPaint[] = [];
  let maskFilter: SkMaskFilter | null = null;

  try {
    const normalized = await manipulateAsync(
      photo.uri,
      [{ resize: { height: resizeHeight } }],
      { compress: 0.95, format: SaveFormat.JPEG },
    );
    normalizedPhotoUri = normalized.uri;
    const outputSize = { width: normalized.width, height: normalized.height };

    const background = await decodeImage(normalized.uri);
    backgroundData = background.data;
    backgroundImage = background.image;
    const decodedSticker = await decodeImage(sticker.uri);
    stickerData = decodedSticker.data;
    stickerImage = decodedSticker.image;

    surface = Skia.Surface.MakeOffscreen(outputSize.width, outputSize.height);
    if (!surface) throw new Error('无法创建图片合成画布');

    backgroundPaint = Skia.Paint();
    backgroundPaint.setAntiAlias(true);
    drawBackground(surface, backgroundImage, outputSize.width, outputSize.height, backgroundPaint);
    const stickerResources = drawSticker(
      surface,
      stickerImage,
      outputSize.width,
      outputSize.height,
    );
    stickerPaints = stickerResources.paints;
    maskFilter = stickerResources.maskFilter;

    surface.flush();
    snapshot = surface.makeImageSnapshot();
    const jpegBytes = snapshot.encodeToBytes(ImageFormat.JPEG, 92);
    if (jpegBytes.length === 0) throw new Error('合成图片编码失败');

    const output = new File(Paths.document, outputFilename());
    output.write(jpegBytes);
    return {
      uri: output.uri,
      width: outputSize.width,
      height: outputSize.height,
    };
  } finally {
    deleteTemporaryStickerFile(normalizedPhotoUri);
    dispose(snapshot);
    for (const paint of stickerPaints) dispose(paint);
    dispose(maskFilter);
    dispose(backgroundPaint);
    dispose(surface);
    dispose(stickerImage);
    dispose(backgroundImage);
    dispose(stickerData);
    dispose(backgroundData);
  }
}

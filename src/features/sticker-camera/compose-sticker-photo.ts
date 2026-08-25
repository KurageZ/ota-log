import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import {
  BlurStyle,
  ClipOp,
  FilterMode,
  FontWeight,
  ImageFormat,
  MipmapMode,
  Skia,
  TextAlign,
  type SkData,
  type SkImage,
  type SkMaskFilter,
  type SkPaint,
  type SkParagraph,
  type SkSurface,
} from '@shopify/react-native-skia';
import {
  resolveStickerCameraPhotoTransform,
  resolveStickerStackLayouts,
  type StickerLayout,
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

export interface ComposeStickerPhotoOptions {
  watermark?: boolean;
}

const WATERMARK_TEXT = 'ota log';
const WATERMARK_TEXT_WIDTH_RATIO = 0.024;
const WATERMARK_BOTTOM_RATIO = 0.02;

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
  layout: StickerLayout,
): { paints: SkPaint[]; maskFilter: SkMaskFilter } {
  const canvas = surface.getCanvas();
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

function drawWatermark(
  surface: SkSurface,
  width: number,
  height: number,
): SkParagraph {
  const canvas = surface.getCanvas();
  const fontSize = Math.max(18, Math.round(width * WATERMARK_TEXT_WIDTH_RATIO));
  // 该版本 Skia 的 ParagraphBuilder 原生没有导出 dispose，只能留给 GC；
  // 真正需要释放的 paragraph 由调用方在 finally 中统一 dispose。
  const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center });
  builder.pushStyle({
    color: Skia.Color('rgba(255, 255, 255, 0.78)'),
    fontFamilies: ['sans-serif'],
    fontSize,
    fontStyle: { weight: FontWeight.Bold },
    heightMultiplier: 1,
    locale: 'zh-CN',
  });
  builder.addText(WATERMARK_TEXT);
  const paragraph = builder.build();
  paragraph.layout(width);

  // 中间最下方：水平居中，贴底部留出边距。
  const bottomPadding = Math.max(14, Math.round(height * WATERMARK_BOTTOM_RATIO));
  paragraph.paint(canvas, 0, height - paragraph.getHeight() - bottomPadding);
  return paragraph;
}

export async function composeStickerPhoto(
  photo: CapturedPhoto,
  stickers: StickerAsset[],
  options: ComposeStickerPhotoOptions = {},
): Promise<ComposedStickerPhoto> {
  if (stickers.length === 0) throw new Error('至少需要一张贴纸');
  const transform = resolveStickerCameraPhotoTransform(photo.width, photo.height);
  let normalizedPhotoUri: string | null = null;
  let backgroundData: SkData | null = null;
  let backgroundImage: SkImage | null = null;
  const stickerData: SkData[] = [];
  const stickerImages: SkImage[] = [];
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
  let backgroundPaint: SkPaint | null = null;
  let watermark: SkParagraph | null = null;
  const stickerPaints: SkPaint[] = [];
  const maskFilters: SkMaskFilter[] = [];

  try {
    const actions: Action[] = [];
    if (transform.crop) actions.push({ crop: transform.crop });
    actions.push({ resize: { height: transform.resizeHeight } });
    const normalized = await manipulateAsync(
      photo.uri,
      actions,
      { compress: 0.95, format: SaveFormat.JPEG },
    );
    normalizedPhotoUri = normalized.uri;
    const outputSize = { width: normalized.width, height: normalized.height };

    const background = await decodeImage(normalized.uri);
    backgroundData = background.data;
    backgroundImage = background.image;
    for (const sticker of stickers) {
      const decodedSticker = await decodeImage(sticker.uri);
      stickerData.push(decodedSticker.data);
      stickerImages.push(decodedSticker.image);
    }

    surface = Skia.Surface.MakeOffscreen(outputSize.width, outputSize.height);
    if (!surface) throw new Error('无法创建图片合成画布');

    backgroundPaint = Skia.Paint();
    backgroundPaint.setAntiAlias(true);
    drawBackground(surface, backgroundImage, outputSize.width, outputSize.height, backgroundPaint);
    const layouts = resolveStickerStackLayouts(outputSize.width, outputSize.height, stickers);
    stickerImages.forEach((stickerImage, index) => {
      const layout = layouts[index];
      if (!layout) return;
      const stickerResources = drawSticker(surface!, stickerImage, layout);
      stickerPaints.push(...stickerResources.paints);
      maskFilters.push(stickerResources.maskFilter);
    });
    if (options.watermark) {
      watermark = drawWatermark(surface!, outputSize.width, outputSize.height);
    }

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
    for (const maskFilter of maskFilters) dispose(maskFilter);
    dispose(backgroundPaint);
    dispose(surface);
    dispose(watermark);
    for (const stickerImage of stickerImages) dispose(stickerImage);
    dispose(backgroundImage);
    for (const data of stickerData) dispose(data);
    dispose(backgroundData);
  }
}

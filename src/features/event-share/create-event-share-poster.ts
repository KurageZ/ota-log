import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import {
  ClipOp,
  FilterMode,
  FontWeight,
  ImageFormat,
  MipmapMode,
  PaintStyle,
  StrokeCap,
  Skia,
  TextAlign,
  type SkData,
  type SkImage,
  type SkPaint,
  type SkParagraph,
  type SkParagraphBuilder,
  type SkSurface,
} from '@shopify/react-native-skia';
import type { EventShareSession } from '../../utils/eventShare';
import {
  formatEventShareLocation,
  formatEventShareSessionDateTime,
} from '../../utils/eventShare';
import { buildPosterParagraphStyle } from './poster-paragraph-style';

const POSTER_WIDTH = 1200;
const POSTER_HEIGHT = 2160;
const PHOTO_HEIGHT = 1600;
const POSTER_PADDING = 56;
const FOOTER_Y = 2070;
const ARTIST_AVATAR_SIZE = 88;
const USER_AVATAR_SIZE = 50;
const MAX_ARTIST_AVATARS = 10;
const DEBUG_PREFIX = '[DEBUG-event-share]';

const COLORS = {
  surface: '#f8f6fb',
  imageFallback: '#eee8f5',
  text: '#211b29',
  secondary: '#675f70',
  muted: '#8d8497',
  divider: '#ddd6e5',
  accent: '#7650a6',
  accentSoft: '#e6daf2',
  accentFaint: '#f0e9f7',
};

export interface CreateEventSharePosterInput {
  title: string;
  sessions: EventShareSession[];
  photoUris: string[];
  artists: EventSharePosterArtist[];
  profile: EventSharePosterProfile;
}

export interface EventSharePosterArtist {
  name: string;
  avatarUri: string | null;
}

export interface EventSharePosterProfile {
  name: string;
  avatarUri: string | null;
  avatarEmoji: string;
}

export interface EventSharePosterResult {
  uri: string;
  width: number;
  height: number;
}

interface DecodedImage {
  data: SkData;
  image: SkImage;
}

interface ParagraphOptions {
  fontSize: number;
  weight: FontWeight;
  color: string;
  maxLines?: number;
  textAlign?: TextAlign;
  heightMultiplier?: number;
}

function dispose(resource: { dispose(): void } | null | undefined): void {
  try {
    resource?.dispose();
  } catch {
    // Graphics cleanup is best effort after the JPEG has been encoded.
  }
}

function outputFilename(): string {
  return `event_share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
}

async function tryDecodeImage(uri: string): Promise<DecodedImage | null> {
  let data: SkData | null = null;
  try {
    data = await Skia.Data.fromURI(uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      dispose(data);
      return null;
    }
    return { data, image };
  } catch {
    dispose(data);
    return null;
  }
}

async function decodeFirstAvailableImage(uris: string[]): Promise<DecodedImage | null> {
  for (const [index, uri] of uris.entries()) {
    const decoded = await tryDecodeImage(uri);
    if (decoded) return decoded;
    console.warn(DEBUG_PREFIX, 'photo decode failed, trying next candidate', {
      candidateIndex: index,
      candidateCount: uris.length,
    });
  }
  return null;
}

function createPaint(color: string): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  return paint;
}

function createParagraph(
  text: string,
  width: number,
  options: ParagraphOptions,
): SkParagraph {
  let builder: SkParagraphBuilder | null = null;
  let stage = 'make-builder';
  try {
    builder = Skia.ParagraphBuilder.Make(buildPosterParagraphStyle(
      options.maxLines,
      options.textAlign ?? TextAlign.Left,
    ));
    stage = 'push-style';
    builder.pushStyle({
      color: Skia.Color(options.color),
      fontFamilies: ['sans-serif'],
      fontSize: options.fontSize,
      fontStyle: { weight: options.weight },
      heightMultiplier: options.heightMultiplier ?? 1.18,
      locale: 'zh-CN',
    });
    stage = 'add-text';
    builder.addText(text);
    stage = 'build';
    const paragraph = builder.build();
    stage = 'layout';
    paragraph.layout(width);
    return paragraph;
  } catch (error) {
    console.error(DEBUG_PREFIX, 'paragraph creation failed', {
      stage,
      textLength: text.length,
      width,
      fontSize: options.fontSize,
      maxLines: options.maxLines ?? null,
      error,
    });
    throw error;
  } finally {
    dispose(builder);
  }
}

function createTitleParagraph(title: string, width: number, maxHeight: number): SkParagraph {
  for (let fontSize = 68; fontSize >= 44; fontSize -= 4) {
    const candidate = createParagraph(title, width, {
      fontSize,
      weight: FontWeight.Black,
      color: COLORS.text,
      heightMultiplier: 1.02,
    });
    if (candidate.getLineMetrics().length <= 2 && candidate.getHeight() <= maxHeight) {
      return candidate;
    }
    dispose(candidate);
  }

  return createParagraph(title, width, {
    fontSize: 44,
    weight: FontWeight.Black,
    color: COLORS.text,
    maxLines: 2,
    heightMultiplier: 1.02,
  });
}

function drawNoPhotoBackground(surface: SkSurface, imageHeight: number): SkPaint[] {
  const canvas = surface.getCanvas();
  const paints: SkPaint[] = [];
  const basePaint = createPaint(COLORS.imageFallback);
  const accentPaint = createPaint(COLORS.accentSoft);
  const faintPaint = createPaint(COLORS.accentFaint);
  paints.push(basePaint, accentPaint, faintPaint);

  canvas.drawRect(Skia.XYWHRect(0, 0, POSTER_WIDTH, imageHeight), basePaint);
  canvas.drawCircle(1030, 70, 360, accentPaint);
  canvas.drawCircle(140, imageHeight - 90, 290, faintPaint);
  canvas.save();
  canvas.rotate(-12, POSTER_WIDTH / 2, imageHeight / 2);
  canvas.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(250, imageHeight * 0.34, 780, 120), 60, 60),
    faintPaint,
  );
  canvas.restore();

  return paints;
}

function drawPhoto(surface: SkSurface, image: SkImage, imageHeight: number): SkPaint[] {
  const canvas = surface.getCanvas();
  const paints: SkPaint[] = [];
  const backgroundPaint = createPaint(COLORS.imageFallback);
  const imagePaint = Skia.Paint();
  imagePaint.setAntiAlias(true);
  paints.push(backgroundPaint, imagePaint);
  canvas.drawRect(Skia.XYWHRect(0, 0, POSTER_WIDTH, imageHeight), backgroundPaint);

  const sourceWidth = image.width();
  const sourceHeight = image.height();
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = POSTER_WIDTH / imageHeight;
  const extremeAspect = sourceAspect > 2.4 || sourceAspect < 0.42;

  if (extremeAspect) {
    const scale = Math.min(POSTER_WIDTH / sourceWidth, imageHeight / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    canvas.drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, sourceWidth, sourceHeight),
      Skia.XYWHRect((POSTER_WIDTH - width) / 2, (imageHeight - height) / 2, width, height),
      FilterMode.Linear,
      MipmapMode.None,
      imagePaint,
    );
    return paints;
  }

  let sourceRect;
  if (sourceAspect > targetAspect) {
    const cropWidth = sourceHeight * targetAspect;
    sourceRect = Skia.XYWHRect((sourceWidth - cropWidth) / 2, 0, cropWidth, sourceHeight);
  } else {
    const cropHeight = sourceWidth / targetAspect;
    sourceRect = Skia.XYWHRect(0, (sourceHeight - cropHeight) / 2, sourceWidth, cropHeight);
  }
  canvas.drawImageRectOptions(
    image,
    sourceRect,
    Skia.XYWHRect(0, 0, POSTER_WIDTH, imageHeight),
    FilterMode.Linear,
    MipmapMode.None,
    imagePaint,
  );
  return paints;
}

function drawInfoIcon(
  surface: SkSurface,
  kind: 'time' | 'location',
  x: number,
  y: number,
): SkPaint[] {
  // The poster is rendered on an offscreen Skia canvas, so it cannot mount
  // AppIcon directly. These two vectors mirror the mapped eventDate and
  // eventLocation business icons used by the app UI.
  const canvas = surface.getCanvas();
  const paints: SkPaint[] = [];
  const strokePaint = createPaint(COLORS.accent);
  strokePaint.setStyle(PaintStyle.Stroke);
  strokePaint.setStrokeWidth(3.5);
  strokePaint.setStrokeCap(StrokeCap.Round);
  paints.push(strokePaint);

  const centerX = x + 16;
  if (kind === 'time') {
    canvas.drawCircle(centerX, y + 16, 12, strokePaint);
    canvas.drawLine(centerX, y + 16, centerX, y + 9, strokePaint);
    canvas.drawLine(centerX, y + 16, centerX + 6, y + 20, strokePaint);
    return paints;
  }

  const pinPath = Skia.Path.Make();
  pinPath.moveTo(centerX, y + 31);
  pinPath.cubicTo(centerX - 2, y + 26, centerX - 11, y + 19, centerX - 11, y + 11);
  pinPath.cubicTo(centerX - 11, y + 4, centerX - 6, y, centerX, y);
  pinPath.cubicTo(centerX + 6, y, centerX + 11, y + 4, centerX + 11, y + 11);
  pinPath.cubicTo(centerX + 11, y + 19, centerX + 2, y + 26, centerX, y + 31);
  canvas.drawPath(pinPath, strokePaint);
  canvas.drawCircle(centerX, y + 11, 3.5, strokePaint);
  return paints;
}

function drawSessionRows(
  surface: SkSurface,
  sessions: EventShareSession[],
  startY: number,
): { paragraphs: SkParagraph[]; paints: SkPaint[]; endY: number } {
  const canvas = surface.getCanvas();
  const paragraphs: SkParagraph[] = [];
  const paints: SkPaint[] = [];
  const availableWidth = POSTER_WIDTH - (POSTER_PADDING * 2);
  const dateRowHeight = 78;
  const locationRowHeight = 74;
  let y = startY;

  const session = sessions[0];
  if (!session) return { paragraphs, paints, endY: startY };

  const locationText = formatEventShareLocation(session);
  const textX = POSTER_PADDING + 44;
  const textWidth = availableWidth - 44;
  const dateTime = createParagraph(formatEventShareSessionDateTime(session), textWidth, {
    fontSize: 34,
    weight: FontWeight.Bold,
    color: COLORS.text,
    maxLines: 1,
    heightMultiplier: 1,
  });
  paragraphs.push(dateTime);
  const dateTimeOffsetY = Math.max(0, (dateRowHeight - dateTime.getHeight()) / 2);
  paints.push(...drawInfoIcon(
    surface,
    'time',
    POSTER_PADDING,
    y + Math.max(0, (dateRowHeight - 32) / 2),
  ));
  dateTime.paint(canvas, textX, y + dateTimeOffsetY);
  y += dateRowHeight;

  const location = createParagraph(locationText, textWidth, {
    fontSize: 31,
    weight: FontWeight.Medium,
    color: COLORS.secondary,
    maxLines: 1,
    heightMultiplier: 1,
  });
  paragraphs.push(location);
  const locationOffsetY = Math.max(0, (locationRowHeight - location.getHeight()) / 2);
  paints.push(...drawInfoIcon(
    surface,
    'location',
    POSTER_PADDING,
    y + Math.max(0, (locationRowHeight - 32) / 2),
  ));
  location.paint(canvas, textX, y + locationOffsetY);
  y += locationRowHeight;

  return { paragraphs, paints, endY: y };
}

function avatarFallbackText(name: string): string {
  const normalized = name.trim();
  return normalized ? Array.from(normalized)[0] : '·';
}

function drawCircularAvatar(
  surface: SkSurface,
  image: SkImage | null,
  x: number,
  y: number,
  size: number,
  fallback: string,
): { paragraphs: SkParagraph[]; paints: SkPaint[] } {
  const canvas = surface.getCanvas();
  const paragraphs: SkParagraph[] = [];
  const paints: SkPaint[] = [];
  const backgroundPaint = createPaint(COLORS.accentSoft);
  const borderPaint = createPaint(COLORS.surface);
  borderPaint.setStyle(PaintStyle.Stroke);
  borderPaint.setStrokeWidth(3);
  paints.push(backgroundPaint, borderPaint);
  canvas.drawCircle(x + size / 2, y + size / 2, size / 2, backgroundPaint);

  if (image) {
    const imagePaint = Skia.Paint();
    imagePaint.setAntiAlias(true);
    paints.push(imagePaint);
    const sourceWidth = image.width();
    const sourceHeight = image.height();
    const cropSize = Math.min(sourceWidth, sourceHeight);
    const source = Skia.XYWHRect(
      (sourceWidth - cropSize) / 2,
      (sourceHeight - cropSize) / 2,
      cropSize,
      cropSize,
    );
    const destination = Skia.XYWHRect(x, y, size, size);
    canvas.save();
    canvas.clipRRect(Skia.RRectXY(destination, size / 2, size / 2), ClipOp.Intersect, true);
    canvas.drawImageRectOptions(
      image,
      source,
      destination,
      FilterMode.Linear,
      MipmapMode.None,
      imagePaint,
    );
    canvas.restore();
  } else {
    const fallbackParagraph = createParagraph(fallback, size, {
      fontSize: Math.round(size * 0.46),
      weight: FontWeight.Bold,
      color: COLORS.accent,
      textAlign: TextAlign.Center,
      maxLines: 1,
      heightMultiplier: 1,
    });
    paragraphs.push(fallbackParagraph);
    fallbackParagraph.paint(canvas, x, y + Math.round(size * 0.23));
  }

  canvas.drawCircle(x + size / 2, y + size / 2, size / 2 - 1.5, borderPaint);
  return { paragraphs, paints };
}

function drawArtistAvatars(
  surface: SkSurface,
  artists: EventSharePosterArtist[],
  images: Array<DecodedImage | null>,
  y: number,
): { paragraphs: SkParagraph[]; paints: SkPaint[] } {
  const canvas = surface.getCanvas();
  const paragraphs: SkParagraph[] = [];
  const paints: SkPaint[] = [];
  const hasOverflow = artists.length > MAX_ARTIST_AVATARS;
  const visibleArtists = artists.slice(0, MAX_ARTIST_AVATARS);
  const gap = 16;

  visibleArtists.forEach((artist, index) => {
    const x = POSTER_PADDING + index * (ARTIST_AVATAR_SIZE + gap);
    const resources = drawCircularAvatar(
      surface,
      images[index]?.image ?? null,
      x,
      y,
      ARTIST_AVATAR_SIZE,
      avatarFallbackText(artist.name),
    );
    paragraphs.push(...resources.paragraphs);
    paints.push(...resources.paints);

    if (hasOverflow && index === visibleArtists.length - 1) {
      const badgeSize = 38;
      const badgeX = x + ARTIST_AVATAR_SIZE - badgeSize + 6;
      const badgeY = y + ARTIST_AVATAR_SIZE - badgeSize + 6;
      const badgePaint = createPaint(COLORS.accent);
      const badgeBorderPaint = createPaint(COLORS.surface);
      badgeBorderPaint.setStyle(PaintStyle.Stroke);
      badgeBorderPaint.setStrokeWidth(4);
      paints.push(badgePaint, badgeBorderPaint);
      canvas.drawCircle(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, badgePaint);
      canvas.drawCircle(
        badgeX + badgeSize / 2,
        badgeY + badgeSize / 2,
        badgeSize / 2 - 2,
        badgeBorderPaint,
      );

      const count = createParagraph(`+${artists.length - visibleArtists.length}`, badgeSize, {
        fontSize: 17,
        weight: FontWeight.ExtraBold,
        color: COLORS.surface,
        textAlign: TextAlign.Center,
        maxLines: 1,
        heightMultiplier: 1,
      });
      paragraphs.push(count);
      count.paint(canvas, badgeX, badgeY + 10);
    }
  });
  return { paragraphs, paints };
}

async function loadLogo(): Promise<DecodedImage | null> {
  try {
    const asset = await Asset.fromModule(require('../../../assets/icon.png')).downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    return uri ? tryDecodeImage(uri) : null;
  } catch {
    return null;
  }
}

function drawBranding(surface: SkSurface, logo: SkImage | null): { paragraphs: SkParagraph[]; paints: SkPaint[] } {
  const canvas = surface.getCanvas();
  const paragraphs: SkParagraph[] = [];
  const paints: SkPaint[] = [];
  const iconSize = 50;
  const gap = 12;
  const textWidth = 116;
  const groupWidth = iconSize + gap + textWidth;
  const x = POSTER_WIDTH - POSTER_PADDING - groupWidth;
  const y = FOOTER_Y;

  if (logo) {
    const logoPaint = Skia.Paint();
    logoPaint.setAntiAlias(true);
    paints.push(logoPaint);
    const destination = Skia.XYWHRect(x, y, iconSize, iconSize);
    canvas.save();
    canvas.clipRRect(Skia.RRectXY(destination, 13, 13), ClipOp.Intersect, true);
    canvas.drawImageRectOptions(
      logo,
      Skia.XYWHRect(0, 0, logo.width(), logo.height()),
      destination,
      FilterMode.Linear,
      MipmapMode.None,
      logoPaint,
    );
    canvas.restore();
  }

  const wordmark = createParagraph('ota log', textWidth, {
    fontSize: 28,
    weight: FontWeight.ExtraBold,
    color: COLORS.text,
    maxLines: 1,
    heightMultiplier: 1,
  });
  paragraphs.push(wordmark);
  wordmark.paint(canvas, x + iconSize + gap, y + 8);
  return { paragraphs, paints };
}

function drawProfileAttribution(
  surface: SkSurface,
  profile: EventSharePosterProfile,
  avatar: DecodedImage | null,
): { paragraphs: SkParagraph[]; paints: SkPaint[] } {
  const paragraphs: SkParagraph[] = [];
  const paints: SkPaint[] = [];
  const avatarResources = drawCircularAvatar(
    surface,
    avatar?.image ?? null,
    POSTER_PADDING,
    FOOTER_Y,
    USER_AVATAR_SIZE,
    profile.avatarEmoji.trim() || avatarFallbackText(profile.name),
  );
  paragraphs.push(...avatarResources.paragraphs);
  paints.push(...avatarResources.paints);

  const attribution = createParagraph(`${profile.name.trim() || 'Otaku'} 分享给你`, 640, {
    fontSize: 27,
    weight: FontWeight.Bold,
    color: COLORS.secondary,
    maxLines: 1,
    heightMultiplier: 1,
  });
  paragraphs.push(attribution);
  attribution.paint(
    surface.getCanvas(),
    POSTER_PADDING + USER_AVATAR_SIZE + 16,
    FOOTER_Y + 10,
  );
  return { paragraphs, paints };
}

export async function createEventSharePoster({
  title,
  sessions,
  photoUris,
  artists,
  profile,
}: CreateEventSharePosterInput): Promise<EventSharePosterResult> {
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
  let photo: DecodedImage | null = null;
  let logo: DecodedImage | null = null;
  let profileAvatar: DecodedImage | null = null;
  let artistAvatars: Array<DecodedImage | null> = [];
  const paragraphs: SkParagraph[] = [];
  const paints: SkPaint[] = [];
  let stage = 'start';

  try {
    console.info(DEBUG_PREFIX, 'poster generation started', {
      sessionCount: sessions.length,
      photoCount: photoUris.length,
      artistCount: artists.length,
      titleLength: title.length,
    });
    stage = 'make-surface';
    surface = Skia.Surface.MakeOffscreen(POSTER_WIDTH, POSTER_HEIGHT);
    if (!surface) throw new Error('无法创建活动分享图片画布');
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color(COLORS.surface));

    stage = 'resolve-layout';
    const visible = sessions.slice(0, 1);
    stage = 'decode-photo';
    photo = await decodeFirstAvailableImage(photoUris);
    stage = photo ? 'draw-photo' : 'draw-no-photo-background';
    paints.push(...(photo
      ? drawPhoto(surface, photo.image, PHOTO_HEIGHT)
      : drawNoPhotoBackground(surface, PHOTO_HEIGHT)));

    stage = 'draw-title';
    const contentWidth = POSTER_WIDTH - (POSTER_PADDING * 2);
    const titleY = PHOTO_HEIGHT + 56;
    const titleParagraph = createTitleParagraph(title.trim(), contentWidth, 108);
    paragraphs.push(titleParagraph);
    titleParagraph.paint(canvas, POSTER_PADDING, titleY);

    stage = 'draw-sessions';
    const sessionsY = titleY + titleParagraph.getHeight() + 32;
    const sessionResources = drawSessionRows(
      surface,
      visible,
      sessionsY,
    );
    paragraphs.push(...sessionResources.paragraphs);
    paints.push(...sessionResources.paints);

    stage = 'load-artist-avatars';
    artistAvatars = await Promise.all(
      artists.slice(0, MAX_ARTIST_AVATARS).map((artist) => (
        artist.avatarUri ? tryDecodeImage(artist.avatarUri) : Promise.resolve(null)
      )),
    );
    stage = 'draw-artist-avatars';
    const artistY = Math.min(
      sessionResources.endY + 28,
      FOOTER_Y - ARTIST_AVATAR_SIZE - 20,
    );
    const artistResources = drawArtistAvatars(surface, artists, artistAvatars, artistY);
    paragraphs.push(...artistResources.paragraphs);
    paints.push(...artistResources.paints);

    stage = 'load-profile-avatar';
    profileAvatar = profile.avatarUri ? await tryDecodeImage(profile.avatarUri) : null;
    stage = 'draw-profile-attribution';
    const profileResources = drawProfileAttribution(surface, profile, profileAvatar);
    paragraphs.push(...profileResources.paragraphs);
    paints.push(...profileResources.paints);

    stage = 'load-logo';
    logo = await loadLogo();
    stage = 'draw-branding';
    const brandingResources = drawBranding(surface, logo?.image ?? null);
    paragraphs.push(...brandingResources.paragraphs);
    paints.push(...brandingResources.paints);

    stage = 'encode-jpeg';
    surface.flush();
    snapshot = surface.makeImageSnapshot();
    const jpegBytes = snapshot.encodeToBytes(ImageFormat.JPEG, 92);
    if (jpegBytes.length === 0) throw new Error('活动分享图片编码失败');

    stage = 'write-cache-file';
    const output = new File(Paths.cache, outputFilename());
    output.write(jpegBytes);
    console.info(DEBUG_PREFIX, 'poster generation completed', {
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      usedPhoto: photo != null,
      visibleSessionCount: visible.length,
    });
    return { uri: output.uri, width: POSTER_WIDTH, height: POSTER_HEIGHT };
  } catch (error) {
    console.error(DEBUG_PREFIX, 'poster generation failed', { stage, error });
    throw error;
  } finally {
    dispose(snapshot);
    paragraphs.forEach(dispose);
    paints.forEach(dispose);
    dispose(surface);
    dispose(logo?.image);
    dispose(logo?.data);
    dispose(photo?.image);
    dispose(photo?.data);
    dispose(profileAvatar?.image);
    dispose(profileAvatar?.data);
    artistAvatars.forEach((avatar) => {
      dispose(avatar?.image);
      dispose(avatar?.data);
    });
  }
}

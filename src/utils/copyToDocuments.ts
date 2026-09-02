import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

const DEFAULT_MAX_IMAGE_DIMENSION = 2400;
const DEFAULT_JPEG_QUALITY = 0.88;
const IMAGE_HEADER_READ_BYTES = 1024 * 1024;

interface CopyToDocumentsOptions {
  filenamePrefix?: string;
  maxDimension?: number;
  cropAspectRatio?: number;
  forceJpeg?: boolean;
  sourceSize?: { width: number; height: number } | null;
}

function randomSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getSourceExtension(sourceUri: string): string {
  const raw = sourceUri.split('?')[0];
  const ext = raw.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || 'jpg';
}

function buildFilename(prefix: string, ext: string): string {
  return `${prefix}_${randomSuffix()}.${ext}`;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) + bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] * 0x1000000)
    + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) return null;
    const segmentLength = readUint16BE(bytes, offset + 2);
    if (segmentLength < 2) return null;

    // JPEG dimensions live in Start of Frame markers.
    const isStartOfFrame = marker >= 0xc0
      && marker <= 0xcf
      && marker !== 0xc4
      && marker !== 0xc8
      && marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const isPng = bytes.length >= 24
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a;
  if (!isPng) return null;

  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

async function getImageHeaderSize(uri: string): Promise<{ width: number; height: number } | null> {
  const file = new File(uri);
  let handle: ReturnType<File['open']> | null = null;
  try {
    handle = file.open();
    const bytes = handle.readBytes(Math.min(file.size || IMAGE_HEADER_READ_BYTES, IMAGE_HEADER_READ_BYTES));
    return readJpegSize(bytes) ?? readPngSize(bytes);
  } catch {
    return null;
  } finally {
    try {
      handle?.close();
    } catch {
      // Best-effort close; falling back to Image.getSize is still safe.
    }
  }
}

function getReactNativeImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

async function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return await getImageHeaderSize(uri) ?? getReactNativeImageSize(uri);
}

function getResizeAction(
  size: { width: number; height: number } | null,
  maxDimension: number,
): { resize: { width?: number; height?: number } } | null {
  if (!size || maxDimension <= 0) return null;
  const { width, height } = size;
  if (width <= maxDimension && height <= maxDimension) return null;
  return width >= height
    ? { resize: { width: maxDimension } }
    : { resize: { height: maxDimension } };
}

function getCenteredCropAction(
  size: { width: number; height: number } | null,
  cropAspectRatio?: number,
): { crop: { originX: number; originY: number; width: number; height: number } } | null {
  if (!size || !cropAspectRatio || cropAspectRatio <= 0) return null;

  const currentAspectRatio = size.width / size.height;
  if (Math.abs(currentAspectRatio - cropAspectRatio) < 0.01) {
    return null;
  }

  if (currentAspectRatio > cropAspectRatio) {
    const width = Math.max(1, Math.min(size.width, Math.round(size.height * cropAspectRatio)));
    return {
      crop: {
        originX: Math.max(0, Math.floor((size.width - width) / 2)),
        originY: 0,
        width,
        height: size.height,
      },
    };
  }

  const height = Math.max(1, Math.min(size.height, Math.round(size.width / cropAspectRatio)));
  return {
    crop: {
      originX: 0,
      originY: Math.max(0, Math.floor((size.height - height) / 2)),
      width: size.width,
      height,
    },
  };
}

function getManipulatedSize(
  size: { width: number; height: number } | null,
  cropAction: { crop: { width: number; height: number } } | null,
): { width: number; height: number } | null {
  if (!size) return null;
  if (!cropAction) return size;
  return {
    width: cropAction.crop.width,
    height: cropAction.crop.height,
  };
}

async function copyFileToDocuments(sourceUri: string, filename: string): Promise<string> {
  const dest = new File(Paths.document, filename);
  const source = new File(sourceUri);
  await source.copy(dest);
  return dest.uri;
}

function deleteTemporaryFile(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // Temporary manipulated files live in cache; failing to clean them should not block import.
  }
}

export async function copyToDocuments(
  sourceUri: string,
  options: CopyToDocumentsOptions = {},
): Promise<string> {
  const filenamePrefix = options.filenamePrefix ?? 'photo';
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION;
  const cropAspectRatio = options.cropAspectRatio;
  const forceJpeg = options.forceJpeg ?? false;
  const sourceSize = options.sourceSize ?? null;
  const sourceExt = getSourceExtension(sourceUri);

  const size = sourceSize ?? await getImageSize(sourceUri);
  const cropAction = getCenteredCropAction(size, cropAspectRatio);
  const manipulatedSize = getManipulatedSize(size, cropAction);
  const resizeAction = getResizeAction(manipulatedSize, maxDimension);
  const actions = [cropAction, resizeAction].filter(
    (action): action is NonNullable<typeof action> => action != null,
  );
  if (actions.length === 0 && !forceJpeg) {
    return copyFileToDocuments(sourceUri, buildFilename(filenamePrefix, sourceExt));
  }

  try {
    const result = await manipulateAsync(
      sourceUri,
      actions,
      { compress: DEFAULT_JPEG_QUALITY, format: SaveFormat.JPEG },
    );
    const copiedUri = await copyFileToDocuments(result.uri, buildFilename(filenamePrefix, 'jpg'));
    deleteTemporaryFile(result.uri);
    return copiedUri;
  } catch (error) {
    if (forceJpeg) throw error;
    return copyFileToDocuments(sourceUri, buildFilename(filenamePrefix, sourceExt));
  }
}

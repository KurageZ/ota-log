import { useEffect, useMemo, useState, type Ref } from 'react';
import { Image, View } from 'react-native';
import type { ChekiSpec } from '../domain/chekiSpec';
import type { ThemeColors } from '../theme/appTheme';
import {
  calculateChekiGridLayout,
  type ChekiGridColumns,
  type ChekiGridDensity,
} from '../utils/cheki';
import {
  getRotatedChekiImageFrame,
  isLandscapeChekiSpec,
  isLandscapeImageSize,
  resolveChekiLandscapeRotation,
} from '../utils/chekiThumbnailRotation';
import type { ChekiLandscapeRotation } from '../utils/chekiViewPreferences';

export const CHEKI_GRID_GAP = 8;
export const CHEKI_SQUARE_GRID_GAP = 4;
export const CHEKI_ASPECT_RATIO = 86 / 54;
export const CHEKI_BARE_THUMBNAIL_RADIUS = 10;

const CHEKI_SQUARE_CARD_RADIUS = 12;
const IMAGE_ORIENTATION_CACHE_LIMIT = 512;
const IMAGE_ORIENTATION_RESOLVE_TIMEOUT_MS = 1000;
const imageLandscapeCache = new Map<string, boolean>();

function cacheImageLandscape(uri: string, isLandscape: boolean) {
  if (!imageLandscapeCache.has(uri) && imageLandscapeCache.size >= IMAGE_ORIENTATION_CACHE_LIMIT) {
    const oldestUri = imageLandscapeCache.keys().next().value;
    if (oldestUri) imageLandscapeCache.delete(oldestUri);
  }
  imageLandscapeCache.set(uri, isLandscape);
}

export function ChekiGridThumbnail({
  uri,
  width,
  height,
  colors,
  imageRef,
  variant,
  spec,
  landscapeRotation = 'original',
  onRotationChange,
}: {
  uri: string;
  width: number;
  height: number;
  colors: ThemeColors;
  imageRef?: Ref<Image>;
  variant: 'portrait' | 'original';
  spec?: ChekiSpec;
  landscapeRotation?: ChekiLandscapeRotation;
  onRotationChange?: (isRotated: boolean) => void;
}) {
  const usesSquareFrame = variant === 'original';
  const shouldResolveLandscape = !usesSquareFrame
    && landscapeRotation !== 'original'
    && isLandscapeChekiSpec(spec);
  const [resolvedImageOrientation, setResolvedImageOrientation] = useState<{
    uri: string;
    isLandscape: boolean;
  } | null>(() => {
    const cached = imageLandscapeCache.get(uri);
    return cached === undefined ? null : { uri, isLandscape: cached };
  });
  const cachedImageOrientation = imageLandscapeCache.get(uri);
  const imageIsLandscape = resolvedImageOrientation?.uri === uri
    ? resolvedImageOrientation.isLandscape
    : cachedImageOrientation ?? null;

  useEffect(() => {
    if (!shouldResolveLandscape) {
      setResolvedImageOrientation(null);
      return;
    }

    const cached = imageLandscapeCache.get(uri);
    if (cached !== undefined) {
      setResolvedImageOrientation({ uri, isLandscape: cached });
      return;
    }

    let isActive = true;
    let isSettled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const finish = (isLandscape: boolean, shouldCache: boolean) => {
      if (!isActive || isSettled) return;
      isSettled = true;
      if (timeout) clearTimeout(timeout);
      if (shouldCache) cacheImageLandscape(uri, isLandscape);
      setResolvedImageOrientation({ uri, isLandscape });
    };
    setResolvedImageOrientation(null);
    timeout = setTimeout(() => finish(false, false), IMAGE_ORIENTATION_RESOLVE_TIMEOUT_MS);
    Image.getSize(uri)
      .then(({ width: imageWidth, height: imageHeight }) => {
        const isLandscape = isLandscapeImageSize(imageWidth, imageHeight);
        finish(isLandscape, true);
      })
      .catch(() => finish(false, false));

    return () => {
      isActive = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [shouldResolveLandscape, uri]);

  const resolvedRotation = resolveChekiLandscapeRotation({
    displayMode: variant,
    preference: landscapeRotation,
    spec,
    isImageLandscape: imageIsLandscape === true,
  });
  const isRotated = resolvedRotation !== 'original';
  const isRotationPending = shouldResolveLandscape && imageIsLandscape === null;

  useEffect(() => {
    onRotationChange?.(isRotated);
  }, [isRotated, onRotationChange]);

  if (!usesSquareFrame) {
    const rotatedFrame = resolvedRotation === 'original'
      ? null
      : getRotatedChekiImageFrame(width, height, resolvedRotation);
    return (
      <View style={{ width, height }}>
        <View
          style={{
            width: '100%',
            height: '100%',
            borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            ref={imageRef}
            source={{ uri }}
            resizeMethod="resize"
            resizeMode="contain"
            style={rotatedFrame ? {
              width: rotatedFrame.width,
              height: rotatedFrame.height,
              borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
              opacity: isRotationPending ? 0 : 1,
              transform: [{ rotate: rotatedFrame.rotate }],
            } : {
              width: '100%',
              height: '100%',
              borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
              opacity: isRotationPending ? 0 : 1,
            }}
          />
        </View>
      </View>
    );
  }

  const photoInset = Math.max(5, Math.round(width * 0.07));
  const innerWidth = width - photoInset * 2;
  const innerHeight = height - photoInset * 2;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: CHEKI_SQUARE_CARD_RADIUS,
        backgroundColor: colors.cardAlt,
        padding: photoInset,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        ref={imageRef}
        source={{ uri }}
        resizeMethod="resize"
        resizeMode="contain"
        style={{
          width: innerWidth,
          height: innerHeight,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.24,
          shadowRadius: 6,
        }}
      />
    </View>
  );
}

export function useChekiAlbumGridLayout({
  density,
  availableWidth,
  availableHeight,
  displayMode,
}: {
  density: ChekiGridDensity;
  availableWidth: number;
  availableHeight: number;
  displayMode: 'portrait' | 'original';
}): { columns: ChekiGridColumns; itemWidth: number; itemHeight: number; targetRows: number } {
  return useMemo(
    () => calculateChekiGridLayout({
      density,
      availableWidth,
      availableHeight,
      gap: displayMode === 'original' ? CHEKI_SQUARE_GRID_GAP : CHEKI_GRID_GAP,
      aspectRatio: displayMode === 'original' ? 1 : CHEKI_ASPECT_RATIO,
    }),
    [availableHeight, availableWidth, density, displayMode],
  );
}

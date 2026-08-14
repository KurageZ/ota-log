import { useMemo, type Ref } from 'react';
import { Image, View } from 'react-native';
import type { ThemeColors } from '../theme/appTheme';
import {
  calculateChekiGridLayout,
  type ChekiGridColumns,
  type ChekiGridDensity,
} from '../utils/cheki';

export const CHEKI_GRID_GAP = 8;
export const CHEKI_ASPECT_RATIO = 86 / 54;
export const CHEKI_BARE_THUMBNAIL_RADIUS = 10;

export function ChekiGridThumbnail({
  uri,
  width,
  height,
  colors,
  imageRef,
  aspectRatio,
}: {
  uri: string;
  width: number;
  height: number;
  colors: ThemeColors;
  imageRef?: Ref<Image>;
  aspectRatio: number | null;
}) {
  const usesSpecLayout = aspectRatio !== null;
  const cardInset = usesSpecLayout ? Math.max(5, Math.round(width * 0.07)) : 0;
  const fitInside = (maxWidth: number, maxHeight: number) => {
    if (aspectRatio === null) return { width: maxWidth, height: maxHeight };
    const widthFromHeight = maxHeight * aspectRatio;
    return widthFromHeight <= maxWidth
      ? { width: widthFromHeight, height: maxHeight }
      : { width: maxWidth, height: maxWidth / aspectRatio };
  };
  const fitted = fitInside(width - cardInset * 2, height - cardInset * 2);

  return (
    <View
      style={{
        width,
        height,
        padding: cardInset,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: usesSpecLayout ? 12 : 0,
        backgroundColor: usesSpecLayout ? colors.cardAlt : 'transparent',
      }}
    >
      <View
        style={{
          ...fitted,
          borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: usesSpecLayout ? 3 : 0 },
          shadowOpacity: usesSpecLayout ? 0.18 : 0,
          shadowRadius: usesSpecLayout ? 5 : 0,
          elevation: usesSpecLayout ? 3 : 0,
        }}
      >
        <Image
          ref={imageRef}
          source={{ uri }}
          resizeMethod="resize"
          resizeMode="contain"
          style={{ width: '100%', height: '100%', borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS }}
        />
      </View>
    </View>
  );
}

export function useChekiAlbumGridLayout({
  density,
  availableWidth,
  availableHeight,
  useSpecAspectRatio,
}: {
  density: ChekiGridDensity;
  availableWidth: number;
  availableHeight: number;
  useSpecAspectRatio: boolean;
}): { columns: ChekiGridColumns; itemWidth: number; itemHeight: number; targetRows: number } {
  return useMemo(
    () => calculateChekiGridLayout({
      density,
      availableWidth,
      availableHeight,
      gap: CHEKI_GRID_GAP,
      aspectRatio: useSpecAspectRatio ? 1 : CHEKI_ASPECT_RATIO,
    }),
    [availableHeight, availableWidth, density, useSpecAspectRatio],
  );
}

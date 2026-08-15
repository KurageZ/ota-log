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
  variant,
}: {
  uri: string;
  width: number;
  height: number;
  colors: ThemeColors;
  imageRef?: Ref<Image>;
  variant: 'portrait' | 'original';
}) {
  const usesSquareFrame = variant === 'original';
  const cardInset = usesSquareFrame ? Math.max(5, Math.round(width * 0.07)) : 0;
  const innerWidth = width - cardInset * 2;
  const innerHeight = height - cardInset * 2;

  return (
    <View
      style={{
        width,
        height,
        padding: cardInset,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: usesSquareFrame ? 12 : 0,
        backgroundColor: usesSquareFrame ? colors.cardAlt : 'transparent',
      }}
    >
      <View
        style={{
          width: innerWidth,
          height: innerHeight,
          borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
          backgroundColor: colors.card,
          shadowColor: usesSquareFrame ? colors.shadow : 'transparent',
          shadowOffset: { width: 0, height: usesSquareFrame ? 3 : 0 },
          shadowOpacity: usesSquareFrame ? 0.18 : 0,
          shadowRadius: usesSquareFrame ? 5 : 0,
          elevation: usesSquareFrame ? 3 : 0,
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
      gap: CHEKI_GRID_GAP,
      aspectRatio: displayMode === 'original' ? 1 : CHEKI_ASPECT_RATIO,
    }),
    [availableHeight, availableWidth, density, displayMode],
  );
}

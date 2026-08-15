import { useMemo, type Ref } from 'react';
import { Image, View } from 'react-native';
import type { ThemeColors } from '../theme/appTheme';
import {
  calculateChekiGridLayout,
  type ChekiGridColumns,
  type ChekiGridDensity,
} from '../utils/cheki';

export const CHEKI_GRID_GAP = 8;
export const CHEKI_SQUARE_GRID_GAP = 4;
export const CHEKI_ASPECT_RATIO = 86 / 54;
export const CHEKI_BARE_THUMBNAIL_RADIUS = 10;

const CHEKI_SQUARE_CARD_RADIUS = 12;

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

  if (!usesSquareFrame) {
    return (
      <View style={{ width, height }}>
        <View
          style={{
            width: '100%',
            height: '100%',
            borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
            backgroundColor: colors.card,
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

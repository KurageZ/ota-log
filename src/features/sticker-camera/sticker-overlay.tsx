import { Image, View } from 'react-native';
import { resolveStickerLayout } from './sticker-preset';

export interface StickerAsset {
  uri: string;
  width: number;
  height: number;
}

export function StickerOverlay({
  asset,
  canvasWidth,
  canvasHeight,
}: {
  asset: StickerAsset;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const layout = resolveStickerLayout(
    canvasWidth,
    canvasHeight,
    asset.width,
    asset.height,
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        borderRadius: layout.cornerRadius,
        borderCurve: 'continuous',
        boxShadow: '0 7px 18px rgba(0, 0, 0, 0.3)',
        transform: [{ rotate: `${layout.rotationDegrees}deg` }],
      }}
    >
      <Image
        source={{ uri: asset.uri }}
        resizeMode="stretch"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: layout.cornerRadius,
        }}
      />
    </View>
  );
}

import type { ChekiSpec } from '../../domain/chekiSpec';
import { Image, View } from 'react-native';
import { resolveStickerStackLayouts } from './sticker-preset';

export interface StickerAsset {
  spec?: ChekiSpec;
  id: string;
  uri: string;
  width: number;
  height: number;
}

export function StickerOverlay({
  assets,
  canvasWidth,
  canvasHeight,
}: {
  assets: StickerAsset[];
  canvasWidth: number;
  canvasHeight: number;
}) {
  const layouts = resolveStickerStackLayouts(canvasWidth, canvasHeight, assets);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      {assets.map((asset, index) => {
        const layout = layouts[index];
        if (!layout) return null;
        return (
          <View
            key={asset.id}
            style={{
              position: 'absolute',
              left: layout.x,
              top: layout.y,
              width: layout.width,
              height: layout.height,
              borderRadius: layout.cornerRadius,
              borderCurve: 'continuous',
              boxShadow: '0 7px 18px rgba(0, 0, 0, 0.32)',
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
      })}
    </View>
  );
}

import { HStack, Image, Text, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  aspectRatio,
  containerBackground,
  cornerRadius,
  font,
  frame,
  foregroundStyle,
  padding,
  resizable,
  shadow,
  widgetAccentedRenderingMode,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface ChekiPhotoWidgetProps {
  imageUri?: string;
  leadingImageUri?: string;
  trailingImageUri?: string;
}

const ChekiPhotoWidgetView = (
  props: ChekiPhotoWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';

  return (
    <ZStack
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        containerBackground('#F4F0E8', 'widget'),
        widgetURL('otalog://cheki'),
        accessibilityLabel('拍立得回忆'),
        accessibilityHint('打开电子切册'),
      ]}
    >
      {props.imageUri ? (
        <HStack
          spacing={6}
          modifiers={[
            frame({ maxWidth: 10000, maxHeight: 10000 }),
            padding({ all: 8 }),
          ]}
        >
          {environment.widgetFamily === 'systemMedium' && props.leadingImageUri ? (
            <Image
              uiImage={props.leadingImageUri}
              modifiers={[
                resizable(),
                aspectRatio({ ratio: 54 / 86, contentMode: 'fit' }),
                cornerRadius(8),
                shadow({ radius: 6, x: 0, y: 3, color: '#3D342740' }),
                frame({ maxWidth: 10000, maxHeight: 10000 }),
                widgetAccentedRenderingMode('fullColor'),
              ]}
            />
          ) : null}
          <Image
            uiImage={props.imageUri}
            modifiers={[
              resizable(),
              aspectRatio({ ratio: 54 / 86, contentMode: 'fit' }),
              cornerRadius(8),
              shadow({ radius: 6, x: 0, y: 3, color: '#3D342740' }),
              frame({ maxWidth: 10000, maxHeight: 10000 }),
              widgetAccentedRenderingMode('fullColor'),
            ]}
          />
          {environment.widgetFamily === 'systemMedium' && props.trailingImageUri ? (
            <Image
              uiImage={props.trailingImageUri}
              modifiers={[
                resizable(),
                aspectRatio({ ratio: 54 / 86, contentMode: 'fit' }),
                cornerRadius(8),
                shadow({ radius: 6, x: 0, y: 3, color: '#3D342740' }),
                frame({ maxWidth: 10000, maxHeight: 10000 }),
                widgetAccentedRenderingMode('fullColor'),
              ]}
            />
          ) : null}
        </HStack>
      ) : (
        <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle('#6F675D')]}>还没有拍立得</Text>
      )}
    </ZStack>
  );
};

export const ChekiPhotoWidget = createWidget<ChekiPhotoWidgetProps>(
  'ChekiPhotoWidget',
  ChekiPhotoWidgetView,
);

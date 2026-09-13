import { HStack, Image, Text, ZStack } from '@expo/ui/swift-ui';
import { accessibilityHint, accessibilityLabel, aspectRatio, containerBackground, containerRelativeFrame, cornerRadius, font, frame, foregroundStyle, padding, resizable, shadow, widgetAccentedRenderingMode, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type ChekiPhotoWidgetSlot = 'group1' | 'group2' | 'group3' | 'group4' | 'group5' | 'group6';
export interface ChekiPhotoWidgetGroupProps {
  state: 'content' | 'unconfigured' | 'no_match' | 'unavailable';
  imageUri?: string;
  smallImageUri?: string;
  leadingImageUri?: string;
  trailingImageUri?: string;
  imageSpan?: number;
  leadingImageSpan?: number;
  trailingImageSpan?: number;
  emptyDeepLink: string;
}
export interface ChekiPhotoWidgetProps {
  group1: ChekiPhotoWidgetGroupProps; group2: ChekiPhotoWidgetGroupProps; group3: ChekiPhotoWidgetGroupProps;
  group4: ChekiPhotoWidgetGroupProps; group5: ChekiPhotoWidgetGroupProps; group6: ChekiPhotoWidgetGroupProps;
}
export type ChekiPhotoWidgetConfiguration = { slot: ChekiPhotoWidgetSlot };

const ChekiPhotoWidgetView = (props: ChekiPhotoWidgetProps, environment: WidgetEnvironment<ChekiPhotoWidgetConfiguration>) => {
  'widget';
  const group = environment.configuration.slot === 'group1'
    ? props.group1
    : environment.configuration.slot === 'group2'
      ? props.group2
      : environment.configuration.slot === 'group3'
        ? props.group3
        : environment.configuration.slot === 'group4'
          ? props.group4
          : environment.configuration.slot === 'group5'
            ? props.group5
            : props.group6;
  const displayImageUri = environment.widgetFamily === 'systemMedium' ? group.imageUri : group.smallImageUri ?? group.imageUri;
  const hasContent = group.state === 'content' && !!displayImageUri;
  const columnCount = (group.imageSpan ?? 1) + (group.leadingImageUri ? group.leadingImageSpan ?? 1 : 0) + (group.trailingImageUri ? group.trailingImageSpan ?? 1 : 0);
  const image = (uri: string, span = 1) => {
    // Distribute the 12pt outer inset across slots; relative frames ignore parent padding.
    const slotInset = 12 * span / columnCount;
    const imageView = <Image uiImage={uri} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), cornerRadius(8), shadow({ radius: 6, x: 0, y: 3, color: '#3D342740' }), frame({ maxWidth: 10000, maxHeight: 10000 }), widgetAccentedRenderingMode('fullColor')]} />;
    return environment.widgetFamily === 'systemMedium'
      ? <ZStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 }), padding({ horizontal: slotInset }), containerRelativeFrame({ axes: 'horizontal', count: columnCount, span, spacing: 6 }), padding({ horizontal: -slotInset })]}>{imageView}</ZStack>
      : imageView;
  };
  return <ZStack modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 }), containerBackground('#F4F0E8', 'widget'), widgetURL(hasContent ? 'otalog:///cheki' : group.emptyDeepLink), accessibilityLabel('拍立得回忆'), accessibilityHint(hasContent ? '打开电子切册' : '配置拍立得分组')]}>
    {hasContent ? <HStack spacing={6} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 }), padding(environment.widgetFamily === 'systemMedium' ? { vertical: 8 } : { all: 8 })]}>
      {environment.widgetFamily === 'systemMedium' && group.leadingImageUri ? image(group.leadingImageUri, group.leadingImageSpan) : null}
      {image(displayImageUri as string, group.imageSpan)}
      {environment.widgetFamily === 'systemMedium' && group.trailingImageUri ? image(group.trailingImageUri, group.trailingImageSpan) : null}
    </HStack> : <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle('#6F675D')]}>{group.state === 'unconfigured' ? '尚未配置分组' : group.state === 'unavailable' ? '暂无可展示的拍立得' : '暂无符合条件的拍立得'}</Text>}
  </ZStack>;
};

export const ChekiPhotoWidget = createWidget<ChekiPhotoWidgetProps, ChekiPhotoWidgetConfiguration>('ChekiPhotoWidget', ChekiPhotoWidgetView);

import { HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  aspectRatio,
  cornerRadius,
  lineLimit,
  padding,
  resizable,
  widgetAccentedRenderingMode,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface NextEventWidgetProps {
  eventId?: string;
  title?: string;
  eventDate?: string;
  eventTime?: string | null;
  city?: string | null;
  venue?: string | null;
  countdown?: string;
  deepLink?: string;
  imageUri?: string;
}

const NextEventWidgetView = (props: NextEventWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const hasEvent = Boolean(props.eventId && props.title);
  const isMedium = environment.widgetFamily === 'systemMedium';
  const location = [props.city, props.venue].filter(Boolean).join(' · ');
  const dateParts = props.eventDate?.split('-');
  const formattedDate = dateParts?.length === 3
    ? `${Number(dateParts[1])}月${Number(dateParts[2])}日`
    : '日期待确认';

  return (
    <ZStack
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        containerBackground('#F5EBDD', 'widget'),
        widgetURL(props.deepLink ?? 'otalog:///events/compose'),
        accessibilityLabel(hasEvent ? `下一场活动：${props.title}` : '还没有下一场活动'),
        accessibilityHint(hasEvent ? '打开活动详情' : '打开新建活动'),
      ]}
    >
      {hasEvent ? (
        isMedium ? (
          <HStack spacing={12} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 }), padding({ all: 14 })]}>
            {props.imageUri ? (
              <VStack spacing={4} modifiers={[frame({ width: 82, maxHeight: 120 })]}>
                <Image
                  uiImage={props.imageUri}
                  modifiers={[resizable(), aspectRatio({ ratio: 3 / 4, contentMode: 'fit' }), cornerRadius(12), frame({ width: 82, height: 104 }), widgetAccentedRenderingMode('fullColor')]}
                />
                <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle('#9B6758')]}>{props.countdown ?? '今天'}</Text>
              </VStack>
            ) : (
              <VStack spacing={0} modifiers={[frame({ width: 82, height: 104 }), padding({ horizontal: 6, vertical: 8 })]}>
                <Text modifiers={[font({ size: 24, weight: 'black' }), foregroundStyle('#4F3028'), widgetAccentedRenderingMode('accented')]}>{props.countdown ?? '今天'}</Text>
                <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle('#9B6758')]}>距活动</Text>
              </VStack>
            )}
            <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: 10000, maxHeight: 120 })]}>
              <Text modifiers={[font({ size: 18, weight: 'black' }), foregroundStyle('#4F3028'), lineLimit(2)]}>{props.title}</Text>
              <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#8C6B5B'), lineLimit(1)]}>{formattedDate}{' · '}{props.eventTime || '全天'}</Text>
              {location ? <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#8C6B5B'), lineLimit(2)]}>{location}</Text> : null}
            </VStack>
          </HStack>
        ) : (
          <VStack spacing={7} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 }), padding({ all: 14 })]}>
            <HStack spacing={10} modifiers={[frame({ maxWidth: 10000 })]}>
              <VStack spacing={0} modifiers={[padding({ horizontal: 10, vertical: 8 })]}>
                <Text modifiers={[font({ size: 28, weight: 'black' }), foregroundStyle('#4F3028'), widgetAccentedRenderingMode('accented')]}>{props.countdown ?? '今天'}</Text>
                <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle('#9B6758')]}>距活动</Text>
              </VStack>
              <VStack spacing={4} modifiers={[frame({ maxWidth: 10000 })]}>
                <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle('#A36A4C')]}>{'下一场活动'}</Text>
                <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle('#4F3028'), lineLimit(2)]}>{props.title}</Text>
                <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#8C6B5B')]}>{formattedDate}{' · '}{props.eventTime || '全天'}</Text>
              </VStack>
            </HStack>
          </VStack>
        )
      ) : (
        <VStack spacing={7} modifiers={[padding({ all: 16 })]}>
          <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#4F3028')]}>{'还没有下一场活动'}</Text>
          <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#8C6B5B'), lineLimit(2)]}>{'轻点添加计划中的活动'}</Text>
        </VStack>
      )}
    </ZStack>
  );
};

export const NextEventWidget = createWidget<NextEventWidgetProps>('NextEventWidget', NextEventWidgetView);

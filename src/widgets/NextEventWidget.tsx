import { HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityHint,
  accessibilityLabel,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  aspectRatio,
  cornerRadius,
  fixedSize,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  multilineTextAlignment,
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
  openTime?: string | null;
  startTime?: string | null;
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
  const time = [
    props.openTime ? `${props.openTime} 开场` : null,
    props.startTime ? `${props.startTime} 开演` : null,
  ].filter(Boolean).join(' · ') || '全天';
  const dateParts = props.eventDate?.split('-');
  const formattedDate = dateParts?.length === 3
    ? `${Number(dateParts[1])}月${Number(dateParts[2])}日`
    : '日期待确认';
  // Read the calendar date in UTC so the weekday never shifts with the device timezone.
  const year = Number(dateParts?.[0]);
  const month = Number(dateParts?.[1]);
  const day = Number(dateParts?.[2]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const hasValidDate = dateParts?.length === 3
    && calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day;
  const dateLabel = hasValidDate ? formattedDate : '日期待确认';
  const weekday = hasValidDate ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][calendarDate.getUTCDay()] : '';
  const smallPrimaryTime = props.openTime
    ? `${props.openTime} 开场`
    : props.startTime ? `${props.startTime} 开演` : '全天';
  const venue = props.venue?.trim();
  // Keep both appearances inside the serialized widget so system changes apply without an app sync.
  const palette = environment.colorScheme === 'dark'
    ? { background: '#1C1C1E', date: '#D9AE98', text: '#F5F1ED', secondary: '#BDB3AC' }
    : { background: '#FCFBF9', date: '#8B5B4D', text: '#4F3028', secondary: '#806153' };

  return (
    <ZStack
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        containerBackground(palette.background, 'widget'),
        widgetURL(props.deepLink ?? 'otalog:///events/compose'),
        accessibilityLabel(hasEvent ? `下一场活动：${props.title}` : '还没有下一场活动'),
        accessibilityHint(hasEvent ? '打开活动详情' : '打开新建活动'),
      ]}
    >
      {hasEvent ? (
        isMedium ? (
          <HStack
            alignment="center"
            spacing={16}
            modifiers={[
              frame({ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity }),
              padding({ all: 20 }),
            ]}
          >
            {props.imageUri ? (
              <Image
                uiImage={props.imageUri}
                modifiers={[
                  resizable(),
                  aspectRatio({ contentMode: 'fit' }),
                  cornerRadius(12),
                  frame({ width: 96, minHeight: 0, maxHeight: Infinity, alignment: 'leading' }),
                  widgetAccentedRenderingMode('fullColor'),
                ]}
              />
            ) : null}
            <VStack
              alignment="leading"
              spacing={6}
              modifiers={[
                frame({ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity, alignment: 'leading' }),
                padding({ top: 4 }),
              ]}
            >
              <HStack
                alignment="firstTextBaseline"
                spacing={6}
                modifiers={[
                  frame({ minWidth: 0, maxWidth: Infinity, alignment: 'center' }),
                  fixedSize({ horizontal: false, vertical: true }),
                  layoutPriority(1),
                  accessibilityElement('ignore'),
                  accessibilityLabel([dateLabel, weekday].filter(Boolean).join(' ')),
                ]}
              >
                <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(palette.date), lineLimit(1), minimumScaleFactor(0.8), widgetAccentedRenderingMode('accented')]}>
                  {dateLabel}
                </Text>
                {weekday ? <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(palette.secondary), fixedSize()]}>{weekday}</Text> : null}
              </HStack>
              <Spacer minLength={0} />
              <Text modifiers={[font({ size: 16, weight: 'medium' }), foregroundStyle(palette.text), multilineTextAlignment('leading'), lineLimit(2), frame({ minWidth: 0, maxWidth: Infinity, alignment: 'leading' })]}>
                {props.title}
              </Text>
              <Spacer minLength={0} />
              <VStack alignment="leading" spacing={2} modifiers={[frame({ minWidth: 0, maxWidth: Infinity, alignment: 'leading' }), fixedSize({ horizontal: false, vertical: true }), layoutPriority(1)]}>
                <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(palette.secondary), lineLimit(1)]}>{time}</Text>
                {venue ? <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(palette.secondary), lineLimit(1)]}>{venue}</Text> : null}
              </VStack>
            </VStack>
          </HStack>
        ) : (
          <VStack
            alignment="center"
            spacing={6}
            modifiers={[
              padding({ horizontal: 14, vertical: 20 }),
              frame({ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity, alignment: 'top' }),
            ]}
          >
            <HStack
              alignment="firstTextBaseline"
              spacing={6}
              modifiers={[
                frame({ minWidth: 0, maxWidth: Infinity, alignment: 'center' }),
                fixedSize({ horizontal: false, vertical: true }),
                layoutPriority(1),
                accessibilityElement('ignore'),
                accessibilityLabel([dateLabel, weekday].filter(Boolean).join(' ')),
              ]}
            >
              <Text
                modifiers={[
                  font({ size: 24, weight: 'bold' }),
                  foregroundStyle(palette.date),
                  lineLimit(1),
                  minimumScaleFactor(0.8),
                  widgetAccentedRenderingMode('accented'),
                ]}
              >
                {dateLabel}
              </Text>
              {weekday ? (
                <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(palette.secondary), fixedSize()]}>{weekday}</Text>
              ) : null}
            </HStack>
            <Spacer minLength={0} />
            <Text
              modifiers={[
                font({ size: 14, weight: 'medium' }),
                foregroundStyle(palette.text),
                multilineTextAlignment('center'),
                lineLimit(2),
                frame({ minWidth: 0, maxWidth: Infinity, alignment: 'center' }),
              ]}
            >
              {props.title}
            </Text>
            <Spacer minLength={0} />
            <VStack alignment="center" spacing={2} modifiers={[frame({ minWidth: 0, maxWidth: Infinity, alignment: 'center' }), fixedSize({ horizontal: false, vertical: true }), layoutPriority(1)]}>
              <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(palette.secondary), lineLimit(1)]}>
                {smallPrimaryTime}
              </Text>
              {venue ? (
                <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(palette.secondary), lineLimit(1)]}>
                  {venue}
                </Text>
              ) : null}
            </VStack>
          </VStack>
        )
      ) : (
        <VStack spacing={7} modifiers={[padding({ all: 16 })]}>
          <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(palette.text)]}>{'还没有下一场活动'}</Text>
          <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(palette.secondary), lineLimit(2)]}>{'轻点添加计划中的活动'}</Text>
        </VStack>
      )}
    </ZStack>
  );
};

export const NextEventWidget = createWidget<NextEventWidgetProps>('NextEventWidget', NextEventWidgetView);

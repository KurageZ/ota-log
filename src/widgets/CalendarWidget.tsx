import { Capsule, Circle, HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  aspectRatio,
  background,
  clipped,
  containerBackground,
  containerRelativeFrame,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  offset,
  padding,
  resizable,
  rotationEffect,
  shapes,
  widgetAccentedRenderingMode,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface CalendarWidgetDayProps {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  imageUri?: string;
  isAvatar: boolean;
  count: number;
}

export interface CalendarWidgetPalette {
  background: string;
  heading: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
}

export interface CalendarWidgetProps {
  title: string;
  weekdays: string[];
  days: CalendarWidgetDayProps[];
  light: CalendarWidgetPalette;
  dark: CalendarWidgetPalette;
  deepLink: string;
}

const CalendarWidgetView = (props: CalendarWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const palette = environment.colorScheme === 'dark' ? props.dark : props.light;
  const renderDay = (day: CalendarWidgetDayProps) => (
    <VStack
      key={day.date}
      spacing={1}
      modifiers={[
        frame({ minWidth: 0, maxWidth: Infinity }),
        frame({ height: 46 }),
      ]}
    >
      {day.imageUri ? (
        <ZStack modifiers={[frame({ width: 28, height: 38 })]}>
          <Image
            uiImage={day.imageUri}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: 'fill' }),
              frame({ width: 28, height: 38 }),
              cornerRadius(5),
              clipped(),
              rotationEffect(day.isAvatar ? 5 : -6),
              widgetAccentedRenderingMode('fullColor'),
            ]}
          />
          {day.count > 0 ? (
            <ZStack
              modifiers={[
                frame({ width: Math.max(18, String(day.count).length * 6 + 10), height: 18 }),
                offset({ x: 9, y: 12 }),
              ]}
            >
              <Capsule modifiers={[foregroundStyle('#000000')]} />
              <Text
                modifiers={[
                  font({ size: 9, weight: 'black' }),
                  monospacedDigit(),
                  foregroundStyle('#FFFFFF'),
                ]}
              >
                {day.count}
              </Text>
            </ZStack>
          ) : null}
        </ZStack>
      ) : (
        <VStack spacing={2}>
          <ZStack modifiers={[frame({ width: 16, height: 16 })]}>
            {day.isToday ? (
              <Circle modifiers={[frame({ width: 16, height: 16 }), foregroundStyle(palette.accent)]} />
            ) : null}
            <Text
              modifiers={[
                font({ size: 9, weight: day.isToday ? 'black' : 'bold' }),
                foregroundStyle(day.isToday ? palette.onAccent : day.inMonth ? palette.text : palette.muted),
              ]}
            >
              {day.day}
            </Text>
          </ZStack>
          {day.count > 0 ? (
            <Text
              modifiers={[
                padding({ horizontal: 4, vertical: 1 }),
                background(palette.accentSoft, shapes.roundedRectangle({ cornerRadius: 4 })),
                font({ size: 7, weight: 'bold' }),
                foregroundStyle(palette.accent),
              ]}
            >
              {String(day.count) + '张'}
            </Text>
          ) : null}
        </VStack>
      )}
    </VStack>
  );

  return (
    <VStack
      spacing={0}
      modifiers={[
        padding({ horizontal: 13, vertical: 12 }),
        frame({ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity }),
        containerRelativeFrame({ axes: 'both' }),
        containerBackground(palette.background, 'widget'),
        widgetURL(props.deepLink),
        accessibilityLabel(props.title + '拍立得日历'),
        accessibilityHint('打开 App 日历'),
      ]}
    >
      <ZStack
        modifiers={[
          frame({ minWidth: 0, maxWidth: Infinity }),
          frame({ height: 24 }),
        ]}
      >
        <Text modifiers={[font({ size: 18, weight: 'black' }), foregroundStyle(palette.heading)]}>{props.title}</Text>
      </ZStack>
      <HStack
        spacing={0}
        modifiers={[
          frame({ minWidth: 0, maxWidth: Infinity }),
          frame({ height: 16 }),
          padding({ bottom: 2 }),
        ]}
      >
        {props.weekdays.map((weekday) => (
          <Text
            key={weekday}
            modifiers={[frame({ minWidth: 0, maxWidth: Infinity }), font({ size: 9, weight: 'bold' }), foregroundStyle(palette.muted)]}
          >
            {weekday}
          </Text>
        ))}
      </HStack>
      <VStack spacing={0} modifiers={[frame({ minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity })]}>
        {Array.from({ length: 6 }, (_, row) => (
          <HStack
            key={'row-' + row}
            spacing={0}
            modifiers={[
              frame({ minWidth: 0, maxWidth: Infinity }),
              frame({ height: 46 }),
            ]}
          >
            {props.days.slice(row * 7, row * 7 + 7).map(renderDay)}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
};

export const CalendarWidget = createWidget<CalendarWidgetProps>('CalendarWidget', CalendarWidgetView);

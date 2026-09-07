import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityHint,
  accessibilityLabel,
  aspectRatio,
  backgroundOverlay,
  clipShape,
  clipped,
  cornerRadius,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  resizable,
  widgetAccentedRenderingMode,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { EventLiveActivityProps } from './types';

const EventLiveActivityView = (
  props: EventLiveActivityProps,
  environment: LiveActivityEnvironment,
) => {
  'widget';

  const accent = environment.colorScheme === 'dark' ? props.darkAccent : props.lightAccent;
  const primaryStyle = { type: 'hierarchical' as const, style: 'primary' as const };
  const secondaryStyle = { type: 'hierarchical' as const, style: 'secondary' as const };
  const isUpcoming = props.phase === 'upcoming';
  const isEnded = props.phase === 'ended';
  const statusLabel = isEnded
    ? '已结束'
    : isUpcoming
      ? props.countdownKind === 'opens' ? '即将开场' : '即将开演'
      : '进行中';
  const expandedStatusLabel = isEnded ? '已结束' : isUpcoming ? statusLabel : '正在进行中';
  const countdownTarget = props.countdownTargetAt ? new Date(props.countdownTargetAt) : null;
  const isElapsedTimer = props.timerMode === 'elapsed' && props.timerStartAt != null;
  const timerLower = new Date(isElapsedTimer
    ? props.timerStartAt!
    : Math.min(props.updatedAt, (props.countdownTargetAt ?? props.updatedAt) - 1000));
  const timerLabel = isElapsedTimer
    ? '已开始'
    : props.countdownKind === 'opens'
      ? '距开场'
      : props.countdownKind === 'starts'
        ? '距开演'
        : '距结束';
  const accessibilityText = [
    statusLabel,
    props.eventTitle,
    props.sessionTitle && props.sessionTitle !== props.eventTitle ? props.sessionTitle : null,
    props.primaryTitle,
    countdownTarget && !isUpcoming ? timerLabel : null,
    isUpcoming ? props.upcomingDetails : props.nextLabel,
  ].filter(Boolean).join('，');

  const currentEntryAvatarUri = props.phase === 'running'
    && props.hasTimetable
    && props.currentEntryTitle
    ? props.currentArtistAvatarUri
    : undefined;
  const compactIdentityUri = currentEntryAvatarUri ?? props.appIconUri;
  const compactIdentity = compactIdentityUri ? (
    <Image
      uiImage={compactIdentityUri}
      modifiers={[
        resizable(),
        aspectRatio({ contentMode: 'fill' }),
        frame({ width: 22, height: 22 }),
        clipShape('circle'),
        clipped(),
        widgetAccentedRenderingMode('fullColor'),
        accessibilityLabel(currentEntryAvatarUri
          ? `当前时间表条目艺人，${statusLabel}`
          : `ota log，${statusLabel}`),
      ]}
    />
  ) : (
    <Image
      systemName="app.fill"
      color={accent}
      modifiers={[
        font({ size: 20, weight: 'semibold' }),
        frame({ width: 22, height: 22, alignment: 'center' }),
        accessibilityLabel(accessibilityText),
      ]}
    />
  );

  const compactStatusLabel = isEnded
    ? '已结束'
    : isUpcoming
      ? props.countdownKind === 'opens' ? '开场前' : '开演前'
      : props.hasTimetable
        ? props.currentEntryTitle ? '进行中' : props.nextEntryTitle ? '待下一项' : '演出中'
        : '演出中';
  const compactStatusText = (
    <Text
      modifiers={[
        font({ size: 11, weight: 'bold' }),
        foregroundStyle(accent),
        lineLimit(1),
        minimumScaleFactor(0.75),
        accessibilityLabel(compactStatusLabel),
      ]}
    >
      {compactStatusLabel}
    </Text>
  );

  const expandedInlineTimer = countdownTarget ? (
    <Text
      timerInterval={{ lower: timerLower, upper: countdownTarget }}
      countsDown={!isElapsedTimer}
      modifiers={[
        font({ size: 16, weight: 'bold', design: 'rounded' }),
        foregroundStyle(primaryStyle),
        monospacedDigit(),
        lineLimit(1),
        minimumScaleFactor(0.72),
      ]}
    />
  ) : null;

  const upcomingDetailsText = props.upcomingDetails ? (
    <Text
      modifiers={[
        font({ size: 13, weight: 'semibold' }),
        foregroundStyle(secondaryStyle),
        lineLimit(1),
        minimumScaleFactor(0.78),
      ]}
    >
      {props.upcomingDetails}
    </Text>
  ) : null;

  const banner = (
    <HStack
      alignment="top"
      spacing={12}
      modifiers={[
        padding({ horizontal: 20, vertical: 16 }),
        accessibilityElement('combine'),
        accessibilityLabel(accessibilityText),
        accessibilityHint('打开活动详情'),
      ]}
    >
      {props.eventImageUri ? (
        <Image
          uiImage={props.eventImageUri}
          modifiers={[
            resizable(),
            aspectRatio({ contentMode: 'fill' }),
            frame({ width: 76, height: 96 }),
            cornerRadius(10),
            clipped(),
            accessibilityLabel('活动资料图'),
          ]}
        />
      ) : null}
      <VStack alignment="leading" spacing={6} modifiers={[layoutPriority(1)]}>
        <Text
          modifiers={[
            font({ size: 20, weight: 'bold' }),
            foregroundStyle(primaryStyle),
            lineLimit(2),
            minimumScaleFactor(0.75),
          ]}
        >
          {props.eventTitle}
        </Text>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>
          {expandedStatusLabel}
        </Text>
        {isUpcoming ? (
          upcomingDetailsText
        ) : props.hasTimetable ? (
          props.currentEntryTitle || props.nextEntryTitle ? (
            <HStack spacing={6} alignment="center">
              {props.currentEntryTitle ? (
                <HStack spacing={6} alignment="center">
                  {props.currentArtistAvatarUri ? (
                    <Image
                      uiImage={props.currentArtistAvatarUri}
                      modifiers={[
                        resizable(),
                        aspectRatio({ contentMode: 'fill' }),
                        frame({ width: 24, height: 24 }),
                        clipShape('circle'),
                        clipped(),
                        widgetAccentedRenderingMode('fullColor'),
                        accessibilityLabel('当前条目艺人头像'),
                      ]}
                    />
                  ) : null}
                  <Text
                    modifiers={[
                      font({ size: 16, weight: 'bold' }),
                      foregroundStyle(primaryStyle),
                      lineLimit(1),
                      minimumScaleFactor(0.78),
                      layoutPriority(1),
                    ]}
                  >
                    {props.currentEntryTitle}
                  </Text>
                </HStack>
              ) : null}
              {props.nextEntryTitle ? (
                <HStack
                  spacing={6}
                  alignment="center"
                  modifiers={[
                    fixedSize(),
                    accessibilityLabel(`下一项，${props.nextEntryTime ?? ''}，${props.nextEntryTitle}`),
                  ]}
                >
                  <Image
                    systemName="arrow.right"
                    color={environment.colorScheme === 'dark' ? '#ffffff' : '#000000'}
                    modifiers={[font({ size: 12, weight: 'bold' })]}
                  />
                  {props.nextArtistAvatarUri ? (
                    <Image
                      uiImage={props.nextArtistAvatarUri}
                      modifiers={[
                        resizable(),
                        aspectRatio({ contentMode: 'fill' }),
                        frame({ width: 24, height: 24 }),
                        clipShape('circle'),
                        clipped(),
                        widgetAccentedRenderingMode('fullColor'),
                      ]}
                    />
                  ) : props.nextEntryInitial ? (
                    <Text
                      modifiers={[
                        frame({ width: 24, height: 24, alignment: 'center' }),
                        backgroundOverlay({ color: accent }),
                        clipShape('circle'),
                        font({ size: 11, weight: 'bold' }),
                        foregroundStyle('#ffffff'),
                        lineLimit(1),
                      ]}
                    >
                      {props.nextEntryInitial}
                    </Text>
                  ) : null}
                  {props.nextEntryTime ? (
                    <Text
                      modifiers={[
                        font({ size: 11, weight: 'semibold', design: 'rounded' }),
                        foregroundStyle(secondaryStyle),
                        monospacedDigit(),
                        lineLimit(1),
                      ]}
                    >
                      {props.nextEntryTime}
                    </Text>
                  ) : null}
                </HStack>
              ) : null}
            </HStack>
          ) : null
        ) : (
          <HStack spacing={6} alignment="firstTextBaseline">
            <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(secondaryStyle)]}>
              {timerLabel}
            </Text>
            {expandedInlineTimer}
          </HStack>
        )}
        {props.sessionTitle ? (
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(secondaryStyle), lineLimit(1)]}>
            {props.sessionTitle}
          </Text>
        ) : null}
      </VStack>
    </HStack>
  );

  return {
    banner,
    compactLeading: compactIdentity,
    compactTrailing: compactStatusText,
    minimal: compactIdentity,
    expandedLeading: <Spacer minLength={0} />,
    expandedTrailing: <Spacer minLength={0} />,
    expandedCenter: (
      <HStack
        alignment="top"
        spacing={10}
        modifiers={[
          padding({ horizontal: 12, bottom: 8 }),
          frame({ width: 330, alignment: 'leading' }),
          accessibilityElement('combine'),
          accessibilityLabel(accessibilityText),
        ]}
      >
        {props.eventImageUri ? (
          <Image
            uiImage={props.eventImageUri}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: 'fill' }),
              frame({ width: 72, height: 86 }),
              cornerRadius(10),
              clipped(),
              accessibilityLabel('活动资料图'),
            ]}
          />
        ) : null}
        <VStack alignment="leading" spacing={5} modifiers={[frame({ minWidth: 0, maxWidth: Infinity, alignment: 'leading' })]}>
          <Text
            modifiers={[
              font({ size: 19, weight: 'bold' }),
              foregroundStyle(primaryStyle),
              lineLimit(2),
              minimumScaleFactor(0.75),
            ]}
          >
            {props.eventTitle}
          </Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>
            {expandedStatusLabel}
          </Text>
          {isUpcoming ? (
            upcomingDetailsText
          ) : props.hasTimetable ? (
            props.currentEntryTitle || props.nextEntryTitle ? (
              <HStack spacing={6} alignment="center">
                {props.currentEntryTitle ? (
                  <HStack spacing={6} alignment="center">
                    {props.currentArtistAvatarUri ? (
                      <Image
                        uiImage={props.currentArtistAvatarUri}
                        modifiers={[
                          resizable(),
                          aspectRatio({ contentMode: 'fill' }),
                          frame({ width: 22, height: 22 }),
                          clipShape('circle'),
                          clipped(),
                          widgetAccentedRenderingMode('fullColor'),
                          accessibilityLabel('当前条目艺人头像'),
                        ]}
                      />
                    ) : null}
                    <Text
                      modifiers={[
                        font({ size: 16, weight: 'bold' }),
                        foregroundStyle(primaryStyle),
                        lineLimit(1),
                        minimumScaleFactor(0.78),
                        layoutPriority(1),
                      ]}
                    >
                      {props.currentEntryTitle}
                    </Text>
                  </HStack>
                ) : null}
                {props.nextEntryTitle ? (
                  <HStack
                    spacing={5}
                    alignment="center"
                    modifiers={[
                      fixedSize(),
                      accessibilityLabel(`下一项，${props.nextEntryTime ?? ''}，${props.nextEntryTitle}`),
                    ]}
                  >
                    <Image
                      systemName="arrow.right"
                      color="#ffffff"
                      modifiers={[font({ size: 12, weight: 'bold' })]}
                    />
                    {props.nextArtistAvatarUri ? (
                      <Image
                        uiImage={props.nextArtistAvatarUri}
                        modifiers={[
                          resizable(),
                          aspectRatio({ contentMode: 'fill' }),
                          frame({ width: 22, height: 22 }),
                          clipShape('circle'),
                          clipped(),
                          widgetAccentedRenderingMode('fullColor'),
                        ]}
                      />
                    ) : props.nextEntryInitial ? (
                      <Text
                        modifiers={[
                          frame({ width: 22, height: 22, alignment: 'center' }),
                          backgroundOverlay({ color: accent }),
                          clipShape('circle'),
                          font({ size: 10, weight: 'bold' }),
                          foregroundStyle('#ffffff'),
                          lineLimit(1),
                        ]}
                      >
                        {props.nextEntryInitial}
                      </Text>
                    ) : null}
                    {props.nextEntryTime ? (
                      <Text
                        modifiers={[
                          font({ size: 11, weight: 'semibold', design: 'rounded' }),
                          foregroundStyle(secondaryStyle),
                          monospacedDigit(),
                          lineLimit(1),
                        ]}
                      >
                        {props.nextEntryTime}
                      </Text>
                    ) : null}
                  </HStack>
                ) : null}
              </HStack>
            ) : null
          ) : (
              <HStack spacing={6} alignment="firstTextBaseline">
                <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(secondaryStyle)]}>
                  {timerLabel}
                </Text>
                {expandedInlineTimer}
              </HStack>
          )}
        </VStack>
      </HStack>
    ),
    expandedBottom: props.sessionTitle ? (
      <HStack
        modifiers={[
          padding({ horizontal: 12, bottom: 8 }),
          frame({ width: 330, alignment: 'leading' }),
        ]}
      >
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(secondaryStyle), lineLimit(1)]}>
          {props.sessionTitle}
        </Text>
      </HStack>
    ) : (
      <Spacer minLength={0} />
    ),
  };
};

export const EventLiveActivity = createLiveActivity<EventLiveActivityProps>(
  'EventLiveActivity',
  EventLiveActivityView,
);

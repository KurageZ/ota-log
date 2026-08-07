import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Event } from '../types/models';
import { EventCardOshiBadge } from '../utils/oshiMatch';
import { useAppTheme } from '../theme/appTheme';
import { HomeOshiPill } from './HomeOshiPill';
import { CityBadge, formatEventTimes } from './EventPrimitives';
import { AppIcon } from './AppIcon';
import { AnimatedPressable } from './AnimatedPressable';

function getDatePanelColors(
  isDark: boolean,
  accent: string,
  background: string,
) {
  return {
    backgroundColor: background,
    dayTextColor: accent,
    monthTextColor: accent,
    monthOpacity: isDark ? 0.9 : 0.68,
  };
}

export function HomeTimelineEventCard({
  event,
  oshiBadge,
  dayLabel,
  monthLabel,
  showConnector = false,
}: {
  event: Event;
  oshiBadge: EventCardOshiBadge;
  dayLabel: string;
  monthLabel: string;
  showConnector?: boolean;
}) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const statusColors = colors.status[event.status];
  const datePanelColors = getDatePanelColors(
    isDark,
    statusColors.accent,
    statusColors.bg,
  );

  return (
    <View style={{ position: 'relative', marginBottom: 8 }}>
      {showConnector ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 23,
            top: 46,
            bottom: -8,
            width: 1.5,
            borderRadius: 999,
            backgroundColor: colors.accentSofter,
          }}
        />
      ) : null}

      <AnimatedPressable
        onPress={() => router.push(`/events/${event.id}`)}
        pressedOpacity={0.78}
        pressedScale={0.975}
        style={{
          backgroundColor: colors.card,
          borderRadius: 13,
          flexDirection: 'row',
          overflow: 'hidden',
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.12 : 0.07,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <View
          style={{
            width: 46,
            paddingHorizontal: 4,
            paddingTop: 8,
            paddingBottom: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: datePanelColors.backgroundColor,
            borderRightWidth: 3,
            borderRightColor: statusColors.accent,
          }}
        >
          <Text
            style={{
              color: datePanelColors.dayTextColor,
              fontSize: 18.5,
              lineHeight: 21,
              fontWeight: '900',
              fontVariant: ['tabular-nums'],
            }}
          >
            {dayLabel}
          </Text>
          <Text
            style={{
              color: datePanelColors.monthTextColor,
              opacity: datePanelColors.monthOpacity,
              fontSize: 8.75,
              lineHeight: 10.5,
              fontWeight: '700',
              marginTop: 1,
            }}
          >
            {monthLabel}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 15,
              lineHeight: 19,
              fontWeight: '700',
            }}
            numberOfLines={2}
          >
            {event.title}
          </Text>

          {oshiBadge.visible ? (
            <>
              <View style={{ marginTop: 5 }}>
                <HomeOshiPill label={`${oshiBadge.artistName} 参演`} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, marginTop: 5, minHeight: 16 }}>
                <AppIcon name="time" size={11} color={colors.textMuted} />
                <Text
                  style={{
                    fontSize: 12.5,
                    lineHeight: 14.5,
                    fontWeight: '800',
                    color: colors.textSecondary,
                    flexShrink: 0,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatEventTimes(event.open_time, event.start_time) || '全天'}
                </Text>
                {event.venue ? (
                  <>
                    <AppIcon name="eventLocation" size={11} color={colors.textMuted} />
                    <Text
                      style={{
                        flexShrink: 1,
                        fontSize: 12,
                        lineHeight: 14.5,
                        fontWeight: '500',
                        color: colors.textSecondary,
                      }}
                      numberOfLines={1}
                    >
                      {event.venue}
                    </Text>
                  </>
                ) : null}
                {event.city ? <CityBadge city={event.city} size="sm" /> : null}
              </View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, marginTop: 6, minHeight: 16 }}>
                <AppIcon name="time" size={11} color={colors.textMuted} />
                <Text
                  style={{
                    fontSize: 12.5,
                    lineHeight: 14.5,
                    fontWeight: '800',
                    color: colors.textSecondary,
                    flexShrink: 0,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatEventTimes(event.open_time, event.start_time) || '全天'}
                </Text>
              </View>

              {(event.city || event.venue) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, marginTop: 5, minHeight: 16 }}>
                  {event.venue ? (
                    <>
                      <AppIcon name="eventLocation" size={11} color={colors.textMuted} />
                      <Text
                        style={{
                          flexShrink: 1,
                          fontSize: 12,
                          lineHeight: 14.5,
                          fontWeight: '500',
                          color: colors.textSecondary,
                        }}
                        numberOfLines={1}
                      >
                        {event.venue}
                      </Text>
                    </>
                  ) : null}
                  {event.city ? <CityBadge city={event.city} size="sm" /> : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      </AnimatedPressable>
    </View>
  );
}

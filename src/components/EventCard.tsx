import { TouchableOpacity, View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Event } from '../types/models';
import { EventCardOshiBadge } from '../utils/oshiMatch';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { OshiMatchBadge } from './Oshi';
import { EventDateTimeRow, EventRatingStars, EventStatusChip, EventVenueRow } from './EventPrimitives';
import { AppIcon } from './AppIcon';

interface Props {
  event: Event;
  oshiBadge: EventCardOshiBadge;
  variant?: 'default' | 'compact';
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'showcase' | 'showcase-light';
}

export function EventCard({
  event,
  oshiBadge,
  variant = 'default',
  style,
  tone = 'default',
}: Props) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const cardBg = colors.card;
  const isCompact = variant === 'compact';
  const titleColor = tone === 'showcase'
    ? withAlpha(colors.white, 0.94)
    : tone === 'showcase-light'
      ? withAlpha(colors.shadow, 0.85)
      : colors.text;
  const showcaseOshiPalette = tone === 'showcase'
    ? {
        background: colors.heroCalloutBg,
        border: colors.heroCalloutBorder,
        icon: colors.oshiBadgeBorder,
        text: colors.oshiBadgeBorder,
      }
    : {
        background: colors.oshiBadgeBgInverted,
        border: colors.oshiBadgeBorder,
        icon: colors.oshiBadgeBg,
        text: colors.oshiBadgeTextInverted,
      };

  const titleStyle = isCompact
    ? {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '700' as const,
      }
    : {
        fontSize: 16,
        lineHeight: 21,
        fontWeight: '700' as const,
      };

  const containerStyle = isCompact
    ? {
        backgroundColor: cardBg,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
      }
    : {
        backgroundColor: cardBg,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.2 : 0.08,
        shadowRadius: 14,
        elevation: 3,
      };

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={() => router.push(`/events/${event.id}`)}
      activeOpacity={0.72}
    >
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: isCompact ? 5 : 6 }}>
        <Text
          style={{
            color: titleColor,
            ...titleStyle,
          }}
          numberOfLines={1}
        >
          {event.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: isCompact ? 10 : 12, minWidth: 0 }}>
          <View style={{ flex: 1, minWidth: 0, gap: isCompact ? 5 : 6 }}>
            {oshiBadge.visible && (
              tone === 'showcase' || tone === 'showcase-light'
                ? (
                  <View style={{ alignSelf: 'flex-start', borderRadius: 999, overflow: 'hidden' }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 999,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        backgroundColor: showcaseOshiPalette.background,
                        borderWidth: 1,
                        borderColor: showcaseOshiPalette.border,
                      }}
                    >
                      <AppIcon name="oshi" size={11} color={showcaseOshiPalette.icon} />
                      <Text
                        style={{ fontSize: 11.5, lineHeight: 13, fontWeight: '700', color: showcaseOshiPalette.text }}
                        numberOfLines={1}
                      >
                        {oshiBadge.artistName} 参演
                      </Text>
                    </View>
                  </View>
                )
                : <OshiMatchBadge oshiArtistName={oshiBadge.artistName} />
            )}

            <EventDateTimeRow eventDate={event.event_date} eventTime={event.event_time} size={isCompact ? 'sm' : 'md'} tone={tone} />
            <EventVenueRow city={event.city} venue={event.venue} size={isCompact ? 'sm' : 'md'} tone={tone} />
          </View>

          <View style={{ flexShrink: 0, alignItems: 'flex-end', justifyContent: 'center', gap: isCompact ? 5 : 6 }}>
            <EventStatusChip status={event.status} size={isCompact ? 'sm' : 'md'} tone={tone} />
            {event.review_score != null && (
              <EventRatingStars score={event.review_score} size="sm" tone={tone} />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

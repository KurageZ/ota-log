import { TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Event } from '../types/models';
import { useAppTheme } from '../theme/appTheme';
import { EventDateTimeRow, EventRatingStars, EventStatusChip, EventVenueRow } from './EventPrimitives';

export function HomeCompletedEventCard({ event }: { event: Event }) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.74}
      onPress={() => router.push(`/events/${event.id}`)}
      style={{
        backgroundColor: colors.cardAlt,
        borderRadius: 15,
        paddingHorizontal: 13,
        paddingVertical: 11,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.divider,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.08 : 0.04,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: 14.5,
          lineHeight: 18.5,
          fontWeight: '500',
        }}
        numberOfLines={2}
      >
        {event.title}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 7 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <EventDateTimeRow
            eventDate={event.event_date}
            openTime={event.open_time}
            startTime={event.start_time}
            size="sm"
          />
          <EventVenueRow
            city={event.city}
            venue={event.venue}
            size="sm"
          />
        </View>

        <View style={{ flexShrink: 0, alignItems: 'flex-end', gap: 5, paddingTop: 1 }}>
          <EventStatusChip status={event.status} size="sm" />
          {event.review_score != null ? (
            <EventRatingStars score={event.review_score} size="sm" />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

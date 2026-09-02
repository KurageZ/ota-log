import { TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { HeroBannerItem } from './HeroBanner';
import { daysUntil } from '../utils/date';
import { useAppTheme } from '../theme/appTheme';
import { OshiAvatar, OshiBadge } from './Oshi';
import { resolveAvatarSource } from '../utils/avatarSource';
import { formatEventTimes } from './EventPrimitives';

export function HomeUpcomingHero({ item }: { item: HeroBannerItem }) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { event, isOshiMatch, oshiArtist } = item;
  const countdown = getCountdownCopy(event.event_date, event.event_time);
  const oshiName = oshiArtist?.short_name || oshiArtist?.name || '你的单推';
  const metaParts = [
    formatEventTimes(event.open_time, event.start_time) || '全天',
    event.venue,
  ]
    .filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/events/${event.id}`)}
      style={{
        borderRadius: 22,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 18,
        backgroundColor: colors.heroBg,
        overflow: 'hidden',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.26 : 0.12,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View style={{ position: 'absolute', top: -24, right: -18, width: 116, height: 116, borderRadius: 58, backgroundColor: colors.heroDecor }} />
      <View style={{ position: 'absolute', bottom: -44, left: 34, width: 96, height: 96, borderRadius: 48, backgroundColor: colors.heroDecorWeak }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 72,
            minHeight: 72,
            borderRadius: 16,
            backgroundColor: colors.heroCalloutBg,
            borderWidth: 1,
            borderColor: colors.heroCalloutBorder,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              color: colors.heroText,
              fontSize: countdown.value.length > 3 ? 20 : 32,
              lineHeight: countdown.value.length > 3 ? 24 : 34,
              fontWeight: '900',
              letterSpacing: countdown.value.length > 3 ? -0.8 : -1.8,
              fontVariant: ['tabular-nums'],
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {countdown.value}
          </Text>
          {countdown.label ? (
            <Text
              style={{
                color: colors.heroSubtext,
                fontSize: 10.5,
                lineHeight: 13,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              {countdown.label}
            </Text>
          ) : null}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text
            style={{
              color: colors.heroEyebrow,
              fontSize: 10,
              lineHeight: 12,
              fontWeight: '800',
              letterSpacing: 0.8,
            }}
          >
            最近活动
          </Text>
          <Text
            style={{
              color: colors.heroText,
              fontSize: 14,
              lineHeight: 19,
              fontWeight: '800',
            }}
            numberOfLines={2}
          >
            {event.title}
          </Text>
          <Text
            style={{
              color: colors.heroSubtext,
              fontSize: 11.5,
              lineHeight: 15,
              fontWeight: '500',
            }}
            numberOfLines={1}
          >
            {metaParts.join(' · ') || '时间地点待确认'}
          </Text>
        </View>
      </View>

      {isOshiMatch && oshiArtist ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 16,
            paddingHorizontal: 10,
            paddingVertical: 9,
            marginTop: 10,
            backgroundColor: colors.heroCalloutBg,
            borderWidth: 1,
            borderColor: colors.heroCalloutBorder,
          }}
        >
          <View style={{ marginRight: 10 }}>
            <OshiAvatar
              source={resolveAvatarSource(oshiArtist.avatar_uri)}
              size={32}
              isOshi
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: colors.heroText,
                fontSize: 12.5,
                lineHeight: 15,
                fontWeight: '700',
                marginBottom: 2,
              }}
            >
              这场活动有你推参加哦
            </Text>
            <Text
              style={{
                color: colors.heroCalloutSubtext,
                fontSize: 11.5,
                lineHeight: 13.5,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {oshiName}
            </Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <OshiBadge />
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function getCountdownCopy(eventDate: string, eventTime: string | null) {
  const days = daysUntil(eventDate);

  if (days <= 0 && eventTime) {
    return { value: eventTime, label: days < 0 ? '已结束' : '今天' };
  }

  if (days <= 0) {
    return { value: '今天', label: null };
  }

  if (days === 1) {
    return { value: '明天', label: '准备出发' };
  }

  return { value: String(days), label: '天后' };
}

import { useState } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Artist, Event } from '../types/models';
import { daysUntil, formatDate } from '../utils/date';
import { OshiAvatar, OshiBadge } from './Oshi';
import { resolveAvatarSource } from '../utils/avatarSource';
import { useAppTheme } from '../theme/appTheme';
import { OshiMatchSource } from '../utils/oshiMatch';

export interface HeroBannerItem {
  event: Event;
  isOshiMatch: boolean;
  oshiArtist: Artist | null;
  matchSource: OshiMatchSource;
}

interface Props {
  item: HeroBannerItem | null;
}

export function HeroBanner({ item }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [countdownUnitWidth, setCountdownUnitWidth] = useState(0);

  if (!item) {
    return null;
  }

  const { event, isOshiMatch, oshiArtist } = item;
  const days = daysUntil(event.event_date);
  const heroCenter = getHeroCenterText(days, event.event_time);
  const detailLine = [formatDate(event.event_date), event.event_time, event.venue].filter(Boolean).join(' · ');
  const oshiName = oshiArtist?.short_name || oshiArtist?.name || '你的单推';

  return (
    <TouchableOpacity
      style={[containerStyle, { backgroundColor: colors.heroBg }]}
      activeOpacity={0.88}
      onPress={() => router.push(`/events/${event.id}`)}
    >
      <Decor isOshiMatch={isOshiMatch} />

      <View style={countdownWrapStyle}>
        {heroCenter.value ? (
          <View
            style={[
              countdownRowStyle,
              { transform: [{ translateX: countdownUnitWidth / 2 }] },
            ]}
          >
            <Text style={[countdownValueStyle, { color: colors.heroText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {heroCenter.value}
            </Text>
            <Text
              style={[countdownUnitStyle, { color: colors.heroSubtext }]}
              numberOfLines={1}
              onLayout={(event) => setCountdownUnitWidth(event.nativeEvent.layout.width)}
            >
              {heroCenter.label}
            </Text>
          </View>
        ) : (
          <Text
            style={[countdownLabelOnlyStyle, { color: colors.heroSubtext }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {heroCenter.label}
          </Text>
        )}
      </View>

      <View style={eventBlockStyle}>
        <View style={titleRowStyle}>
          <Text
            style={[infoTitleStyle, { color: colors.heroText }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {event.title}
          </Text>
        </View>
        <Text style={[infoMetaStyle, { color: colors.heroSubtext }]} numberOfLines={1}>{detailLine || '时间地点待确认'}</Text>
      </View>

      {isOshiMatch && oshiArtist ? (
        <View style={[oshiCalloutStyle, { backgroundColor: colors.heroCalloutBg, borderColor: colors.heroCalloutBorder }]}>
          <View style={{ marginRight: 10 }}>
            <OshiAvatar source={resolveAvatarSource(oshiArtist.avatar_uri)} size={34} isOshi />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[oshiCalloutTitle, { color: colors.heroText }]}>这场活动有你推参加哦</Text>
            <Text style={[oshiCalloutSubtitle, { color: colors.heroCalloutSubtext }]} numberOfLines={1}>{oshiName}</Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <OshiBadge />
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const containerStyle = {
  borderRadius: 24,
  paddingTop: 24,
  paddingBottom: 22,
  paddingHorizontal: 20,
  marginBottom: 24,
  overflow: 'hidden' as const,
};

const countdownWrapStyle = {
  alignItems: 'center' as const,
  marginBottom: 2,
  minHeight: 92,
  justifyContent: 'center' as const,
};

const countdownRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'flex-end' as const,
  justifyContent: 'center' as const,
};

const countdownValueStyle = {
  color: '#f5f3ff',
  fontSize: 82,
  fontWeight: '900' as const,
  lineHeight: 84,
  letterSpacing: -3,
  textAlign: 'center' as const,
};

const countdownUnitStyle = {
  color: 'rgba(233,213,255,0.92)' as const,
  fontSize: 18,
  fontWeight: '700' as const,
  lineHeight: 24,
  marginLeft: 2,
  marginBottom: 10,
};

const countdownLabelOnlyStyle = {
  color: 'rgba(233,213,255,0.92)' as const,
  fontSize: 18,
  fontWeight: '700' as const,
  lineHeight: 24,
  textAlign: 'center' as const,
  maxWidth: '100%' as const,
};

const oshiCalloutStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  borderRadius: 18,
  paddingHorizontal: 12,
  paddingVertical: 10,
  marginTop: 14,
  marginBottom: 2,
  backgroundColor: 'rgba(255,255,255,0.09)',
  borderWidth: 1,
  borderColor: 'rgba(249,168,212,0.24)',
};

const eventBlockStyle = {
  alignItems: 'center' as const,
  marginTop: 2,
};

const titleRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
  width: '100%' as const,
};

const infoTitleStyle = {
  color: '#ffffff',
  fontSize: 18,
  lineHeight: 24,
  fontWeight: '800' as const,
  textAlign: 'center' as const,
  flexShrink: 1 as const,
  maxWidth: '100%' as const,
};

const infoMetaStyle = {
  color: 'rgba(233,213,255,0.9)' as const,
  fontSize: 13,
  lineHeight: 18,
  marginTop: 8,
  textAlign: 'center' as const,
};

const oshiCalloutTitle = {
  color: '#fff',
  fontSize: 13,
  fontWeight: '700' as const,
  marginBottom: 2,
};

const oshiCalloutSubtitle = {
  color: 'rgba(251,207,232,0.92)' as const,
  fontSize: 12,
  fontWeight: '600' as const,
};

function Decor({ isOshiMatch }: { isOshiMatch: boolean }) {
  const { colors } = useAppTheme();

  return (
    <>
      <View style={{ position: 'absolute', top: -32, right: -24, width: 220, height: 220, borderRadius: 110, backgroundColor: isOshiMatch ? colors.heroDecorOshi : colors.heroDecor }} />
      <View style={{ position: 'absolute', top: 72, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.heroDecorWeak }} />
      <View style={{ position: 'absolute', bottom: -56, right: 48, width: 140, height: 140, borderRadius: 70, backgroundColor: colors.heroDecorWeak }} />
    </>
  );
}

function getHeroCenterText(days: number, eventTime: string | null) {
  if (days < 0) {
    return {
      value: '',
      label: '已结束，记得补上回顾',
    };
  }

  if (days === 0 && eventTime) {
    return {
      value: eventTime,
      label: '今天',
    };
  }

  if (days === 0) {
    return {
      value: '今天',
      label: '',
    };
  }

  if (days === 1) {
    return {
      value: '明天',
      label: '',
    };
  }

  return {
    value: String(days),
    label: '天后',
  };
}

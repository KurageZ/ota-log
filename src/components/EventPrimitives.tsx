import type { RefObject } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { type EventStatus } from '../types/models';
import { formatDate } from '../utils/date';
import { STATUS_LABELS } from '../utils/labels';
import { type ThemeColors, useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { AppIcon, type AppIconName } from './AppIcon';

const statusChipSizes = {
  sm: {
    dot: 4,
    gap: 4,
    fontSize: 10.5,
    lineHeight: 12,
    paddingLeft: 7,
    paddingRight: 9,
    paddingVertical: 3,
    iconSize: 12,
  },
  md: {
    dot: 5,
    gap: 5,
    fontSize: 11,
    lineHeight: 13,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
    iconSize: 13,
  },
} as const;

const ratingStarSizes = {
  sm: {
    fontSize: 13,
    lineHeight: 14,
    gap: 1,
    hitSlop: { top: 6, bottom: 6, left: 3, right: 3 },
  },
  md: {
    fontSize: 16,
    lineHeight: 18,
    gap: 2,
    hitSlop: { top: 7, bottom: 7, left: 4, right: 4 },
  },
  lg: {
    fontSize: 28,
    lineHeight: 28,
    gap: 4,
    hitSlop: { top: 8, bottom: 8, left: 4, right: 4 },
  },
} as const;

const metaRowSizes = {
  sm: {
    iconSize: 12,
    timeFontSize: 12,
    timeLineHeight: 14,
    venueFontSize: 12,
    venueLineHeight: 15,
    cityFontSize: 10.5,
    cityLineHeight: 11,
    cityPaddingHorizontal: 6,
    cityPaddingVertical: 3,
  },
  md: {
    iconSize: 13,
    timeFontSize: 12.5,
    timeLineHeight: 15,
    venueFontSize: 13,
    venueLineHeight: 16,
    cityFontSize: 11.5,
    cityLineHeight: 12,
    cityPaddingHorizontal: 7,
    cityPaddingVertical: 3,
  },
} as const;

type EventStatusChipSize = keyof typeof statusChipSizes;
type EventRatingStarsSize = keyof typeof ratingStarSizes;
type EventMetaSize = keyof typeof metaRowSizes;
type EventPrimitiveTone = 'default' | 'showcase' | 'showcase-light';

function resolveShowcasePalette(tone: EventPrimitiveTone, colors: ThemeColors) {
  if (tone === 'showcase') {
    return {
      status: Object.fromEntries(
        Object.entries(colors.status).map(([status, statusColors]) => [
          status,
          { accent: statusColors.accent, bg: withAlpha(statusColors.accent, 0.18) },
        ]),
      ) as ThemeColors['status'],
      starActive: colors.starActive,
      starInactive: withAlpha(colors.white, 0.22),
      cityBadgeBg: withAlpha(colors.info, 0.16),
      cityBadgeText: colors.info,
      iconColor: withAlpha(colors.white, 0.54),
      primaryText: withAlpha(colors.white, 0.9),
      secondaryText: withAlpha(colors.white, 0.66),
      venueText: withAlpha(colors.white, 0.84),
    };
  }

  if (tone === 'showcase-light') {
    return {
      status: colors.status,
      starActive: colors.starActive,
      starInactive: withAlpha(colors.shadow, 0.14),
      cityBadgeBg: colors.cityBadgeBg,
      cityBadgeText: colors.cityBadgeText,
      iconColor: withAlpha(colors.shadow, 0.42),
      primaryText: withAlpha(colors.shadow, 0.85),
      secondaryText: withAlpha(colors.shadow, 0.54),
      venueText: withAlpha(colors.shadow, 0.72),
    };
  }

  return null;
}

export function EventStatusChip({
  status,
  size = 'md',
  trailingIcon,
  onPress,
  style,
  buttonRef,
  disabled = false,
  tone = 'default',
}: {
  status: EventStatus;
  size?: EventStatusChipSize;
  trailingIcon?: AppIconName;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  buttonRef?: RefObject<View | null>;
  disabled?: boolean;
  tone?: EventPrimitiveTone;
}) {
  const { colors } = useAppTheme();
  const tokens = statusChipSizes[size];
  const sp = resolveShowcasePalette(tone, colors);
  const accent = sp ? sp.status[status].accent : colors.status[status].accent;
  const backgroundColor = sp ? sp.status[status].bg : colors.status[status].bg;

  const content = (
    <>
      <View
        style={{
          width: tokens.dot,
          height: tokens.dot,
          borderRadius: tokens.dot,
          backgroundColor: accent,
        }}
      />
      <Text
        style={{
          fontSize: tokens.fontSize,
          lineHeight: tokens.lineHeight,
          fontWeight: '600',
          color: accent,
        }}
      >
        {STATUS_LABELS[status]}
      </Text>
      {trailingIcon ? <AppIcon name={trailingIcon} size={tokens.iconSize} color={accent} /> : null}
    </>
  );

  const containerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: tokens.gap,
    borderRadius: 999,
    paddingLeft: tokens.paddingLeft,
    paddingRight: tokens.paddingRight,
    paddingVertical: tokens.paddingVertical,
    backgroundColor,
    opacity: disabled ? 0.6 : 1,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        ref={buttonRef}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={[containerStyle, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View ref={buttonRef} style={[containerStyle, style]}>
      {content}
    </View>
  );
}

export function EventRatingStars({
  score,
  size = 'sm',
  onChange,
  tone = 'default',
}: {
  score?: number | null;
  size?: EventRatingStarsSize;
  onChange?: (score: number) => void;
  tone?: EventPrimitiveTone;
}) {
  const { colors } = useAppTheme();
  const tokens = ratingStarSizes[size];
  const sp = resolveShowcasePalette(tone, colors);

  return (
    <View style={{ flexDirection: 'row', gap: tokens.gap, flexShrink: 0 }}>
      {Array.from({ length: 5 }).map((_, index) => {
        const star = (
          <Text
            style={{
              fontSize: tokens.fontSize,
              lineHeight: tokens.lineHeight,
              color: index < (score ?? 0)
                ? (sp?.starActive ?? colors.starActive)
                : (sp?.starInactive ?? colors.starInactive),
            }}
          >
            ★
          </Text>
        );

        if (!onChange) {
          return <View key={index}>{star}</View>;
        }

        return (
          <TouchableOpacity
            key={index}
            onPress={() => onChange(index + 1)}
            hitSlop={tokens.hitSlop}
            activeOpacity={0.6}
          >
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function CityBadge({
  city,
  size = 'md',
  tone = 'default',
}: {
  city: string;
  size?: EventMetaSize;
  tone?: EventPrimitiveTone;
}) {
  const { colors } = useAppTheme();
  const tokens = metaRowSizes[size];
  const sp = resolveShowcasePalette(tone, colors);

  return (
    <View
      style={{
        flexShrink: 0,
        borderRadius: 6,
        paddingHorizontal: tokens.cityPaddingHorizontal,
        paddingVertical: tokens.cityPaddingVertical,
        backgroundColor: sp?.cityBadgeBg ?? colors.cityBadgeBg,
      }}
    >
      <Text
        style={{
          fontSize: tokens.cityFontSize,
          lineHeight: tokens.cityLineHeight,
          fontWeight: '600',
          color: sp?.cityBadgeText ?? colors.cityBadgeText,
        }}
      >
        {city}
      </Text>
    </View>
  );
}

export function EventDateTimeRow({
  eventDate,
  eventTime,
  size = 'md',
  tone = 'default',
}: {
  eventDate: string;
  eventTime?: string | null;
  size?: EventMetaSize;
  tone?: EventPrimitiveTone;
}) {
  const { colors, isDark } = useAppTheme();
  const tokens = metaRowSizes[size];
  const spDt = resolveShowcasePalette(tone, colors);
  const iconColor = spDt ? spDt.iconColor : isDark ? colors.textSecondary : colors.textMuted;
  const primaryTextColor = spDt ? spDt.primaryText : isDark ? colors.text : colors.textSecondary;
  const secondaryTextColor = spDt ? spDt.secondaryText : colors.textSecondary;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <AppIcon name="time" size={tokens.iconSize} color={iconColor} />
      <Text
        style={{
          flexShrink: 1,
          fontSize: tokens.timeFontSize,
          lineHeight: tokens.timeLineHeight,
          fontWeight: '500',
          color: primaryTextColor,
        }}
        numberOfLines={1}
      >
        {formatDate(eventDate)}
      </Text>
      {eventTime ? (
        <Text
          style={{
            flexShrink: 0,
            fontSize: tokens.timeFontSize,
            lineHeight: tokens.timeLineHeight,
            fontWeight: '600',
            color: primaryTextColor,
            fontVariant: ['tabular-nums'],
          }}
        >
          · {eventTime}
        </Text>
      ) : (
        <Text
          style={{
            flexShrink: 0,
            fontSize: tokens.timeFontSize,
            lineHeight: tokens.timeLineHeight,
            fontWeight: '500',
            color: secondaryTextColor,
          }}
        >
          · 全天
        </Text>
      )}
    </View>
  );
}

export function EventVenueRow({
  city,
  venue,
  size = 'md',
  tone = 'default',
}: {
  city?: string | null;
  venue?: string | null;
  size?: EventMetaSize;
  tone?: EventPrimitiveTone;
}) {
  const { colors, isDark } = useAppTheme();
  const tokens = metaRowSizes[size];
  const spVr = resolveShowcasePalette(tone, colors);
  const iconColor = spVr ? spVr.iconColor : isDark ? colors.textSecondary : colors.textMuted;
  const venueTextColor = spVr ? spVr.venueText : isDark ? colors.text : colors.textSecondary;

  if (!city && !venue) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {city ? <CityBadge city={city} size={size} tone={tone} /> : null}
      {venue ? (
        <>
          <AppIcon name="eventLocation" size={tokens.iconSize} color={iconColor} />
          <Text
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: tokens.venueFontSize,
              lineHeight: tokens.venueLineHeight,
              fontWeight: '500',
              color: venueTextColor,
            }}
            numberOfLines={1}
          >
            {venue}
          </Text>
        </>
      ) : null}
    </View>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ThemeColors } from '../theme/appTheme';
import { OshiAvatar } from './Oshi';
import { AppIcon } from './AppIcon';
import { resolveAvatarSource } from '../utils/avatarSource';
import { extractArtistBackgroundColor } from '../utils/artistBackdrop';
import {
  buildArtistShareSegments,
  formatSharePercentage,
  prepareArtistShareColors,
  type ArtistShareInput,
} from '../utils/artistShare';

const CHART_SIZE = 136;
const CHART_CENTER = CHART_SIZE / 2;
const RADIUS = 50;
const ARTIST_STROKE_WIDTH = 22;
const OTHER_STROKE_WIDTH = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 3;

export function ChekiArtistShareChart({
  items,
  total,
  colors,
  isDark,
}: {
  items: ArtistShareInput[];
  total: number;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const segments = buildArtistShareSegments(items, total);
  const artistSegments = segments.filter((segment) => !segment.isOther);
  const fallbackColors = useMemo(
    () => [colors.featureCheki, colors.accent, colors.featureArtists],
    [colors.accent, colors.featureArtists, colors.featureCheki],
  );
  const avatarColorSourceKey = JSON.stringify(artistSegments.map((segment) => segment.avatarUri ?? null));
  const [artistColors, setArtistColors] = useState(() => fallbackColors);
  const segmentColors = segments.map((segment, index) => (
    segment.isOther ? colors.textMuted : (artistColors[index] ?? fallbackColors[index])
  ));
  let consumedLength = 0;

  useEffect(() => {
    let active = true;
    setArtistColors(fallbackColors);

    Promise.all(artistSegments.map(async (segment) => {
      const source = resolveAvatarSource(segment.avatarUri);
      const uri = source ? Image.resolveAssetSource(source)?.uri : null;
      return uri ? extractArtistBackgroundColor(uri) : null;
    })).then((extracted) => {
      if (active) setArtistColors(prepareArtistShareColors(extracted, fallbackColors, isDark));
    });

    return () => {
      active = false;
    };
  }, [avatarColorSourceKey, fallbackColors, isDark]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`拍立得占比。${segments.map((segment) => (
        `${segment.name}${segment.value}张，占${formatSharePercentage(segment.value, total)}`
      )).join('；')}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
    >
      <View style={{ width: CHART_SIZE, height: CHART_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={CHART_SIZE} height={CHART_SIZE} accessibilityElementsHidden>
          <Circle
            cx={CHART_CENTER}
            cy={CHART_CENTER}
            r={RADIUS}
            fill="none"
            stroke={colors.inputBorder}
            strokeWidth={OTHER_STROKE_WIDTH}
            opacity={0.45}
          />
          {segments.map((segment, index) => {
            const segmentLength = (segment.value / total) * CIRCUMFERENCE;
            const gapLength = segments.length > 1 ? Math.min(SEGMENT_GAP, segmentLength * 0.2) : 0;
            const visibleLength = Math.max(0, segmentLength - gapLength);
            const dashOffset = -consumedLength;
            consumedLength += segmentLength;
            return (
              <Circle
                key={segment.isOther ? '__other__' : (segment.id ?? segment.name)}
                cx={CHART_CENTER}
                cy={CHART_CENTER}
                r={RADIUS}
                fill="none"
                stroke={segmentColors[index]}
                strokeWidth={segment.isOther ? OTHER_STROKE_WIDTH : ARTIST_STROKE_WIDTH}
                strokeDasharray={`${visibleLength} ${CIRCUMFERENCE - visibleLength}`}
                strokeDashoffset={dashOffset}
                rotation={-90}
                origin={`${CHART_CENTER}, ${CHART_CENTER}`}
              />
            );
          })}
        </Svg>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 24, lineHeight: 28, fontWeight: '900', color: colors.heading, fontVariant: ['tabular-nums'] }}>
            {total}
          </Text>
          <Text style={{ marginTop: 1, fontSize: 11, lineHeight: 14, color: colors.textMuted }}>拍立得</Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
        {segments.map((segment, index) => (
          <View key={segment.isOther ? '__other__' : (segment.id ?? segment.name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 }}>
            {segment.isOther ? (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.cardAlt,
                }}
              >
                <AppIcon name="artists" size={14} color={colors.textMuted} />
              </View>
            ) : (
              <View style={{ width: 31, height: 31 }}>
                <OshiAvatar
                  source={resolveAvatarSource(segment.avatarUri)}
                  size={28}
                  isOshi={segment.isOshi === true}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: -1,
                    bottom: 0,
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: colors.card,
                    backgroundColor: segmentColors[index],
                  }}
                />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, fontWeight: '700', color: segment.isOther ? colors.textSecondary : colors.text }}>
                {segment.name}
              </Text>
              <Text style={{ marginTop: 1, fontSize: 11, lineHeight: 14, color: colors.textMuted, fontVariant: ['tabular-nums'] }}>
                {segment.value} 张 · {formatSharePercentage(segment.value, total)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

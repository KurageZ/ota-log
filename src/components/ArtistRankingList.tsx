import { Image, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon } from './AppIcon';
import type { ThemeColors } from '../theme/appTheme';
import { resolveAvatarSource } from '../utils/avatarSource';
import { formatSharePercentage } from '../utils/artistShare';

export interface ArtistRankingItem {
  id: string | null;
  name: string;
  avatarUri?: string | null;
  value: number;
}

interface ArtistRankingListProps {
  items: readonly ArtistRankingItem[];
  colors: ThemeColors;
  suffix?: string;
  percentageTotal?: number;
  onPressItem?: (item: ArtistRankingItem) => void;
  getAccessibilityLabel?: (item: ArtistRankingItem) => string;
}

export function ArtistRankingList({
  items,
  colors,
  suffix = '',
  percentageTotal,
  onPressItem,
  getAccessibilityLabel,
}: ArtistRankingListProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <View>
      {items.map((item, index) => {
        const avatarSource = resolveAvatarSource(item.avatarUri);
        const pct = Math.min(item.value / maxValue, 1);
        const percentageLabel = percentageTotal && percentageTotal > 0
          ? formatSharePercentage(item.value, percentageTotal)
          : null;
        const isLast = index === items.length - 1;
        const canPress = onPressItem != null && item.id != null;

        return (
          <TouchableOpacity
            key={item.id ?? item.name}
            activeOpacity={canPress ? 0.7 : 1}
            disabled={!canPress}
            onPress={canPress ? () => onPressItem?.(item) : undefined}
            accessibilityRole={canPress ? 'button' : undefined}
            accessibilityLabel={canPress ? [
              getAccessibilityLabel?.(item),
              `${item.value}${suffix ? ` ${suffix}` : ''}`,
              percentageLabel,
            ].filter(Boolean).join('，') : undefined}
            style={{
              paddingVertical: 9,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: colors.divider,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  backgroundColor: colors.oshiAvatarBg,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {avatarSource ? (
                  <Image source={avatarSource} style={{ width: 38, height: 38, borderRadius: 999 }} />
                ) : (
                  <AppIcon name="artist" size={17} color={colors.accent} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.text }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: colors.accent, fontVariant: ['tabular-nums'] }}>
                    {item.value}
                    {suffix ? ` ${suffix}` : ''}
                    {percentageLabel ? ` · ${percentageLabel}` : ''}
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.inputBorder,
                    marginTop: 7,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: colors.accent,
                      width: `${pct * 100}%`,
                    }}
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

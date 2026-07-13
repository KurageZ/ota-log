import { TouchableOpacity, View, Text } from 'react-native';
import { AppIcon } from './AppIcon';
import { Artist, ChekiManualEntry, Event } from '../types/models';
import { formatDate } from '../utils/date';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { OshiAvatar } from './Oshi';
import { resolveAvatarSource } from '../utils/avatarSource';
import { getArtistPrimaryName } from '../utils/artistDisplay';

interface ChekiManualEntryListProps {
  entries: ChekiManualEntry[];
  eventMap: Map<string, Event>;
  isDark: boolean;
  onPressEntry?: (entry: ChekiManualEntry) => void;
  title?: string | null;
  tone?: 'default' | 'glass';
  artistMap?: Map<string, Artist>;
  oshiArtistId?: string | null;
  showArtistMeta?: boolean;
}

export function ChekiManualEntryList({
  entries,
  onPressEntry,
  title = '记录',
  tone = 'default',
  artistMap,
  oshiArtistId = null,
  showArtistMeta = false,
}: ChekiManualEntryListProps) {
  const { colors } = useAppTheme();

  if (entries.length === 0) return null;

  const palette = tone === 'glass'
    ? {
        title: withAlpha(colors.white, 0.56),
        containerBorder: withAlpha(colors.white, 0.12),
        containerBg: withAlpha(colors.shadow, 0.58),
        rowDivider: withAlpha(colors.white, 0.12),
        badgeBg: withAlpha(colors.white, 0.12),
        badgeText: colors.white,
        heading: colors.white,
        body: withAlpha(colors.white, 0.9),
        subtext: withAlpha(colors.white, 0.68),
        chevron: withAlpha(colors.white, 0.5),
      }
    : {
        title: colors.textMuted,
        containerBorder: colors.divider,
        containerBg: colors.cardAlt,
        rowDivider: colors.divider,
        badgeBg: colors.accentSoft,
        badgeText: colors.accent,
        heading: colors.text,
        body: colors.textSecondary,
        subtext: colors.textMuted,
        chevron: colors.chevron,
      };

  return (
    <View style={{ marginTop: title ? 12 : 0 }}>
      {title ? (
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.title, marginBottom: 8 }}>
          {title}
        </Text>
      ) : null}
      <View
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: palette.containerBorder,
          backgroundColor: palette.containerBg,
        }}
      >
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          const Container = onPressEntry ? TouchableOpacity : View;
          const artist = artistMap?.get(entry.artist_id) ?? null;
          const isOshi = artist?.id === oshiArtistId;
          const artistName = artist ? getArtistPrimaryName(artist) : '未关联艺人';

          return (
            <Container
              key={entry.id}
              onPress={onPressEntry ? () => onPressEntry(entry) : undefined}
              activeOpacity={0.75}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 11,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: palette.rowDivider,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {showArtistMeta ? (
                  <View>
                    <OshiAvatar
                      source={artist ? resolveAvatarSource(artist.avatar_uri) : null}
                      size={32}
                      isOshi={isOshi}
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  {showArtistMeta ? (
                    <Text
                      numberOfLines={1}
                      style={{ marginBottom: 4, fontSize: 14, fontWeight: '800', color: palette.heading }}
                    >
                      {artistName}
                    </Text>
                  ) : null}
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: palette.heading }}>
                    {entry.date ? formatDate(entry.date) : '未填写日期'}
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: palette.body }}>
                  {entry.count} 张
                </Text>
                {onPressEntry ? (
                  <View style={{ paddingTop: 2 }}>
                    <AppIcon name="disclosure" variant="forward" size={14} color={palette.chevron} />
                  </View>
                ) : null}
              </View>
            </Container>
          );
        })}
      </View>
    </View>
  );
}

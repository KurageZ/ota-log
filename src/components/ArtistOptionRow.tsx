import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Artist } from '../types/models';
import { resolveAvatarSource } from '../utils/avatarSource';
import { ArtistDisplayMode, getArtistDisplayText } from '../utils/artistDisplay';
import { ThemeColors } from '../theme/appTheme';
import { AppIcon } from './AppIcon';
import { OshiAvatar, OshiBadge } from './Oshi';

export const ARTIST_OPTION_ROW_HEIGHT = 48;

export type ArtistOptionTrailing = 'none' | 'check' | 'remove';

export const ArtistOptionRow = memo(function ArtistOptionRow({
  artist,
  selected,
  isDark,
  isLast,
  isOshi,
  parentName,
  colors,
  displayMode = 'compact',
  trailing = 'none',
  onPress,
  onTrailingPress,
}: {
  artist: Artist;
  selected: boolean;
  isDark: boolean;
  isLast: boolean;
  isOshi: boolean;
  parentName?: string | null;
  colors: ThemeColors;
  displayMode?: ArtistDisplayMode;
  trailing?: ArtistOptionTrailing;
  onPress?: (artist: Artist) => void;
  onTrailingPress?: (artist: Artist) => void;
}) {
  const avatarSrc = resolveAvatarSource(artist.avatar_uri);
  const display = getArtistDisplayText({
    artist,
    parentName: parentName ?? undefined,
    mode: displayMode,
  });
  const showTrailing = trailing !== 'none';

  return (
    <TouchableOpacity
      onPress={onPress ? () => onPress(artist) : undefined}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ARTIST_OPTION_ROW_HEIGHT,
        paddingHorizontal: 12,
        paddingVertical: 9,
        backgroundColor: selected ? colors.accentPress : colors.card,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: isDark ? colors.inputBorder : colors.cardAlt,
      }}
    >
      <View style={{ marginRight: 10 }}>
        <OshiAvatar source={avatarSrc} size={28} isOshi={isOshi} name={display.title} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 14,
              fontWeight: selected ? '600' : '500',
              color: selected ? colors.accent : colors.text,
            }}
          >
            {display.title}
          </Text>
          {isOshi ? <OshiBadge /> : null}
        </View>
        {display.subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 1,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {display.subtitle}
          </Text>
        ) : null}
      </View>
      {showTrailing ? (
        <TouchableOpacity
          onPress={onTrailingPress ? () => onTrailingPress(artist) : undefined}
          activeOpacity={onTrailingPress ? 0.7 : 1}
          disabled={!onTrailingPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon
            name={trailing === 'remove' ? 'closeCircle' : 'statusCompleted'}
            size={16}
            color={colors.accent}
          />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
});

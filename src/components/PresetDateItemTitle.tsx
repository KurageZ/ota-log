import { useState } from 'react';
import { Text, TextStyle, View } from 'react-native';
import { Artist } from '../types/models';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { resolveAvatarSource } from '../utils/avatarSource';
import { DateItemPresetKind } from '../utils/dateItemDisplay';
import { OshiAvatar } from './Oshi';

type Props = {
  kind: Exclude<DateItemPresetKind, null>;
  artist: Artist;
  color: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  avatarSize: number;
  gap?: number;
  lineGap?: number;
};

export function PresetDateItemTitle({
  kind,
  artist,
  color,
  fontSize,
  lineHeight,
  fontWeight,
  avatarSize,
  gap = 6,
  lineGap = 2,
}: Props) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const artistName = getArtistPrimaryName(artist);
  const isFirstCheki = kind === 'firstCheki';
  const prefix = isFirstCheki ? '与' : '首次观看';
  const suffix = isFirstCheki ? '首次拍立得' : '的演出';
  const textStyle = { fontSize, lineHeight, fontWeight, color };
  const fullTextWidth = textWidth + avatarSize + gap * 3;
  const shouldSplit = Boolean(availableWidth > 0 && textWidth > 0 && fullTextWidth > availableWidth);

  return (
    <View
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
      style={{ minWidth: 0 }}
    >
      <Text
        onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
        style={[textStyle, { position: 'absolute', opacity: 0, left: 0, top: 0 }]}
        numberOfLines={1}
        accessible={false}
      >
        {`${prefix} ${artistName} ${suffix}`}
      </Text>
      {shouldSplit ? (
        <View style={{ gap: lineGap, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap, minWidth: 0 }}>
            <Text style={textStyle}>{prefix}</Text>
            <OshiAvatar
              source={resolveAvatarSource(artist.avatar_uri)}
              size={avatarSize}
              isOshi={false}
            />
            <Text numberOfLines={1} style={[textStyle, { flex: 1, minWidth: 0 }]}>
              {artistName}
            </Text>
          </View>
          <Text numberOfLines={1} style={textStyle}>
            {suffix}
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap, minWidth: 0 }}>
          <Text style={textStyle}>{prefix}</Text>
          <OshiAvatar
            source={resolveAvatarSource(artist.avatar_uri)}
            size={avatarSize}
            isOshi={false}
          />
          <Text numberOfLines={1} style={[textStyle, { flexShrink: 1, minWidth: 0 }]}>
            {artistName}
          </Text>
          <Text style={textStyle}>{suffix}</Text>
        </View>
      )}
    </View>
  );
}

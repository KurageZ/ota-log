import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { ThemeColors } from '../theme/appTheme';

export function EventSectionHeader({
  title,
  count,
  colors,
  titleColor,
  pillBackgroundColor,
  pillTextColor,
  countSuffix,
  trailing,
}: {
  title: string;
  count: number;
  colors: ThemeColors;
  titleColor?: string;
  pillBackgroundColor?: string;
  pillTextColor?: string;
  countSuffix?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
      <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '800', color: titleColor ?? colors.accent }}>
        {title}
      </Text>
      <View
        style={{
          marginLeft: 6,
          borderRadius: 999,
          backgroundColor: pillBackgroundColor ?? colors.accentSoft,
          paddingHorizontal: 7,
          paddingVertical: 1,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: pillTextColor ?? colors.accent }}>
          {count}
          {countSuffix}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

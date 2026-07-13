import { Text, View } from 'react-native';
import type { ThemeColors } from '../theme/appTheme';

export function EventSectionHeader({
  title,
  count,
  colors,
}: {
  title: string;
  count: number;
  colors: ThemeColors;
}) {
  return (
    <View style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
      <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '800', color: colors.accent }}>
        {title}
      </Text>
      <View
        style={{
          marginLeft: 6,
          borderRadius: 999,
          backgroundColor: colors.accentSoft,
          paddingHorizontal: 7,
          paddingVertical: 1,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>
          {count}
        </Text>
      </View>
    </View>
  );
}

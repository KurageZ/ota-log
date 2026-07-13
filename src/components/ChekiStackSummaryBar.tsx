import { Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';

type Props = {
  title: string;
  totalCount: number;
  onPress: () => void;
  accessibilityLabel?: string;
  marginBottom?: number;
};

export function ChekiStackSummaryBar({
  title,
  totalCount,
  onPress,
  accessibilityLabel,
  marginBottom = 8,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}，${totalCount}张拍立得，收起`}
      style={{
        minHeight: 44,
        marginBottom,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.card,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, fontWeight: '800', color: colors.heading }}>
        {title}
      </Text>
      <View style={{
        borderRadius: 99,
        paddingHorizontal: 7,
        paddingVertical: 2,
        backgroundColor: colors.accentSofter,
      }}>
        <Text style={{ fontSize: 10.5, lineHeight: 14, fontWeight: '900', color: colors.accent }}>
          {totalCount}张
        </Text>
      </View>
      <AppIcon name="chevron" variant="up" size={15} color={colors.accent} />
    </TouchableOpacity>
  );
}

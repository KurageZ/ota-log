import { Text, TouchableOpacity, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';

interface FilteredEmptyStateProps {
  title: string;
  message?: string;
  onClear: () => void;
  isDark: boolean;
  paddingTop?: number;
}

export function FilteredEmptyState({
  title,
  message = '换个搜索或筛选条件试试',
  onClear,
  paddingTop = 60,
}: FilteredEmptyStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={{ alignItems: 'center', paddingTop, paddingHorizontal: 24 }}>
      <AppIcon name="emptySearch" size={38} color={colors.textMuted} style={{ marginBottom: 12 }} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 }}>
        {message}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="清除全部筛选条件"
        onPress={onClear}
        activeOpacity={0.76}
        style={{
          marginTop: 18,
          minHeight: 38,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.accentBorder,
          backgroundColor: colors.accentSofter,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <AppIcon name="clearFilters" size={16} color={colors.accent} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>清除筛选</Text>
      </TouchableOpacity>
    </View>
  );
}

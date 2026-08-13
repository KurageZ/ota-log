import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { AppIcon } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';

interface ActiveFilterChip {
  id: string;
  label: string;
  onPress?: () => void;
}

interface SearchFilterBarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  placeholder?: string;
  onOpenFilter: () => void;
  buttonLabel?: string;
  activeFilters?: ActiveFilterChip[];
  showActiveFilters?: boolean;
  clearButtonBehavior?: 'native' | 'custom';
  /** 已生效的筛选条件数量，用于按钮上的红点角标 */
  activeCount: number;
  filterExpanded?: boolean;
  isDark: boolean;
}

export function SearchFilterBar({
  keyword,
  onKeywordChange,
  placeholder,
  onOpenFilter,
  buttonLabel,
  activeFilters = [],
  showActiveFilters = true,
  clearButtonBehavior = 'native',
  activeCount,
  filterExpanded = false,
  isDark,
}: SearchFilterBarProps) {
  const { colors } = useAppTheme();
  const hasActive = activeCount > 0;
  const hasButtonLabel = Boolean(buttonLabel?.trim());
  const visibleActiveFilters = showActiveFilters ? activeFilters : [];
  const hasFilterChips = visibleActiveFilters.length > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          alignContent: 'center',
          flexWrap: hasFilterChips ? 'wrap' : 'nowrap',
          gap: 8,
          backgroundColor: isDark ? colors.input : colors.cardMuted,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          paddingHorizontal: 10,
          height: hasFilterChips ? undefined : 44,
          minHeight: 44,
          paddingVertical: hasFilterChips ? 6 : 0,
        }}
      >
        <AppIcon name="search" size={16} color={colors.placeholder} />
        {visibleActiveFilters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            accessibilityRole="button"
            accessibilityLabel={`移除筛选：${filter.label}`}
            onPress={filter.onPress}
            activeOpacity={filter.onPress ? 0.72 : 1}
            style={{
              height: 26,
              maxWidth: 128,
              borderRadius: 999,
              paddingLeft: 9,
              paddingRight: filter.onPress ? 7 : 9,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: withAlpha(colors.accent, isDark ? 0.22 : 0.1),
              borderWidth: 1,
              borderColor: withAlpha(colors.accentBorder, isDark ? 0.55 : 0.65),
            }}
          >
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 11.5, fontWeight: '700', color: colors.accentText }}>
              {filter.label}
            </Text>
            {filter.onPress ? <AppIcon name="close" size={11} color={colors.accentText} /> : null}
          </TouchableOpacity>
        ))}
        <TextInput
          accessibilityLabel={placeholder ?? '搜索'}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            minWidth: hasFilterChips ? 28 : 0,
            height: hasFilterChips ? 32 : 42,
            paddingVertical: 0,
            fontSize: 14,
            lineHeight: 18,
            textAlignVertical: 'center',
            includeFontPadding: false,
            color: colors.text,
          }}
          placeholder={hasFilterChips ? undefined : placeholder}
          placeholderTextColor={colors.placeholder}
          value={keyword}
          onChangeText={onKeywordChange}
          clearButtonMode={clearButtonBehavior === 'custom' ? 'never' : 'while-editing'}
          returnKeyType="search"
          autoCorrect={false}
        />
        {clearButtonBehavior === 'custom' && keyword.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="清除搜索"
            onPress={() => onKeywordChange('')}
            activeOpacity={0.72}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 28, height: 42, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppIcon name="closeCircle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={hasActive ? `筛选，已启用 ${activeCount} 项条件` : '筛选'}
        accessibilityState={{ expanded: filterExpanded }}
        onPress={onOpenFilter}
        activeOpacity={0.78}
        style={{
          minWidth: 44,
          height: 44,
          borderRadius: 10,
          paddingHorizontal: hasButtonLabel ? 12 : 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: hasButtonLabel ? 6 : 0,
          borderWidth: 1,
          backgroundColor: hasActive ? colors.accent : isDark ? colors.input : colors.cardMuted,
          borderColor: hasActive ? colors.accent : colors.inputBorder,
        }}
      >
        <AppIcon name="filter" size={20} color={hasActive ? colors.onAccent : colors.textSecondary} />
        {hasButtonLabel ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: hasActive ? colors.onAccent : colors.textSecondary }}>
            {buttonLabel}
          </Text>
        ) : null}
        {hasActive ? (
          <View
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 4,
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.onAccent }}>{activeCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

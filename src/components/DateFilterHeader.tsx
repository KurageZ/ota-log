import { Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme/appTheme';
import { formatDateFilter, type DateFilter, type DateFilterMode } from '../utils/dateFilters';

const DATE_FILTER_MODES: Array<{ mode: DateFilterMode; label: string }> = [
  { mode: 'day', label: '日' },
  { mode: 'month', label: '月' },
  { mode: 'year', label: '年' },
  { mode: 'custom', label: '自定义' },
];

interface Props {
  value: DateFilter;
  onSelectMode: (mode: DateFilterMode) => void;
}

export function DateFilterHeader({ value, onSelectMode }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ marginBottom: 10, fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>日期</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {DATE_FILTER_MODES.map(({ mode, label }) => {
          const selected = value?.mode === mode;
          return (
            <TouchableOpacity
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={`按${label}筛选日期`}
              accessibilityState={{ selected }}
              onPress={() => onSelectMode(mode)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.accent : colors.cardAlt,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? colors.onAccent : colors.text }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {value ? (
        <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
          {formatDateFilter(value)}
        </Text>
      ) : null}
    </View>
  );
}

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
          let buttonLines = [label];
          if (selected && value) {
            const [year, month, day] = value.startDate.split('-');
            switch (mode) {
              case 'day':
                buttonLines = [`${year} 年`, `${Number(month)} 月 ${Number(day)} 日`];
                break;
              case 'month':
                buttonLines = [`${year} 年`, `${Number(month)} 月`];
                break;
              case 'year':
                buttonLines = [`${year} 年`];
                break;
              case 'custom':
                buttonLines = [label, '已选范围'];
                break;
            }
          }
          return (
            <TouchableOpacity
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={`按${label}筛选日期${selected ? `，已选择 ${formatDateFilter(value)}` : ''}`}
              accessibilityState={{ selected }}
              onPress={() => onSelectMode(mode)}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                paddingHorizontal: 4,
                paddingVertical: 4,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.accent : colors.cardAlt,
              }}
            >
              {buttonLines.map((line, index) => (
                <Text
                  key={index}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={{ width: '100%', textAlign: 'center', fontSize: 12, lineHeight: 17, fontWeight: '700', color: selected ? colors.onAccent : colors.text }}
                >
                  {line}
                </Text>
              ))}
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

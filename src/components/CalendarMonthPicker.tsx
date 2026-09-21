import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';
import { BottomSheetDialog } from './BottomSheetDialog';

interface Props {
  visible: boolean;
  selectedMonth: string;
  onClose: () => void;
  onSelect: (year: number, month: number) => void;
}

/**
 * Month picker used by the calendar month view. Shares the same visual
 * language as the stats page month picker: year navigation on top and a
 * 12-month grid below.
 */
export function CalendarMonthPicker({ visible, selectedMonth, onClose, onSelect }: Props) {
  const { colors } = useAppTheme();
  const [selectedYear, selectedMonthNumber] = selectedMonth.split('-').map(Number);
  const [visibleYear, setVisibleYear] = useState(selectedYear);

  useEffect(() => {
    if (!visible) return;
    const [year] = selectedMonth.split('-').map(Number);
    setVisibleYear(year);
  }, [selectedMonth, visible]);

  return (
    <BottomSheetDialog
      visible={visible}
      title="选择月份"
      onClose={onClose}
      maxHeightRatio={0.72}
    >
      <View
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="上一年"
          onPress={() => setVisibleYear((year) => year - 1)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppIcon name="chevron" variant="back" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '800',
            color: colors.heading,
            fontVariant: ['tabular-nums'],
          }}
        >
          {visibleYear} 年
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="下一年"
          onPress={() => setVisibleYear((year) => year + 1)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppIcon name="chevron" variant="forward" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
          const selected = selectedYear === visibleYear && selectedMonthNumber === month;
          return (
            <TouchableOpacity
              key={month}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${visibleYear} 年 ${month} 月`}
              onPress={() => onSelect(visibleYear, month)}
              activeOpacity={0.72}
              style={{
                width: '22%',
                flexGrow: 1,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: selected ? colors.accent : colors.cardAlt,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: selected ? '800' : '600',
                  color: selected ? colors.onAccent : colors.text,
                }}
              >
                {month} 月
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheetDialog>
  );
}

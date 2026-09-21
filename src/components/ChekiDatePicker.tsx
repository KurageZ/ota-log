import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { BottomSheetDialog, BottomSheetAction } from './BottomSheetDialog';
import { StatsDateRangePicker } from './StatsDateRangePicker';
import { AppIcon } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';
import { toISODate } from '../utils/date';
import type { DateFilter, DateFilterMode } from '../utils/dateFilters';

export type ChekiDatePickerMode = DateFilterMode;

interface Props {
  visible: boolean;
  mode: ChekiDatePickerMode;
  value: DateFilter;
  onCancel: () => void;
  onConfirm: (value: DateFilter) => void;
  onClear: () => void;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function ChekiDatePicker({ visible, mode, value, onCancel, onConfirm, onClear }: Props) {
  const { colors } = useAppTheme();
  const today = toISODate(new Date());
  const initial = value?.startDate ?? today;
  const [selectedDay, setSelectedDay] = useState(initial);
  const [visibleYear, setVisibleYear] = useState(Number(initial.slice(0, 4)));
  const [selectedMonth, setSelectedMonth] = useState(Number(initial.slice(5, 7)));
  const [yearPageStart, setYearPageStart] = useState(Math.floor(Number(initial.slice(0, 4)) / 12) * 12);

  useEffect(() => {
    if (!visible) return;
    const next = value?.startDate ?? today;
    setSelectedDay(next);
    setVisibleYear(Number(next.slice(0, 4)));
    setSelectedMonth(Number(next.slice(5, 7)));
    setYearPageStart(Math.floor(Number(next.slice(0, 4)) / 12) * 12);
  }, [today, value, visible]);

  if (mode === 'custom') {
    return (
      <StatsDateRangePicker
        visible={visible}
        confirmLabel="完成"
        initialStartDate={value?.startDate ?? null}
        initialEndDate={value?.endDate ?? null}
        onCancel={onCancel}
        onSelectAll={onClear}
        onConfirm={(startDate, endDate) => onConfirm({ mode, startDate, endDate })}
      />
    );
  }

  const confirm = () => {
    if (mode === 'day') onConfirm({ mode, startDate: selectedDay, endDate: selectedDay });
    if (mode === 'month') {
      const prefix = `${visibleYear}-${String(selectedMonth).padStart(2, '0')}`;
      onConfirm({ mode, startDate: `${prefix}-01`, endDate: `${prefix}-${daysInMonth(visibleYear, selectedMonth)}` });
    }
    if (mode === 'year') {
      onConfirm({ mode, startDate: `${visibleYear}-01-01`, endDate: `${visibleYear}-12-31` });
    }
  };

  return (
    <BottomSheetDialog
      visible={visible}
      title={mode === 'day' ? '选择日期' : mode === 'month' ? '选择月份' : '选择年份'}
      onClose={onCancel}
      maxHeightRatio={0.72}
      headerAccessory={(
        <TouchableOpacity onPress={onClear} style={{ minWidth: 80, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent }}>全部时间</Text>
        </TouchableOpacity>
      )}
      footer={<BottomSheetAction label="完成" accessibilityLabel="完成日期选择" onPress={confirm} />}
    >
      {mode === 'day' ? (
        <Calendar
          current={selectedDay}
          markedDates={{ [selectedDay]: { selected: true, selectedColor: colors.accent } }}
          onDayPress={(day: DateData) => setSelectedDay(day.dateString)}
          enableSwipeMonths
          theme={{
            calendarBackground: colors.screen,
            textSectionTitleColor: colors.textSecondary,
            dayTextColor: colors.text,
            monthTextColor: colors.heading,
            textDisabledColor: colors.textMuted,
            todayTextColor: colors.accent,
            selectedDayBackgroundColor: colors.accent,
            selectedDayTextColor: colors.onAccent,
            arrowColor: colors.accent,
          }}
        />
      ) : (
        <>
          <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <TouchableOpacity onPress={() => mode === 'month' ? setVisibleYear((year) => year - 1) : setYearPageStart((year) => year - 12)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name="chevron" variant="back" size={20} color={colors.accent} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.heading }}>
              {mode === 'month' ? `${visibleYear} 年` : `${yearPageStart} – ${yearPageStart + 11}`}
            </Text>
            <TouchableOpacity onPress={() => mode === 'month' ? setVisibleYear((year) => year + 1) : setYearPageStart((year) => year + 12)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name="chevron" variant="forward" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: 12 }, (_, index) => mode === 'month' ? index + 1 : yearPageStart + index).map((option) => {
              const selected = mode === 'month' ? option === selectedMonth : option === visibleYear;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => mode === 'month' ? setSelectedMonth(option) : setVisibleYear(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{ width: '22%', flexGrow: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.cardAlt }}
                >
                  <Text style={{ fontSize: 15, fontWeight: selected ? '800' : '600', color: selected ? colors.onAccent : colors.text }}>{mode === 'month' ? `${option} 月` : option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </BottomSheetDialog>
  );
}

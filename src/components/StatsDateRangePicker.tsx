import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Calendar, LocaleConfig, type DateData } from 'react-native-calendars';
import { useAppTheme } from '../theme/appTheme';
import {
  createCustomStatsRange,
  getStatsRangeDaysForMonth,
  getSystemFirstDayOfWeek,
} from '../utils/statsDateRange';
import {
  formatDateInput,
  isValidISODate,
  normalizeDateInput,
  toISODate,
} from '../utils/date';
import { BottomSheetDialog } from './BottomSheetDialog';

LocaleConfig.locales['zh-cn'] = {
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  today: '今天',
};
LocaleConfig.defaultLocale = 'zh-cn';

interface Props {
  visible: boolean;
  initialStartDate: string | null;
  initialEndDate: string | null;
  onCancel: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
  onSelectAll: () => void;
}

function buildMarkedDates(
  startDate: string,
  endDate: string,
  visibleMonth: string,
  accent: string,
  onAccent: string,
) {
  if (!isValidISODate(startDate)) return {};
  if (!isValidISODate(endDate)) {
    if (!startDate.startsWith(`${visibleMonth}-`)) return {};
    return { [startDate]: { startingDay: true, endingDay: true, color: accent, textColor: onAccent } };
  }

  const marked: Record<string, { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string }> = {};
  for (const day of getStatsRangeDaysForMonth(startDate, endDate, visibleMonth)) {
    marked[day.date] = {
      startingDay: day.isRangeStart,
      endingDay: day.isRangeEnd,
      color: accent,
      textColor: onAccent,
    };
  }
  return marked;
}

export function StatsDateRangePicker({
  visible,
  initialStartDate,
  initialEndDate,
  onCancel,
  onConfirm,
  onSelectAll,
}: Props) {
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const stackDateInputs = fontScale > 1.3;
  const today = toISODate(new Date());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7));

  useEffect(() => {
    if (!visible) return;
    setStartDate(initialStartDate ?? '');
    setEndDate(initialEndDate ?? '');
    setVisibleMonth((initialStartDate ?? today).slice(0, 7));
  }, [initialEndDate, initialStartDate, today, visible]);

  const markedDates = useMemo(
    () => buildMarkedDates(startDate, endDate, visibleMonth, colors.accent, colors.onAccent),
    [colors.accent, colors.onAccent, endDate, startDate, visibleMonth],
  );

  const validRange = useMemo(
    () => createCustomStatsRange(startDate, endDate),
    [endDate, startDate],
  );
  const hasInvalidDate = (startDate.length > 0 && !isValidISODate(startDate))
    || (endDate.length > 0 && !isValidISODate(endDate));
  const rangeReversed = isValidISODate(startDate) && isValidISODate(endDate) && startDate > endDate;

  const handleDayPress = (day: DateData) => {
    const selected = day.dateString;
    if (!isValidISODate(startDate) || isValidISODate(endDate) || selected < startDate) {
      setStartDate(selected);
      setEndDate('');
      return;
    }
    setEndDate(selected);
  };

  const canConfirm = validRange != null;
  return (
    <BottomSheetDialog
      visible={visible}
      title="选择日期范围"
      onClose={onCancel}
      scrollable
      snapPoints={['66%']}
      showCloseButton={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
      headerAccessory={(
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="统计全部时间"
          onPress={onSelectAll}
          activeOpacity={0.7}
          style={{ minWidth: 80, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent }}>全部时间</Text>
        </TouchableOpacity>
      )}
    >
      <View style={{ flexDirection: stackDateInputs ? 'column' : 'row', gap: 10, marginBottom: 10 }}>
        {[
          {
            label: '开始日期',
            value: startDate,
            onChangeText: (text: string) => setStartDate((previous) => formatDateInput(text, previous)),
            onBlur: () => setStartDate((current) => normalizeDateInput(current)),
          },
          {
            label: '结束日期',
            value: endDate,
            onChangeText: (text: string) => setEndDate((previous) => formatDateInput(text, previous)),
            onBlur: () => setEndDate((current) => normalizeDateInput(current)),
          },
        ].map((field) => (
          <View key={field.label} style={{ flex: stackDateInputs ? undefined : 1, minWidth: 0 }}>
            <Text style={{ marginBottom: 5, fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              {field.label}
            </Text>
            <BottomSheetTextInput
              accessibilityLabel={`${field.label}，格式为年-月-日`}
              value={field.value}
              onChangeText={field.onChangeText}
              onBlur={field.onBlur}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.placeholder}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
              style={{
                minHeight: 44,
                borderWidth: 1,
                borderColor: (hasInvalidDate || rangeReversed) ? colors.danger : colors.inputBorder,
                borderRadius: 11,
                paddingHorizontal: 10,
                fontSize: 14,
                color: colors.text,
                backgroundColor: colors.input,
                fontVariant: ['tabular-nums'],
              }}
            />
          </View>
        ))}
      </View>
      {hasInvalidDate || rangeReversed ? (
        <Text accessibilityRole="alert" style={{ marginBottom: 8, fontSize: 12, lineHeight: 17, color: colors.danger }}>
          {rangeReversed ? '结束日期不能早于开始日期。' : '请输入有效日期。'}
        </Text>
      ) : null}
      <Calendar
        key={`${visible}-${initialStartDate ?? 'today'}`}
        current={initialStartDate ?? today}
        markingType="period"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        onMonthChange={(month) => setVisibleMonth(month.dateString.slice(0, 7))}
        firstDay={getSystemFirstDayOfWeek()}
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
          textDayFontWeight: '500',
          textMonthFontWeight: '800',
          textDayHeaderFontWeight: '600',
        }}
        accessibilityLabel="日期范围选择器"
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="应用日期范围"
        disabled={!canConfirm}
        onPress={() => {
          if (validRange) onConfirm(validRange.startDate!, validRange.endDate!);
        }}
        activeOpacity={0.72}
        style={{
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 10,
          borderRadius: 12,
          backgroundColor: colors.accent,
          opacity: canConfirm ? 1 : 0.4,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.onAccent }}>应用</Text>
      </TouchableOpacity>
    </BottomSheetDialog>
  );
}

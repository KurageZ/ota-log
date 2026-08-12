import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig, type DateData } from 'react-native-calendars';
import { useAppTheme } from '../theme/appTheme';
import { createStatsRangeForDate, getSystemFirstDayOfWeek, type StatsDateRange } from '../utils/statsDateRange';
import { BottomSheetDialog } from './BottomSheetDialog';
import { AppIcon } from './AppIcon';

LocaleConfig.locales['zh-cn'] = {
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  today: '今天',
};
LocaleConfig.defaultLocale = 'zh-cn';

type Preset = 'week' | 'month' | 'year';

interface Props {
  visible: boolean;
  preset: Preset;
  period: StatsDateRange;
  onClose: () => void;
  onSelect: (range: StatsDateRange) => void;
}

function dateFromISO(isoDate: string | null): Date {
  if (!isoDate) return new Date();
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addOneDay(isoDate: string): string {
  const next = dateFromISO(isoDate);
  next.setDate(next.getDate() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function buildWeekMarks(period: StatsDateRange, accent: string, onAccent: string) {
  if (!period.startDate || !period.endDate) return {};
  const marked: Record<string, { startingDay: boolean; endingDay: boolean; color: string; textColor: string }> = {};
  for (let date = period.startDate; date <= period.endDate; date = addOneDay(date)) {
    marked[date] = {
      startingDay: date === period.startDate,
      endingDay: date === period.endDate,
      color: accent,
      textColor: onAccent,
    };
  }
  return marked;
}

function titleForPreset(preset: Preset): string {
  if (preset === 'week') return '选择周';
  if (preset === 'month') return '选择月份';
  return '选择年份';
}

export function StatsPeriodPicker({ visible, preset, period, onClose, onSelect }: Props) {
  const { colors } = useAppTheme();
  const selectedDate = dateFromISO(period.startDate);
  const [visibleYear, setVisibleYear] = useState(selectedDate.getFullYear());
  const [yearPageStart, setYearPageStart] = useState(Math.floor(selectedDate.getFullYear() / 12) * 12);

  useEffect(() => {
    if (!visible) return;
    const nextSelectedDate = dateFromISO(period.startDate);
    setVisibleYear(nextSelectedDate.getFullYear());
    setYearPageStart(Math.floor(nextSelectedDate.getFullYear() / 12) * 12);
  }, [period.startDate, visible]);

  const weekMarks = useMemo(
    () => buildWeekMarks(period, colors.accent, colors.onAccent),
    [colors.accent, colors.onAccent, period],
  );

  const selectDate = (nextPreset: Preset, date: Date) => {
    onSelect(createStatsRangeForDate(nextPreset, date));
  };

  return (
    <BottomSheetDialog
      visible={visible}
      title={titleForPreset(preset)}
      onClose={onClose}
      maxHeightRatio={0.72}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
    >
      {preset === 'week' ? (
        <Calendar
          key={period.startDate ?? 'current-week'}
          current={period.startDate ?? undefined}
          markingType="period"
          markedDates={weekMarks}
          onDayPress={(day: DateData) => selectDate('week', dateFromISO(day.dateString))}
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
          accessibilityLabel="周选择日历，轻点任意日期选择其所在周"
        />
      ) : null}

      {preset === 'month' ? (
        <>
          <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="上一年"
              onPress={() => setVisibleYear((year) => year - 1)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="chevron" variant="back" size={20} color={colors.accent} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.heading, fontVariant: ['tabular-nums'] }}>
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
              const selected = selectedDate.getFullYear() === visibleYear && selectedDate.getMonth() + 1 === month;
              return (
                <TouchableOpacity
                  key={month}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${visibleYear} 年 ${month} 月`}
                  onPress={() => selectDate('month', new Date(visibleYear, month - 1, 1))}
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
                  <Text style={{ fontSize: 15, fontWeight: selected ? '800' : '600', color: selected ? colors.onAccent : colors.text }}>
                    {month} 月
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {preset === 'year' ? (
        <>
          <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="上一组年份"
              onPress={() => setYearPageStart((year) => year - 12)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="chevron" variant="back" size={20} color={colors.accent} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.heading, fontVariant: ['tabular-nums'] }}>
              {yearPageStart} – {yearPageStart + 11}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="下一组年份"
              onPress={() => setYearPageStart((year) => year + 12)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="chevron" variant="forward" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: 12 }, (_, index) => yearPageStart + index).map((year) => {
              const selected = selectedDate.getFullYear() === year;
              return (
                <TouchableOpacity
                  key={year}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${year} 年`}
                  onPress={() => selectDate('year', new Date(year, 0, 1))}
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
                  <Text style={{ fontSize: 15, fontWeight: selected ? '800' : '600', color: selected ? colors.onAccent : colors.text, fontVariant: ['tabular-nums'] }}>
                    {year}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}
    </BottomSheetDialog>
  );
}

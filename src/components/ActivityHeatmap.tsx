import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ContributionGraph } from 'react-native-chart-kit/v2';
import type { ThemeColors } from '../theme/appTheme';

export type ActivityHeatmapValue = {
  date: string;
  count: number;
};

const CELL_SIZE = 9;
const GUTTER_SIZE = 3;
const CHART_WIDTH = 680;
const CHART_HEIGHT = 108;
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function getDaysInYear(year: number): number {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function formatLocalISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function LegendItem({ color, label, colors }: { color: string; label: string; colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 11, lineHeight: 15, fontWeight: '600', color: colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

export function ActivityHeatmap({
  year,
  values,
  colors,
}: {
  year: number;
  values: ActivityHeatmapValue[];
  colors: ThemeColors;
}) {
  const [selectedDay, setSelectedDay] = useState<ActivityHeatmapValue | null>(null);

  useEffect(() => {
    setSelectedDay(null);
  }, [year]);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '800', color: colors.text }}>
          {year} 年
        </Text>
        <Text style={{ flexShrink: 1, fontSize: 11, lineHeight: 15, color: colors.textMuted, textAlign: 'right' }}>
          已完成活动，左右滑动查看
        </Text>
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 6 }}
      >
        <ContributionGraph
          values={values}
          endDate={`${year}-12-31`}
          numDays={getDaysInYear(year)}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          cellSize={CELL_SIZE}
          gutterSize={GUTTER_SIZE}
          weekStartsOn={1}
          theme={{
            background: colors.card,
            plotBackground: colors.card,
            grid: colors.cardAlt,
            axis: colors.divider,
            text: colors.text,
            mutedText: colors.textSecondary,
            series: [colors.accent],
          }}
          emptyColor={colors.cardAlt}
          colorForValue={({ cell }) => {
            if (!cell.defined || cell.value == null || cell.value <= 0) return colors.cardAlt;
            if (cell.value === 1) return colors.accentBorder;
            if (cell.value === 2) return colors.accent;
            return colors.accentStrong;
          }}
          activeCell={selectedDay ? {
            date: selectedDay.date,
            scale: 1.45,
            strokeColor: colors.heading,
            strokeWidth: 1.5,
          } : false}
          getMonthLabel={(monthIndex) => `${monthIndex + 1}月`}
          getWeekdayLabel={(dayIndex) => WEEKDAY_LABELS[dayIndex] ?? ''}
          onDayPress={(event) => {
            setSelectedDay({
              date: formatLocalISODate(event.date),
              count: Math.max(0, event.value ?? 0),
            });
          }}
          accessibilityLabel={`${year} 年已完成活动热力图，共 ${values.reduce((total, value) => total + value.count, 0)} 场`}
          testID="activity-heatmap"
        />
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 12,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <LegendItem color={colors.cardAlt} label="0" colors={colors} />
          <LegendItem color={colors.accentBorder} label="1" colors={colors} />
          <LegendItem color={colors.accent} label="2" colors={colors} />
          <LegendItem color={colors.accentStrong} label="3+" colors={colors} />
        </View>
        <Text
          numberOfLines={1}
          style={{ flexShrink: 1, fontSize: 11, lineHeight: 15, fontWeight: '700', color: colors.textSecondary, textAlign: 'right' }}
        >
          {selectedDay
            ? `${Number(selectedDay.date.slice(5, 7))}月${Number(selectedDay.date.slice(8, 10))}日 · ${selectedDay.count} 场`
            : '轻点格子查看'}
        </Text>
      </View>
    </View>
  );
}

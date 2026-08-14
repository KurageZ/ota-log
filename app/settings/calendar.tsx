import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { MenuCard, MenuRowSeparator, SectionLabel, SettingsChoiceCard } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';
import { AppCalendarWeekStart, APP_CALENDAR_WEEK_START_LABELS } from '../../src/theme/config';
import { withAlpha } from '../../src/utils/color';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const CALENDAR_WEEK_START_OPTIONS: AppCalendarWeekStart[] = ['sunday', 'monday'];

type CalendarDisplayKey = 'calendarShowChekiPhotos' | 'calendarShowEvents' | 'calendarShowDateItems';

export default function CalendarSettingsScreen() {
  const {
    colors,
    calendarWeekStart,
    setCalendarWeekStart,
    calendarDisplay,
    setCalendarDisplay,
  } = useAppTheme();
  const [pendingCalendarWeekStart, setPendingCalendarWeekStart] = useState<AppCalendarWeekStart | null>(null);
  const [pendingDisplayKey, setPendingDisplayKey] = useState<CalendarDisplayKey | null>(null);

  const displayRows: { key: CalendarDisplayKey; label: string; value: boolean; onChange: (value: boolean) => Promise<void> }[] = [
    {
      key: 'calendarShowChekiPhotos',
      label: '展示拍立得图片',
      value: calendarDisplay.showChekiPhotos,
      onChange: (value) => setCalendarDisplay({ ...calendarDisplay, showChekiPhotos: value }),
    },
    {
      key: 'calendarShowEvents',
      label: '展示活动信息',
      value: calendarDisplay.showEvents,
      onChange: (value) => setCalendarDisplay({ ...calendarDisplay, showEvents: value }),
    },
    {
      key: 'calendarShowDateItems',
      label: '展示重要日期',
      value: calendarDisplay.showDateItems,
      onChange: (value) => setCalendarDisplay({ ...calendarDisplay, showDateItems: value }),
    },
  ];

  const handleSelectCalendarWeekStart = async (nextWeekStart: AppCalendarWeekStart) => {
    if (nextWeekStart === calendarWeekStart || pendingCalendarWeekStart) return;

    setPendingCalendarWeekStart(nextWeekStart);
    try {
      await setCalendarWeekStart(nextWeekStart);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存日历周起始日。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingCalendarWeekStart(null);
    }
  };

  const handleToggleDisplay = async (key: CalendarDisplayKey, nextValue: boolean) => {
    if (pendingDisplayKey) return;

    setPendingDisplayKey(key);
    try {
      const row = displayRows.find((item) => item.key === key);
      if (row) await row.onChange(nextValue);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存日历展示设置。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingDisplayKey(null);
    }
  };

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '日历' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <SectionLabel label="日历周起始日" />
        <SettingsChoiceCard
          options={CALENDAR_WEEK_START_OPTIONS}
          value={pendingCalendarWeekStart ?? calendarWeekStart}
          pending={pendingCalendarWeekStart}
          labelOf={(option) => APP_CALENDAR_WEEK_START_LABELS[option]}
          onSelect={handleSelectCalendarWeekStart}
        />

        <View style={{ height: 16 }} />

        <SectionLabel label="月视图展示" />
        <MenuCard>
          {displayRows.map((row, index) => (
            <View key={row.key}>
              <View
                style={{
                  minHeight: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  opacity: pendingDisplayKey ? 0.7 : 1,
                }}
              >
                <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' }}>
                  {row.label}
                </Text>
                <Switch
                  value={row.value}
                  disabled={pendingDisplayKey !== null}
                  onValueChange={(value) => handleToggleDisplay(row.key, value)}
                  trackColor={{ false: colors.inputBorder, true: withAlpha(colors.accent, 0.38) }}
                  thumbColor={row.value ? colors.accent : colors.card}
                  accessibilityLabel={row.label}
                />
              </View>
              {index < displayRows.length - 1 ? <MenuRowSeparator /> : null}
            </View>
          ))}
        </MenuCard>
      </ScrollView>
    </SafeAreaView>
  );
}

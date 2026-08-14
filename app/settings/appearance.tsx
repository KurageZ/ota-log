import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { SectionLabel, SettingsChoiceCard } from '../../src/components/SettingsMenu';
import { appThemes, useAppTheme } from '../../src/theme/appTheme';
import { AppAppearance, AppThemeId, APP_APPEARANCE_LABELS, APP_THEME_LABELS } from '../../src/theme/config';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const APPEARANCE_OPTIONS: AppAppearance[] = ['system', 'light', 'dark'];
const APPEARANCE_DESCRIPTIONS: Record<AppAppearance, string> = {
  system: '跟随设备的浅色或深色外观',
  light: '始终使用浅色外观',
  dark: '始终使用深色外观',
};
const THEME_OPTIONS: AppThemeId[] = ['monoChrome', 'classicViolet', 'nightNeon'];
const THEME_SWATCH_COLORS: Record<AppThemeId, string> = {
  monoChrome: appThemes.monoChrome.light.accent,
  classicViolet: appThemes.classicViolet.light.accent,
  nightNeon: appThemes.nightNeon.light.accent,
};
const THEME_DESCRIPTIONS: Record<AppThemeId, string> = {
  monoChrome: '低色彩背景，配合多彩入口图标',
  classicViolet: '品牌紫色主题',
  nightNeon: '更强情绪色的粉色主题',
};

export default function AppearanceSettingsScreen() {
  const { colors, appearance, setAppearance, themeId, setThemeId } = useAppTheme();
  const [pendingAppearance, setPendingAppearance] = useState<AppAppearance | null>(null);
  const [pendingTheme, setPendingTheme] = useState<AppThemeId | null>(null);

  const handleSelectAppearance = async (next: AppAppearance) => {
    if (next === appearance || pendingAppearance) return;

    setPendingAppearance(next);
    try {
      await setAppearance(next);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存显示模式。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingAppearance(null);
    }
  };

  const handleSelectTheme = async (next: AppThemeId) => {
    if (next === themeId || pendingTheme) return;

    setPendingTheme(next);
    try {
      await setThemeId(next);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存主题色。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingTheme(null);
    }
  };

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '外观' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <SectionLabel label="显示模式" />
        <SettingsChoiceCard
          options={APPEARANCE_OPTIONS}
          value={appearance}
          pending={pendingAppearance}
          labelOf={(option) => APP_APPEARANCE_LABELS[option]}
          descriptionOf={(option) => APPEARANCE_DESCRIPTIONS[option]}
          onSelect={handleSelectAppearance}
        />

        <View style={{ height: 16 }} />

        <SectionLabel label="主题色" />
        <SettingsChoiceCard
          options={THEME_OPTIONS}
          value={themeId}
          pending={pendingTheme}
          labelOf={(option) => APP_THEME_LABELS[option]}
          descriptionOf={(option) => THEME_DESCRIPTIONS[option]}
          leadingColorOf={(option) => THEME_SWATCH_COLORS[option]}
          onSelect={handleSelectTheme}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

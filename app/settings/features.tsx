import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { SectionLabel, SettingsChoiceCard } from '../../src/components/SettingsMenu';
import { useDB } from '../../src/context/DBContext';
import { useAppTheme } from '../../src/theme/appTheme';
import { UserConfig, ArtistConfirmationMode } from '../../src/types/models';
import {
  CHEKI_BROWSE_MODE_LABELS,
  type ChekiBrowseMode,
  type ChekiViewPreferences,
  loadChekiViewPreferences,
  saveChekiViewPreferences,
} from '../../src/utils/chekiViewPreferences';
import {
  DEFAULT_STATS_PERIOD_PRESET,
  STATS_DEFAULT_PERIOD_LABELS,
  type StatsDefaultPeriodPreset,
  type StatsPreferences,
  loadStatsPreferences,
  saveStatsPreferences,
} from '../../src/utils/statsPreferences';
import {
  ARTIST_CONFIRMATION_MODE_DESCRIPTIONS,
  ARTIST_CONFIRMATION_MODE_LABELS,
  DEFAULT_ARTIST_CONFIRMATION_MODE,
} from '../../src/utils/artistConfirmation';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const CHEKI_DEFAULT_VIEW_OPTIONS: ChekiBrowseMode[] = ['album', 'record'];
const STATS_DEFAULT_PERIOD_OPTIONS: StatsDefaultPeriodPreset[] = ['week', 'month', 'year'];
const ARTIST_CONFIRMATION_OPTIONS: ArtistConfirmationMode[] = ['always', 'matches_only', 'never'];

export default function FeatureSettingsScreen() {
  const { colors } = useAppTheme();
  const db = useDB();

  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [chekiViewPreferences, setChekiViewPreferences] = useState<ChekiViewPreferences | null>(null);
  const [statsPreferences, setStatsPreferences] = useState<StatsPreferences | null>(null);
  const [pendingChekiDefaultView, setPendingChekiDefaultView] = useState<ChekiBrowseMode | null>(null);
  const [pendingStatsDefaultPeriod, setPendingStatsDefaultPeriod] = useState<StatsDefaultPeriodPreset | null>(null);
  const [pendingArtistConfirmationMode, setPendingArtistConfirmationMode] = useState<ArtistConfirmationMode | null>(null);

  const reloadContext = useCallback(async () => {
    const [config, chekiPreferences, statsPrefs] = await Promise.all([
      db.userConfig.getConfig(),
      loadChekiViewPreferences(),
      loadStatsPreferences(),
    ]);
    setUserConfig(config);
    setChekiViewPreferences(chekiPreferences);
    setStatsPreferences(statsPrefs);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reloadContext();
    }, [reloadContext]),
  );

  const handleSelectChekiDefaultView = async (nextView: ChekiBrowseMode) => {
    if (!chekiViewPreferences || nextView === chekiViewPreferences.defaultBrowseMode || pendingChekiDefaultView) return;

    setPendingChekiDefaultView(nextView);
    try {
      const nextPreferences = { ...chekiViewPreferences, defaultBrowseMode: nextView };
      await saveChekiViewPreferences(nextPreferences);
      setChekiViewPreferences(nextPreferences);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存切册默认视图。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingChekiDefaultView(null);
    }
  };

  const handleSelectStatsDefaultPeriod = async (nextPreset: StatsDefaultPeriodPreset) => {
    if (!statsPreferences || nextPreset === statsPreferences.defaultPeriodPreset || pendingStatsDefaultPeriod) return;

    setPendingStatsDefaultPeriod(nextPreset);
    try {
      const nextPreferences = { ...statsPreferences, defaultPeriodPreset: nextPreset };
      await saveStatsPreferences(nextPreferences);
      setStatsPreferences(nextPreferences);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存统计默认视图。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingStatsDefaultPeriod(null);
    }
  };

  const handleSelectArtistConfirmationMode = async (nextMode: ArtistConfirmationMode) => {
    const currentMode = userConfig?.artist_confirmation_mode ?? DEFAULT_ARTIST_CONFIRMATION_MODE;
    if (nextMode === currentMode || pendingArtistConfirmationMode) return;

    setPendingArtistConfirmationMode(nextMode);
    try {
      await db.userConfig.updateConfig({ artist_confirmation_mode: nextMode });
      setUserConfig((current) => current ? { ...current, artist_confirmation_mode: nextMode } : current);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存出演者确认设置。',
        '请稍后再试一次。',
        error,
      );
    } finally {
      setPendingArtistConfirmationMode(null);
    }
  };

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '功能' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <SectionLabel label="切册默认视图" />
        <SettingsChoiceCard
          options={CHEKI_DEFAULT_VIEW_OPTIONS}
          value={pendingChekiDefaultView ?? chekiViewPreferences?.defaultBrowseMode ?? 'album'}
          pending={pendingChekiDefaultView}
          labelOf={(option) => CHEKI_BROWSE_MODE_LABELS[option]}
          onSelect={handleSelectChekiDefaultView}
        />

        <View style={{ height: 16 }} />

        <SectionLabel label="统计默认视图" />
        <SettingsChoiceCard
          options={STATS_DEFAULT_PERIOD_OPTIONS}
          value={pendingStatsDefaultPeriod ?? statsPreferences?.defaultPeriodPreset ?? DEFAULT_STATS_PERIOD_PRESET}
          pending={pendingStatsDefaultPeriod}
          labelOf={(option) => STATS_DEFAULT_PERIOD_LABELS[option]}
          onSelect={handleSelectStatsDefaultPeriod}
        />

        <View style={{ height: 16 }} />

        <SectionLabel label="出演者确认" />
        <SettingsChoiceCard
          options={ARTIST_CONFIRMATION_OPTIONS}
          value={pendingArtistConfirmationMode ?? userConfig?.artist_confirmation_mode ?? DEFAULT_ARTIST_CONFIRMATION_MODE}
          pending={pendingArtistConfirmationMode}
          labelOf={(option) => ARTIST_CONFIRMATION_MODE_LABELS[option]}
          descriptionOf={(option) => ARTIST_CONFIRMATION_MODE_DESCRIPTIONS[option]}
          onSelect={handleSelectArtistConfirmationMode}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

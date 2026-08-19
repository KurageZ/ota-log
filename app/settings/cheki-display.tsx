import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { SectionLabel, SettingsChoiceCard } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';
import {
  CHEKI_DISPLAY_MODE_LABELS,
  type ChekiDisplayMode,
} from '../../src/theme/config';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const CHEKI_DISPLAY_MODE_OPTIONS: ChekiDisplayMode[] = ['portrait', 'original'];

const CHEKI_DISPLAY_MODE_DESCRIPTIONS: Record<ChekiDisplayMode, string> = {
  portrait: '图片按三寸竖版拍立得比例显示。',
  original: '图片按自身原始比例完整显示。',
};

export default function ChekiDisplaySettingsScreen() {
  const { colors, chekiDisplayMode, setChekiDisplayMode } = useAppTheme();
  const [pendingMode, setPendingMode] = useState<ChekiDisplayMode | null>(null);

  const handleSelectMode = async (nextMode: ChekiDisplayMode) => {
    if (nextMode === chekiDisplayMode || pendingMode) return;

    setPendingMode(nextMode);
    try {
      await setChekiDisplayMode(nextMode);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存拍立得展示方式。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingMode(null);
    }
  };

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '拍立得展示方式' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <SectionLabel label="展示方式" />
        <SettingsChoiceCard
          options={CHEKI_DISPLAY_MODE_OPTIONS}
          value={pendingMode ?? chekiDisplayMode}
          pending={pendingMode}
          labelOf={(option) => CHEKI_DISPLAY_MODE_LABELS[option]}
          descriptionOf={(option) => CHEKI_DISPLAY_MODE_DESCRIPTIONS[option]}
          onSelect={(option) => void handleSelectMode(option)}
        />

        <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 12, lineHeight: 19, color: colors.textSecondary }}>
            影响艺人详情、活动详情、拍立得记录详情与电子切册的图片展示。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

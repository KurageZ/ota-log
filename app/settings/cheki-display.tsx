import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { SectionLabel, SettingsChoiceCard } from '../../src/components/SettingsMenu';
import { ReadingContainer } from '../../src/components/adaptive/AppContainers';
import { ChekiDisplayExample } from '../../src/components/ChekiDisplayExample';
import { useAppTheme } from '../../src/theme/appTheme';
import { CHEKI_DISPLAY_STYLE_LABELS, type ChekiDisplayStyle } from '../../src/theme/config';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const styles: ChekiDisplayStyle[] = ['physical', 'justified', 'square'];
const descriptions: Record<ChekiDisplayStyle, string> = {
  physical: '保留实物大小关系，不同规格高低错落。',
  justified: '同一行等高、左右铺满，保持图片排序。',
  square: '方格大小一致，图片完整居中显示。',
};

export default function ChekiDisplaySettingsScreen() {
  const { colors, chekiDisplayMode, chekiTidyMode, chekiFillGaps, setChekiDisplayStyle, setChekiFillGaps } = useAppTheme();
  const [pending, setPending] = useState(false);
  const selected: ChekiDisplayStyle = chekiDisplayMode === 'original' ? 'square' : chekiTidyMode ? 'justified' : 'physical';
  const save = async (action: () => Promise<void>) => {
    setPending(true);
    try { await action(); }
    catch (error) { showOperationFailedAlert('无法保存展示设置。', '请稍后再试。', error); }
    finally { setPending(false); }
  };
  return <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
    <Stack.Screen options={{ title: '拍立得展示方式' }} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}>
      <ReadingContainer>
        <ChekiDisplayExample style={selected} fillGaps={chekiFillGaps} />
        <View style={{ height: 20 }} />
        <SectionLabel label="展示样式" />
        <SettingsChoiceCard
          options={styles}
          value={selected}
          pending={pending ? selected : null}
          labelOf={(style) => CHEKI_DISPLAY_STYLE_LABELS[style]}
          descriptionOf={(style) => descriptions[style]}
          onSelect={(style) => { if (!pending && style !== selected) void save(() => setChekiDisplayStyle(style)); }}
        />
        {selected === 'physical' ? <View style={{ marginTop: 20 }}>
          <SectionLabel label="允许提前补位" />
          <SettingsChoiceCard options={['fill', 'strict'] as const} value={chekiFillGaps ? 'fill' : 'strict'}
            pending={pending ? (chekiFillGaps ? 'fill' : 'strict') : null}
            labelOf={(option) => option === 'fill' ? '允许补位' : '严格排序'}
            descriptionOf={(option) => option === 'fill' ? '让后面的图片提前填空，查看器同步调整顺序。' : '完全按原排序排列，允许右侧留白。'}
            onSelect={(option) => { if (!pending) void save(() => setChekiFillGaps(option === 'fill')); }} />
        </View> : null}
        <View style={{ height: 16 }} />
        <Text style={{ fontSize: 12, lineHeight: 19, color: colors.textSecondary }}>应用于电子切册及各详情页。电子切册内也可临时切换样式。所有样式均完整显示图片，不裁切或旋转。</Text>
      </ReadingContainer>
    </ScrollView>
  </SafeAreaView>;
}

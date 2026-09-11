import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChekiWhiteBalanceEditor } from '../../src/components/ChekiWhiteBalanceEditor';
import { ReadingContainer } from '../../src/components/adaptive/AppContainers';
import { MenuCard, MenuItem, SectionLabel } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';
import { copyToDocuments } from '../../src/utils/copyToDocuments';
import {
  getChekiCropModule,
  type CropImage,
} from '../../modules/cheki-crop/src/ChekiCropModule';

export default function ChekiCropScreen() {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState<'picking' | 'scanning' | 'saving' | null>(null);
  const [results, setResults] = useState<CropImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setBusy('picking');
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('未获得相机权限，请在系统设置中允许访问相机。');
        return;
      }
      setBusy('scanning');
      const scanned = await getChekiCropModule().scanDocuments();
      if (scanned === null) return;
      setBusy('saving');
      const saved: CropImage[] = [];
      for (const image of scanned) {
        const uri = await copyToDocuments(image.uri, {
          filenamePrefix: 'cheki-scan-demo',
          maxDimension: 2000,
          sourceSize: { width: image.width, height: image.height },
        });
        saved.push({ ...image, uri });
      }
      setResults(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.screen }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
    >
      <ReadingContainer style={{ gap: 20 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
          拍下完整的一张拍立得，自动识别外边框并拉正。请检查白边和签名是否完整保留。
        </Text>
        {process.env.EXPO_OS !== 'ios' ? (
          <Text style={{ color: colors.text }}>此 Demo 仅支持 iOS。</Text>
        ) : (
          <>
            <MenuCard>
              <MenuItem icon="camera" label="系统扫描相机" subtitle="自动裁切，可调整四角并连续扫描" disabled={busy !== null} isLast onPress={() => void scan()} />
            </MenuCard>
            {busy ? (
              <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.textSecondary }}>
                  {busy === 'scanning' ? '正在扫描…' : busy === 'saving' ? '正在保存扫描结果…' : '正在打开相机…'}
                </Text>
              </View>
            ) : null}
            {error ? (
              <Text selectable accessibilityRole="alert" style={{ color: colors.danger, fontSize: 14, lineHeight: 21 }}>{error}</Text>
            ) : null}
            {results.map((result, index) => (
              <View key={result.uri} style={{ gap: 10 }}>
                <SectionLabel label={results.length > 1 ? `裁切结果 ${index + 1} / ${results.length}` : '裁切结果'} />
                <ChekiWhiteBalanceEditor image={result} disabled={busy !== null} />
              </View>
            ))}
            <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
              Demo · 仅在本机处理，不会添加到切册。扫描后可点选干净白边校正色偏。避开签名、阴影和反光，保留原图供对比。
            </Text>
          </>
        )}
      </ReadingContainer>
    </ScrollView>
  );
}

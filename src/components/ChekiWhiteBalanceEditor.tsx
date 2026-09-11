import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Host, Slider } from '@expo/ui';
import { getChekiCropModule, type CropImage } from '../../modules/cheki-crop/src/ChekiCropModule';
import { useAppTheme } from '../theme/appTheme';
import { copyToDocuments } from '../utils/copyToDocuments';

export function ChekiWhiteBalanceEditor({ image, disabled }: { image: CropImage; disabled: boolean }) {
  const { colors, isDark } = useAppTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [strength, setStrength] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);
  const [preview, setPreview] = useState<CropImage | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPreview(null);
    setSaved(false);
    setError(null);
    if (!point || strength === 0) {
      setProcessing(false);
      return;
    }
    setProcessing(true);
    // Debounce slider gestures; an older result must never replace a newer edit or reset.
    const timer = setTimeout(async () => {
      try {
        const result = await getChekiCropModule().whiteBalance(image.uri, point.x, point.y, strength);
        if (active) setPreview(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (active) setProcessing(false);
      }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [image.uri, point, strength]);

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const uri = await copyToDocuments(preview.uri, {
        filenamePrefix: 'cheki-white-balance',
        maxDimension: 2000,
        sourceSize: { width: preview.width, height: preview.height },
      });
      setPreview({ ...preview, uri });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };
  const locked = disabled || saving;
  const originalVisible = selecting || showOriginal || !preview;
  const buttonStyle = { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' as const };

  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole={selecting ? 'button' : 'image'}
        accessibilityLabel={selecting ? '点选没有签名的白边区域' : originalVisible ? '未调整的扫描图' : '白平衡校正预览'}
        accessibilityHint={selecting ? '在白色相纸边框上轻点，避开签名、阴影和反光。' : undefined}
        disabled={!selecting || locked}
        onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
        onPress={({ nativeEvent }) => {
          setPreview(null);
          setSaved(false);
          setPoint({
            x: Math.max(0, Math.min(1, nativeEvent.locationX / size.width)),
            y: Math.max(0, Math.min(1, nativeEvent.locationY / size.height)),
          });
          setShowOriginal(false);
          setSelecting(false);
        }}
        style={{ width: '100%', aspectRatio: image.width / image.height, backgroundColor: colors.card }}
      >
        <View pointerEvents="none" style={{ width: '100%', height: '100%' }}>
        <Image source={{ uri: originalVisible ? image.uri : preview.uri }}
          resizeMode="contain" style={{ width: '100%', height: '100%' }} />
        </View>
        {point && size.width > 0 ? (
          <View pointerEvents="none" style={{ position: 'absolute',
            left: Math.max(0, Math.min(size.width - 24, point.x * size.width - 12)),
            top: Math.max(0, Math.min(size.height - 24, point.y * size.height - 12)),
            width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ffffff', backgroundColor: '#00000055',
          }} />
        ) : null}
      </Pressable>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
        {selecting ? '正在选取白边 · 显示未调整原图' : showOriginal ? '原图对比' : preview ? (saved ? '已保存调整' : '校正预览 · 尚未保存') : '未调整原图'}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
        {selecting ? '轻点一块干净白边，避开签名、阴影和反光。取样会参考周围一小块区域。' : '用白色相纸边框校正偏黄、偏蓝等色偏。签名较多时，请选一块空白位置。'}
      </Text>
      <TouchableOpacity accessibilityRole="button" disabled={locked}
        onPress={() => setSelecting(!selecting)}
        style={{ ...buttonStyle, alignItems: 'center', borderRadius: 12, backgroundColor: colors.accent, opacity: locked ? 0.5 : 1 }}>
        <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '600' }}>{selecting ? '取消取样' : point ? '重新选取白边' : '选取白边'}</Text>
      </TouchableOpacity>
      {point ? (
        <>
          <Text style={{ color: colors.text, fontSize: 14 }}>校正强度 {Math.round(strength * 100)}%</Text>
          <Host colorScheme={isDark ? 'dark' : 'light'} seedColor={colors.accent} style={{ height: 44 }}
            accessibilityLabel="白平衡校正强度">
            <Slider value={strength} min={0} max={1} step={0.05} disabled={locked || selecting}
              onValueChange={value => { if (value !== strength) { setPreview(null); setSaved(false); setStrength(value); } }} />
          </Host>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: showOriginal }}
              disabled={locked || selecting || !preview} onPress={() => setShowOriginal(!showOriginal)} style={buttonStyle}>
              <Text style={{ color: preview ? colors.accent : colors.textMuted }}>{showOriginal ? '查看校正' : '对比原图'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={locked} style={buttonStyle}
              onPress={() => { setPoint(null); setStrength(1); setPreview(null); setShowOriginal(false); setSelecting(false); setSaved(false); }}>
              <Text style={{ color: colors.accent }}>恢复原图</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={locked || processing || selecting || !preview || saved}
              style={buttonStyle} onPress={() => void save()}>
              <Text style={{ color: preview && !saved && !processing ? colors.accent : colors.textMuted }}>{saved ? '已保存' : '保存调整'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
      {processing || saving ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} /><Text style={{ color: colors.textSecondary }}>{saving ? '正在保存…' : '正在校正色偏…'}</Text>
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, lineHeight: 21 }}>{error}</Text> : null}
    </View>
  );
}

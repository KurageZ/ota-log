import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';

export type ImagePreviewBusyAction = 'saving' | 'sharing' | 'composing' | 'capturing' | null;

/**
 * 全屏暗色图片结果预览：用于「拍立得贴纸相机」和「活动分享图片」等
 * 生成图片后的结果页，统一「已生成 / 保存到相册 / 分享」交互。
 * toggleRow 与 footerLink 用于承载调用方特有的附加控件（如水印开关、重新拍摄）。
 */
export function ImageResultPreview({
  uri,
  title = '已生成',
  busyAction = null,
  saved = false,
  onClose,
  onSave,
  onShare,
  toggleRow,
  footerLink,
  imageBorderRadius = 12,
}: {
  uri: string;
  title?: string;
  busyAction?: ImagePreviewBusyAction;
  saved?: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  toggleRow?: ReactNode;
  footerLink?: ReactNode;
  imageBorderRadius?: number;
}) {
  const isBusy = busyAction !== null;
  const saving = busyAction === 'saving';
  const sharing = busyAction === 'sharing';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#050506' }}>
      <View style={{ flex: 1, paddingHorizontal: 16, gap: 14 }}>
        <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="关闭预览"
            activeOpacity={0.72}
            disabled={isBusy}
            onPress={onClose}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(18, 18, 20, 0.64)',
              opacity: isBusy ? 0.45 : 1,
            }}
          >
            <AppIcon name="close" size={21} color="#ffffff" />
          </TouchableOpacity>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800' }}>{title}</Text>
          <View style={{ width: 44, height: 44 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={{ uri }}
            resizeMode="contain"
            style={{ width: '100%', height: '100%', borderRadius: imageBorderRadius }}
          />
        </View>

        {toggleRow}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.75}
            disabled={isBusy || saved}
            onPress={onSave}
            style={{
              flex: 1,
              minHeight: 50,
              borderRadius: 15,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              backgroundColor: saved ? 'rgba(255,255,255,0.18)' : '#ffffff',
              opacity: isBusy ? 0.55 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#111114" />
            ) : (
              <AppIcon name={saved ? 'statusCompleted' : 'save'} size={18} color={saved ? '#ffffff' : '#111114'} />
            )}
            <Text style={{ color: saved ? '#ffffff' : '#111114', fontSize: 15, fontWeight: '800' }}>
              {saved ? '已保存' : '保存到相册'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="分享图片"
            activeOpacity={0.75}
            disabled={isBusy}
            onPress={onShare}
            style={{
              width: 52,
              height: 50,
              borderRadius: 15,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.16)',
              opacity: isBusy ? 0.55 : 1,
            }}
          >
            {sharing ? <ActivityIndicator size="small" color="#ffffff" /> : <AppIcon name="share" size={20} color="#ffffff" />}
          </TouchableOpacity>
        </View>

        {footerLink}
      </View>
    </SafeAreaView>
  );
}

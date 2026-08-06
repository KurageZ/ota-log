import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { deleteTemporaryStickerFile } from '../features/sticker-camera/file-utils';
import {
  composeStickerPhoto,
  type ComposedStickerPhoto,
} from '../features/sticker-camera/compose-sticker-photo';
import {
  StickerOverlay,
  type StickerAsset,
} from '../features/sticker-camera/sticker-overlay';
import { STICKER_CAMERA_ASPECT_RATIO } from '../features/sticker-camera/sticker-preset';
import { useAppTheme } from '../theme/appTheme';
import { copyToDocuments } from '../utils/copyToDocuments';
import { showFailureAlert, showPhotoLibraryPermissionAlert } from '../utils/failureAlert';

type ScreenPhase = 'selecting' | 'camera' | 'result';
type BusyAction = 'selecting' | 'capturing' | 'composing' | 'saving' | 'sharing' | null;

async function prepareStickerAsset(asset: ImagePicker.ImagePickerAsset): Promise<StickerAsset> {
  const resizeWidth = asset.width > 1600 ? 1600 : undefined;
  const normalized = await manipulateAsync(
    asset.uri,
    resizeWidth ? [{ resize: { width: resizeWidth } }] : [],
    { compress: 0.92, format: SaveFormat.JPEG },
  );

  try {
    const uri = await copyToDocuments(normalized.uri, {
      filenamePrefix: 'sticker_source',
      maxDimension: 1600,
      sourceSize: { width: normalized.width, height: normalized.height },
    });
    return {
      uri,
      width: normalized.width,
      height: normalized.height,
    };
  } finally {
    deleteTemporaryStickerFile(normalized.uri);
  }
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.72}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(18, 18, 20, 0.64)',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <AppIcon name={icon} size={21} color="#ffffff" />
    </TouchableOpacity>
  );
}

function UnsupportedScreen() {
  const { colors } = useAppTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}
      style={{ flex: 1, backgroundColor: colors.screen }}
    >
      <View style={{ position: 'absolute', top: 14, left: 16 }}>
        <IconButton icon="close" label="关闭" onPress={() => router.back()} />
      </View>
      <AppIcon name="camera" size={44} color={colors.textMuted} />
      <Text style={{ color: colors.heading, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
        当前 Demo 仅支持 iOS
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>
        Android 版本会在确认 iOS 的拍摄和合成效果后再接入。
      </Text>
    </ScrollView>
  );
}

function StickerSelectionScreen({
  busy,
  onSelect,
}: {
  busy: boolean;
  onSelect: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 }}
      style={{ flex: 1, backgroundColor: colors.screen }}
    >
      <View style={{ position: 'absolute', top: 14, left: 16 }}>
        <IconButton icon="close" label="关闭" onPress={() => router.back()} disabled={busy} />
      </View>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 24,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accentSoft,
          }}
        >
          <AppIcon name="camera" size={38} color={colors.accent} />
        </View>
        <Text style={{ color: colors.heading, fontSize: 25, fontWeight: '900', textAlign: 'center' }}>
          拍立得贴纸相机
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>
          选择一张照片作为固定贴纸。拍摄完成后，贴纸会真正合成到照片右下角。
        </Text>
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: colors.card,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AppIcon name="image" size={18} color={colors.accent} />
          <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' }}>单张固定预设</Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
          Demo 暂不支持拖动、缩放、旋转和多张贴纸，输出照片固定为 3:4。
        </Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.78}
        disabled={busy}
        onPress={onSelect}
        style={{
          minHeight: 52,
          borderRadius: 16,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 9,
          backgroundColor: colors.accent,
          opacity: busy ? 0.65 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <AppIcon name="images" size={20} color={colors.onAccent} />
        )}
        <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>
          {busy ? '正在准备贴纸…' : '选择一张照片'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function CameraPermissionScreen({
  canAskAgain,
  onRequest,
}: {
  canAskAgain: boolean;
  onRequest: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 15 }}
      style={{ flex: 1, backgroundColor: colors.screen }}
    >
      <View style={{ position: 'absolute', top: 14, left: 16 }}>
        <IconButton icon="close" label="关闭" onPress={() => router.back()} />
      </View>
      <AppIcon name="camera" size={48} color={colors.accent} />
      <Text style={{ color: colors.heading, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
        需要相机权限
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>
        ota log 只会在这个工具中使用相机，拍摄的原始缓存不会写入拍立得记录。
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.78}
        onPress={onRequest}
        style={{
          minHeight: 48,
          paddingHorizontal: 22,
          borderRadius: 15,
          borderCurve: 'continuous',
          justifyContent: 'center',
          backgroundColor: colors.accent,
        }}
      >
        <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '800' }}>
          {canAskAgain ? '允许相机访问' : '前往系统设置'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function CameraStage({
  sticker,
  cameraRef,
  cameraReady,
  busyAction,
  onCameraReady,
  onCameraError,
  onCapture,
  onChangeSticker,
}: {
  sticker: StickerAsset;
  cameraRef: React.RefObject<CameraView | null>;
  cameraReady: boolean;
  busyAction: BusyAction;
  onCameraReady: () => void;
  onCameraError: (message: string) => void;
  onCapture: () => void;
  onChangeSticker: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableCanvasHeight = Math.max(300, screenHeight - insets.top - insets.bottom - 172);
  const canvasWidth = Math.floor(Math.min(screenWidth, availableCanvasHeight * STICKER_CAMERA_ASPECT_RATIO));
  const canvasHeight = Math.floor(canvasWidth / STICKER_CAMERA_ASPECT_RATIO);
  const isBusy = busyAction === 'capturing' || busyAction === 'composing';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#050506' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <View
          style={{
            width: canvasWidth,
            height: canvasHeight,
            overflow: 'hidden',
            borderRadius: screenWidth === canvasWidth ? 0 : 18,
            borderCurve: 'continuous',
            backgroundColor: '#111114',
          }}
        >
          <CameraView
            ref={cameraRef}
            active
            animateShutter
            autofocus="on"
            facing="back"
            mode="picture"
            responsiveOrientationWhenOrientationLocked={false}
            onCameraReady={onCameraReady}
            onMountError={(event) => onCameraError(event.message)}
            style={{ position: 'absolute', inset: 0 }}
          />
          <StickerOverlay asset={sticker} canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
          <View style={{ position: 'absolute', top: 12, left: 12 }}>
            <IconButton icon="close" label="关闭贴纸相机" onPress={() => router.back()} disabled={isBusy} />
          </View>
          {!cameraReady ? (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.32)',
              }}
            >
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : null}
        </View>

        <View style={{ width: canvasWidth, height: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="更换贴纸"
            activeOpacity={0.72}
            disabled={isBusy}
            onPress={onChangeSticker}
            style={{
              width: 52,
              height: 52,
              padding: 3,
              borderRadius: 13,
              borderCurve: 'continuous',
              borderWidth: 2,
              borderColor: '#ffffff',
              backgroundColor: '#ffffff',
              opacity: isBusy ? 0.45 : 1,
            }}
          >
            <Image
              source={{ uri: sticker.uri }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%', borderRadius: 9 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="拍照"
            activeOpacity={0.72}
            disabled={!cameraReady || isBusy}
            onPress={onCapture}
            style={{
              width: 74,
              height: 74,
              borderRadius: 37,
              borderWidth: 4,
              borderColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !cameraReady || isBusy ? 0.5 : 1,
            }}
          >
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#ffffff' }} />
          </TouchableOpacity>

          <View style={{ width: 52, alignItems: 'center' }}>
            {isBusy ? <ActivityIndicator color="#ffffff" /> : <AppIcon name="sparkles" size={24} color="rgba(255,255,255,0.72)" />}
          </View>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12, textAlign: 'center' }}>
          {busyAction === 'composing' ? '正在把贴纸合成到照片…' : '贴纸使用固定预设并写入最终照片'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function ResultStage({
  result,
  busyAction,
  saved,
  onSave,
  onShare,
  onRetake,
  onChangeSticker,
}: {
  result: ComposedStickerPhoto;
  busyAction: BusyAction;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onRetake: () => void;
  onChangeSticker: () => void;
}) {
  const isBusy = busyAction === 'saving' || busyAction === 'sharing';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#050506' }}>
      <View style={{ flex: 1, paddingHorizontal: 16, gap: 14 }}>
        <View style={{ height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton icon="close" label="关闭结果" onPress={() => router.back()} disabled={isBusy} />
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800' }}>已生成</Text>
          <IconButton icon="images" label="更换贴纸" onPress={onChangeSticker} disabled={isBusy} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={{ uri: result.uri }}
            resizeMode="contain"
            style={{ width: '100%', height: '100%', borderRadius: 12 }}
          />
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 11, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {result.width} × {result.height} JPEG
        </Text>

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
            {busyAction === 'saving' ? (
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
            accessibilityLabel="分享合成照片"
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
            {busyAction === 'sharing' ? <ActivityIndicator size="small" color="#ffffff" /> : <AppIcon name="share" size={20} color="#ffffff" />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.72}
          disabled={isBusy}
          onPress={onRetake}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}
        >
          <AppIcon name="refresh" size={17} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>重新拍摄</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function ChekiStickerCameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<ScreenPhase>('selecting');
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [sticker, setSticker] = useState<StickerAsset | null>(null);
  const [result, setResult] = useState<ComposedStickerPhoto | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectSticker = useCallback(async () => {
    if (busyAction) return;
    setBusyAction('selecting');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showPhotoLibraryPermissionAlert();
        return;
      }

      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (selection.canceled || !selection.assets[0]) return;

      const prepared = await prepareStickerAsset(selection.assets[0]);
      setSticker(prepared);
      setResult(null);
      setSaved(false);
      setCameraReady(false);
      setPhase('camera');

      if (!cameraPermission?.granted && cameraPermission?.canAskAgain !== false) {
        await requestCameraPermission();
      }
    } catch (error) {
      showFailureAlert({
        title: '贴纸准备失败',
        reason: '无法读取或处理所选照片。',
        nextStep: '请重新选择一张照片后再试。',
        details: error,
      });
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, cameraPermission?.canAskAgain, cameraPermission?.granted, requestCameraPermission]);

  const requestOrOpenCameraSettings = useCallback(async () => {
    if (cameraPermission?.canAskAgain === false) {
      await Linking.openSettings();
      return;
    }
    await requestCameraPermission();
  }, [cameraPermission?.canAskAgain, requestCameraPermission]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || !sticker || !cameraReady || busyAction) return;
    setBusyAction('capturing');
    let previewPaused = false;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        shutterSound: true,
      });
      if (!photo) throw new Error('相机没有返回照片');
      await cameraRef.current.pausePreview();
      previewPaused = true;
      setBusyAction('composing');
      const composed = await composeStickerPhoto(photo, sticker);
      setResult(composed);
      setSaved(false);
      setPhase('result');
    } catch (error) {
      showFailureAlert({
        title: '拍摄失败',
        reason: '无法生成贴纸照片。',
        nextStep: '请返回相机后重新拍摄。',
        details: error,
      });
      if (previewPaused) {
        try {
          await cameraRef.current?.resumePreview();
        } catch {
          // The camera may have unmounted while the error alert was being shown.
        }
      }
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, cameraReady, sticker]);

  const saveResult = useCallback(async () => {
    if (!result || busyAction || saved) return;
    setBusyAction('saving');
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        showFailureAlert({
          title: '无法保存到相册',
          reason: 'ota log 没有添加照片的权限。',
          nextStep: '请在系统设置中允许添加照片后再试。',
        });
        return;
      }
      await MediaLibrary.Asset.create(result.uri);
      setSaved(true);
    } catch (error) {
      showFailureAlert({
        title: '保存失败',
        reason: '无法将照片保存到系统相册。',
        nextStep: '请稍后重新保存。',
        details: error,
      });
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, result, saved]);

  const shareResult = useCallback(async () => {
    if (!result || busyAction) return;
    setBusyAction('sharing');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('当前设备不支持系统分享');
      await Sharing.shareAsync(result.uri, {
        dialogTitle: '分享贴纸照片',
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
    } catch (error) {
      showFailureAlert({
        title: '分享失败',
        reason: '无法分享这张照片。',
        nextStep: '请稍后重新尝试。',
        details: error,
      });
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, result]);

  if (process.env.EXPO_OS !== 'ios') return <UnsupportedScreen />;

  if (phase === 'selecting' || !sticker) {
    return <StickerSelectionScreen busy={busyAction === 'selecting'} onSelect={() => void selectSticker()} />;
  }

  if (!cameraPermission) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050506' }}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <CameraPermissionScreen
        canAskAgain={cameraPermission.canAskAgain}
        onRequest={() => void requestOrOpenCameraSettings()}
      />
    );
  }

  if (phase === 'result' && result) {
    return (
      <ResultStage
        result={result}
        busyAction={busyAction}
        saved={saved}
        onSave={() => void saveResult()}
        onShare={() => void shareResult()}
        onRetake={() => {
          setCameraReady(false);
          setPhase('camera');
        }}
        onChangeSticker={() => {
          setPhase('selecting');
          setResult(null);
          setSaved(false);
        }}
      />
    );
  }

  return (
    <CameraStage
      sticker={sticker}
      cameraRef={cameraRef}
      cameraReady={cameraReady}
      busyAction={busyAction}
      onCameraReady={() => setCameraReady(true)}
      onCameraError={(message) => showFailureAlert({
        title: '相机启动失败',
        reason: '相机无法正常启动。',
        nextStep: '请关闭当前页面后重新打开贴纸相机。',
        details: message,
      })}
      onCapture={() => void capture()}
      onChangeSticker={() => {
        setCameraReady(false);
        setPhase('selecting');
      }}
    />
  );
}

import { useCallback, useRef, useState, type ReactNode } from 'react';
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
import { router, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import {
  composeStickerPhoto,
  type CapturedPhoto,
  type ComposedStickerPhoto,
} from '../features/sticker-camera/compose-sticker-photo';
import { StickerPicker } from '../features/sticker-camera/sticker-picker';
import {
  StickerOverlay,
  type StickerAsset,
} from '../features/sticker-camera/sticker-overlay';
import { STICKER_CAMERA_ASPECT_RATIO } from '../features/sticker-camera/sticker-preset';
import { ImageResultPreview } from '../components/ImageResultPreview';
import { useAppTheme } from '../theme/appTheme';
import { showFailureAlert } from '../utils/failureAlert';
import { saveImageToAlbum, shareImageFile } from '../utils/imageShare';

type ScreenPhase = 'picker' | 'camera' | 'result';
type BusyAction = 'capturing' | 'composing' | 'saving' | 'sharing' | null;

function FullscreenRouteStage({ children }: { children: ReactNode }) {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {children}
    </>
  );
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

function UnsupportedWebScreen() {
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
        当前仅支持 iOS 与 Android
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>
        请在手机端打开拍立得贴纸相机。
      </Text>
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
  stickers,
  cameraRef,
  cameraReady,
  busyAction,
  onCameraReady,
  onCameraError,
  onCapture,
  onChangeSticker,
}: {
  stickers: StickerAsset[];
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
            ratio={process.env.EXPO_OS === 'android' ? '4:3' : undefined}
            responsiveOrientationWhenOrientationLocked={false}
            onCameraReady={onCameraReady}
            onMountError={(event) => onCameraError(event.message)}
            style={{ position: 'absolute', inset: 0 }}
          />
          <StickerOverlay assets={stickers} canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
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
              source={{ uri: stickers[stickers.length - 1]?.uri }}
              resizeMode="contain"
              style={{ width: '100%', height: '100%', borderRadius: 9 }}
            />
            {stickers.length > 1 ? (
              <View
                style={{
                  position: 'absolute',
                  right: -7,
                  top: -7,
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 5,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 7px rgba(0, 0, 0, 0.28)',
                }}
              >
                <Text style={{ color: '#111114', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                  {stickers.length}
                </Text>
              </View>
            ) : null}
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
            {isBusy ? <ActivityIndicator color="#ffffff" /> : null}
          </View>
        </View>

        <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12, textAlign: 'center' }}>
          {busyAction === 'composing' ? '正在把贴纸合成到照片…' : `${stickers.length} 张贴纸将按固定位置写入照片`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function ResultStage({
  result,
  busyAction,
  saved,
  watermarkEnabled,
  onSave,
  onShare,
  onRetake,
  onToggleWatermark,
}: {
  result: ComposedStickerPhoto;
  busyAction: BusyAction;
  saved: boolean;
  watermarkEnabled: boolean;
  onSave: () => void;
  onShare: () => void;
  onRetake: () => void;
  onToggleWatermark: () => void;
}) {
  return (
    <ImageResultPreview
      uri={result.uri}
      busyAction={busyAction}
      saved={saved}
      onClose={() => router.back()}
      onSave={onSave}
      onShare={onShare}
      toggleRow={
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityLabel="添加 App 水印"
          accessibilityState={{ checked: watermarkEnabled }}
          activeOpacity={0.7}
          disabled={busyAction !== null}
          onPress={onToggleWatermark}
          style={{
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 2,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>
            添加 App 水印
          </Text>
          {busyAction === 'composing' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View
              style={{
                width: 48,
                height: 28,
                borderRadius: 14,
                padding: 3,
                backgroundColor: watermarkEnabled ? '#ffffff' : 'rgba(255,255,255,0.22)',
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: watermarkEnabled ? '#111114' : 'rgba(255,255,255,0.85)',
                  alignSelf: watermarkEnabled ? 'flex-end' : 'flex-start',
                }}
              />
            </View>
          )}
        </TouchableOpacity>
      }
      footerLink={
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.72}
          disabled={busyAction !== null}
          onPress={onRetake}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}
        >
          <AppIcon name="refresh" size={17} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>重新拍摄</Text>
        </TouchableOpacity>
      }
    />
  );
}

export default function ChekiStickerCameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<ScreenPhase>('picker');
  const [pickerReturnPhase, setPickerReturnPhase] = useState<'camera' | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [stickers, setStickers] = useState<StickerAsset[]>([]);
  const [result, setResult] = useState<ComposedStickerPhoto | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [saved, setSaved] = useState(false);

  const confirmStickers = useCallback(async (assets: StickerAsset[]) => {
    setStickers(assets);
    setResult(null);
    setCapturedPhoto(null);
    setWatermarkEnabled(true);
    setSaved(false);
    setCameraReady(false);
    setPickerReturnPhase(null);
    setPhase('camera');

    if (!cameraPermission?.granted && cameraPermission?.canAskAgain !== false) {
      await requestCameraPermission();
    }
  }, [cameraPermission?.canAskAgain, cameraPermission?.granted, requestCameraPermission]);

  const requestOrOpenCameraSettings = useCallback(async () => {
    if (cameraPermission?.canAskAgain === false) {
      await Linking.openSettings();
      return;
    }
    await requestCameraPermission();
  }, [cameraPermission?.canAskAgain, requestCameraPermission]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || stickers.length === 0 || !cameraReady || busyAction) return;
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
      setCapturedPhoto({ uri: photo.uri, width: photo.width, height: photo.height });
      const composed = await composeStickerPhoto(photo, stickers, { watermark: watermarkEnabled });
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
  }, [busyAction, cameraReady, stickers, watermarkEnabled]);

  const toggleWatermark = useCallback(async () => {
    if (!capturedPhoto || busyAction) return;
    const nextWatermark = !watermarkEnabled;
    setWatermarkEnabled(nextWatermark);
    setBusyAction('composing');
    try {
      const composed = await composeStickerPhoto(capturedPhoto, stickers, {
        watermark: nextWatermark,
      });
      setResult(composed);
      setSaved(false);
    } catch (error) {
      setWatermarkEnabled(!nextWatermark);
      showFailureAlert({
        title: '水印合成失败',
        reason: '无法为这张照片添加水印。',
        nextStep: '请稍后重新尝试，或直接保存不带水印的照片。',
        details: error,
      });
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, capturedPhoto, stickers, watermarkEnabled]);

  const saveResult = useCallback(async () => {
    if (!result || busyAction || saved) return;
    setBusyAction('saving');
    try {
      if (await saveImageToAlbum(result.uri)) setSaved(true);
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, result, saved]);

  const shareResult = useCallback(async () => {
    if (!result || busyAction) return;
    setBusyAction('sharing');
    try {
      await shareImageFile(result.uri, '分享贴纸照片');
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, result]);

  if (process.env.EXPO_OS === 'web') {
    return (
      <FullscreenRouteStage>
        <UnsupportedWebScreen />
      </FullscreenRouteStage>
    );
  }

  if (phase === 'picker' || stickers.length === 0) {
    return (
      <StickerPicker
        initialSelection={stickers}
        onCancel={() => {
          if (pickerReturnPhase) {
            setPhase(pickerReturnPhase);
            setPickerReturnPhase(null);
            return;
          }
          router.back();
        }}
        onConfirm={confirmStickers}
      />
    );
  }

  if (!cameraPermission) {
    return (
      <FullscreenRouteStage>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050506' }}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </FullscreenRouteStage>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <FullscreenRouteStage>
        <CameraPermissionScreen
          canAskAgain={cameraPermission.canAskAgain}
          onRequest={() => void requestOrOpenCameraSettings()}
        />
      </FullscreenRouteStage>
    );
  }

  if (phase === 'result' && result) {
    return (
      <FullscreenRouteStage>
        <ResultStage
          result={result}
          busyAction={busyAction}
          saved={saved}
          watermarkEnabled={watermarkEnabled}
          onSave={() => void saveResult()}
          onShare={() => void shareResult()}
          onRetake={() => {
            setWatermarkEnabled(true);
            setCapturedPhoto(null);
            setCameraReady(false);
            setPhase('camera');
          }}
          onToggleWatermark={() => void toggleWatermark()}
        />
      </FullscreenRouteStage>
    );
  }

  return (
    <FullscreenRouteStage>
      <CameraStage
        stickers={stickers}
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
          setPickerReturnPhase('camera');
          setPhase('picker');
        }}
      />
    </FullscreenRouteStage>
  );
}

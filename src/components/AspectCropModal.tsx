import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useAppTheme } from '../theme/appTheme';
import {
  MIN_CROP_SCALE,
  clampCropTransform,
  getCoverDisplaySize,
  getCropRect,
} from '../utils/cropGeometry';

export interface AspectCropModalProps {
  visible: boolean;
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  aspectRatio?: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
}

const DEFAULT_ASPECT_RATIO = 4 / 5;

export function AspectCropModal({
  visible,
  sourceUri,
  sourceWidth,
  sourceHeight,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  title = '调整图片',
  onCancel,
  onConfirm,
}: AspectCropModalProps) {
  const { colors } = useAppTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [processing, setProcessing] = useState(false);
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(null);

  const frame = useMemo(() => {
    const maxFrameHeight = Math.max(280, screenHeight - 260);
    let width = Math.min(screenWidth - 56, 320);
    let height = width / aspectRatio;
    if (height > maxFrameHeight) {
      height = maxFrameHeight;
      width = height * aspectRatio;
    }
    return { width: Math.round(width), height: Math.round(height) };
  }, [screenWidth, screenHeight, aspectRatio]);

  const scale = useSharedValue(MIN_CROP_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(MIN_CROP_SCALE);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = MIN_CROP_SCALE;
    translateX.value = 0;
    translateY.value = 0;
  }, [sourceUri, frame.width, frame.height, scale, translateX, translateY]);

  useEffect(() => {
    if (sourceWidth > 0 && sourceHeight > 0) {
      setMeasuredSize(null);
      return;
    }
    let mounted = true;
    Image.getSize(
      sourceUri,
      (width, height) => {
        if (mounted) setMeasuredSize({ width, height });
      },
      () => {
        // Keep the picker-provided dimensions; getCropRect handles invalid sizes.
      },
    );
    return () => {
      mounted = false;
    };
  }, [sourceUri, sourceWidth, sourceHeight]);

  const imageWidth = measuredSize?.width ?? sourceWidth;
  const imageHeight = measuredSize?.height ?? sourceHeight;
  const display = getCoverDisplaySize(frame.width, frame.height, imageWidth, imageHeight);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        const clamped = clampCropTransform(
          frame.width,
          frame.height,
          imageWidth,
          imageHeight,
          scale.value,
          savedTranslateX.value + event.translationX,
          savedTranslateY.value + event.translationY,
        );
        translateX.value = clamped.translateX;
        translateY.value = clamped.translateY;
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        savedScale.value = scale.value;
      })
      .onUpdate((event) => {
        const clamped = clampCropTransform(
          frame.width,
          frame.height,
          imageWidth,
          imageHeight,
          savedScale.value * event.scale,
          translateX.value,
          translateY.value,
        );
        scale.value = clamped.scale;
        translateX.value = clamped.translateX;
        translateY.value = clamped.translateY;
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [
    frame.width,
    frame.height,
    imageWidth,
    imageHeight,
    scale,
    translateX,
    translateY,
    savedScale,
    savedTranslateX,
    savedTranslateY,
  ]);

  const imageTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));
  const imageScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleConfirm = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const rect = getCropRect(
        frame.width,
        frame.height,
        imageWidth,
        imageHeight,
        scale.value,
        translateX.value,
        translateY.value,
      );
      const result = await manipulateAsync(
        sourceUri,
        [{ crop: rect }],
        { compress: 1, format: SaveFormat.JPEG },
      );
      await onConfirm(result.uri);
    } catch {
      onCancel();
    } finally {
      setProcessing(false);
    }
  }, [
    frame.width,
    frame.height,
    imageWidth,
    imageHeight,
    scale,
    translateX,
    translateY,
    sourceUri,
    processing,
    onConfirm,
    onCancel,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#000' }}>
            <View
              style={{
                height: 56,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
              }}
            >
              <TouchableOpacity onPress={onCancel} hitSlop={12} style={{ padding: 8 }}>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>取消</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{title}</Text>
              </View>
              <TouchableOpacity onPress={handleConfirm} hitSlop={12} style={{ padding: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accent }}>完成</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: frame.width,
                  height: frame.height,
                  borderRadius: 14,
                  overflow: 'hidden',
                  backgroundColor: '#111',
                }}
              >
                <GestureDetector gesture={gesture}>
                  <View style={{ flex: 1 }}>
                    <Animated.View
                      style={[
                        StyleSheet.absoluteFill,
                        { alignItems: 'center', justifyContent: 'center' },
                        imageTranslateStyle,
                      ]}
                    >
                      <Animated.View
                        style={[{ width: display.width, height: display.height }, imageScaleStyle]}
                      >
                        <Image
                          source={{ uri: sourceUri }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      </Animated.View>
                    </Animated.View>
                  </View>
                </GestureDetector>

                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}>
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '33.333%',
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: 'rgba(255,255,255,0.5)',
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '66.666%',
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: 'rgba(255,255,255,0.5)',
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '33.333%',
                      width: StyleSheet.hairlineWidth,
                      backgroundColor: 'rgba(255,255,255,0.5)',
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '66.666%',
                      width: StyleSheet.hairlineWidth,
                      backgroundColor: 'rgba(255,255,255,0.5)',
                    }}
                  />
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 14 },
                    ]}
                  />
                </View>
              </View>

              <View style={{ position: 'absolute', bottom: 28, alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                  单指拖动调整位置 · 双指缩放
                </Text>
                {processing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>处理中…</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

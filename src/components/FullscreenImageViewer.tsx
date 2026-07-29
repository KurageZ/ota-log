import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';

const HEADER_HEIGHT = 64;
const COLLAPSED_PILL_HEIGHT = 44;
const FOOTER_ACTION_GAP = 12;
const FOOTER_ACTION_HEIGHT = 40;
const CONTROLS_ANIMATION_DURATION_MS = 180;
const OPEN_TRANSITION_DURATION_MS = 220;
const OPEN_TRANSITION_FALLBACK_MS = 1000;

export interface FullscreenImageItem {
  id: string;
  photoUri: string;
}

export interface FullscreenImageTransitionOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

interface FullscreenImageTransitionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getAndroidModalSourceYOffset(): number {
  return Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
}

function normalizeSourceOriginForModal(
  origin: FullscreenImageTransitionOrigin,
): FullscreenImageTransitionOrigin {
  const yOffset = getAndroidModalSourceYOffset();
  if (yOffset === 0) return origin;
  return {
    ...origin,
    y: origin.y + yOffset,
  };
}

interface FullscreenImageViewerProps<T extends FullscreenImageItem> {
  visible: boolean;
  items: T[];
  selectedId: string | null;
  onClose: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  getDetailSummary?: (item: T) => string;
  renderDetails?: (item: T) => React.ReactNode;
  initialTransitionOrigin?: FullscreenImageTransitionOrigin | null;
}

type IndexComponentProps = {
  imageIndex: number;
};

function HeaderButton({
  icon,
  accessibilityLabel,
  color,
  onPress,
  restBackgroundColor,
  pressedBackgroundColor,
}: {
  icon: AppIconName;
  accessibilityLabel: string;
  color: string;
  onPress: () => void;
  restBackgroundColor: string;
  pressedBackgroundColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? pressedBackgroundColor : restBackgroundColor,
      })}
    >
      <AppIcon name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function FullscreenImageViewer<T extends FullscreenImageItem>({
  visible,
  items,
  selectedId,
  onClose,
  onEdit,
  onDelete,
  getDetailSummary,
  renderDetails,
  initialTransitionOrigin,
}: FullscreenImageViewerProps<T>) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  // react-native-image-viewing remounts when imageIndex changes; treat it as open-time initial state.
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [transitionOrigin, setTransitionOrigin] = useState<FullscreenImageTransitionOrigin | null>(null);
  const [transitionTargetRect, setTransitionTargetRect] = useState<FullscreenImageTransitionRect | null>(null);
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionReady, setTransitionReady] = useState(false);
  const [viewerContentLoaded, setViewerContentLoaded] = useState(false);
  const [transitionCoverLoaded, setTransitionCoverLoaded] = useState(false);
  const controlsAnimation = useRef(new Animated.Value(1)).current;
  const transitionAnimation = useRef(new Animated.Value(0)).current;

  const selectedIndex = useMemo(() => {
    if (!selectedId) return 0;
    const index = items.findIndex((item) => item.id === selectedId);
    return index >= 0 ? index : 0;
  }, [items, selectedId]);

  const images = useMemo(
    () => items.map((item) => ({ uri: item.photoUri })),
    [items],
  );

  const clampIndex = useCallback((index: number) => {
    if (items.length === 0) return 0;
    return Math.min(Math.max(index, 0), items.length - 1);
  }, [items.length]);

  useEffect(() => {
    if (!visible) return;
    if (items.length === 0) {
      onClose();
      return;
    }
    const nextIndex = clampIndex(selectedIndex);
    const opensWithTransition = Boolean(initialTransitionOrigin);
    setInitialImageIndex(nextIndex);
    setCurrentIndex(nextIndex);
    setTransitionReady(!opensWithTransition);
    setViewerContentLoaded(!opensWithTransition);
    setControlsVisible(!opensWithTransition);
    controlsAnimation.setValue(opensWithTransition ? 0 : 1);
    setDetailsExpanded(false);
  }, [clampIndex, controlsAnimation, initialTransitionOrigin, items.length, onClose, selectedIndex, visible]);

  useEffect(() => {
    if (!visible || items.length === 0) return;
    setCurrentIndex((index) => clampIndex(index));
    setInitialImageIndex((index) => clampIndex(index));
  }, [clampIndex, items.length, visible]);

  const handleImageIndexChange = useCallback((imageIndex: number) => {
    setCurrentIndex(imageIndex);
    setDetailsExpanded(false);
  }, []);

  const handleViewerImageLoad = useCallback((imageIndex: number) => {
    if (imageIndex === initialImageIndex) {
      setViewerContentLoaded(true);
    }
  }, [initialImageIndex]);

  useEffect(() => {
    Animated.timing(controlsAnimation, {
      toValue: controlsVisible ? 1 : 0,
      duration: CONTROLS_ANIMATION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [controlsAnimation, controlsVisible]);

  const currentItem = items[clampIndex(currentIndex)] ?? null;
  const hasDetails = Boolean(getDetailSummary && renderDetails);
  const expandedSheetHeight = Math.min(
    Math.max(300, screenHeight * 0.46),
    screenHeight
      - insets.top
      - insets.bottom
      - HEADER_HEIGHT
      - FOOTER_ACTION_GAP
      - FOOTER_ACTION_HEIGHT
      - 40,
  );
  const sheetBackgroundColor = 'rgba(17,24,39,0.88)';
  const sheetBorderColor = 'rgba(255,255,255,0.10)';
  const detailLabelColor = 'rgba(255,255,255,0.66)';
  const footerBottomPadding = Platform.OS === 'ios'
    ? Math.max(insets.bottom - 8, 8)
    : insets.bottom + 12;
  const initialTransitionOriginForModal = useMemo(() => (
    visible && initialTransitionOrigin
      ? normalizeSourceOriginForModal(initialTransitionOrigin)
      : null
  ), [initialTransitionOrigin, visible]);
  const activeTransitionOrigin = transitionOrigin ?? initialTransitionOriginForModal;
  const headerAnimatedStyle = useMemo(() => ({
    opacity: controlsAnimation,
    transform: [{
      translateY: controlsAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-14, 0],
      }),
    }],
  }), [controlsAnimation]);
  const footerAnimatedStyle = useMemo(() => ({
    opacity: controlsAnimation,
    transform: [{
      translateY: controlsAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [18, 0],
      }),
    }],
  }), [controlsAnimation]);
  const transitionTarget = transitionTargetRect ?? activeTransitionOrigin;
  const transitionAnimatedStyle = useMemo(() => {
    if (!activeTransitionOrigin || !transitionTarget) return null;

    return {
      left: transitionAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [activeTransitionOrigin.x, transitionTarget.x],
      }),
      top: transitionAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [activeTransitionOrigin.y, transitionTarget.y],
      }),
      width: transitionAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [activeTransitionOrigin.width, transitionTarget.width],
      }),
      height: transitionAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [activeTransitionOrigin.height, transitionTarget.height],
      }),
      borderRadius: transitionAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [activeTransitionOrigin.borderRadius ?? 10, 6],
      }),
    };
  }, [activeTransitionOrigin, transitionAnimation, transitionTarget]);
  const transitionBackdropStyle = useMemo(() => ({
    opacity: transitionAnimation.interpolate({
      inputRange: [0, 0.92, 1],
      outputRange: [0, 0, 1],
    }),
  }), [transitionAnimation]);
  const openingWithTransition = Boolean(initialTransitionOrigin);
  const showOpeningTransition = openingWithTransition && (transitionActive || transitionOrigin === null);
  const transitionItem = items[clampIndex(selectedIndex)] ?? currentItem;
  useEffect(() => {
    if (!visible || !initialTransitionOrigin || items.length === 0) {
      setTransitionActive(false);
      setTransitionReady(false);
      setTransitionOrigin(null);
      setTransitionTargetRect(null);
      setTransitionCoverLoaded(false);
      if (!visible || items.length === 0) {
        setViewerContentLoaded(false);
      }
      transitionAnimation.setValue(0);
      return;
    }

    let cancelled = false;
    const item = items[clampIndex(selectedIndex)] ?? null;
    const viewport = Dimensions.get(Platform.OS === 'android' ? 'window' : 'screen');
    const modalSourceOrigin = normalizeSourceOriginForModal(initialTransitionOrigin);

    const buildTargetRect = (imageWidth: number, imageHeight: number) => {
      const fallbackAspect = initialTransitionOrigin.width > 0 && initialTransitionOrigin.height > 0
        ? initialTransitionOrigin.width / initialTransitionOrigin.height
        : 54 / 86;
      const imageAspect = imageWidth > 0 && imageHeight > 0
        ? imageWidth / imageHeight
        : fallbackAspect;
      let width = viewport.width;
      let height = width / imageAspect;

      if (height > viewport.height) {
        height = viewport.height;
        width = height * imageAspect;
      }

      return {
        x: (viewport.width - width) / 2,
        y: (viewport.height - height) / 2,
        width,
        height,
      };
    };

    setTransitionOrigin(modalSourceOrigin);
    setTransitionTargetRect(null);
    setTransitionActive(true);
    setTransitionReady(false);
    setViewerContentLoaded(false);
    setTransitionCoverLoaded(false);
    transitionAnimation.setValue(0);

    const setFallbackTarget = () => {
      if (!cancelled) {
        const fallbackTarget = buildTargetRect(initialTransitionOrigin.width, initialTransitionOrigin.height);
        setTransitionTargetRect(fallbackTarget);
      }
    };

    if (!item?.photoUri) {
      setFallbackTarget();
      return () => {
        cancelled = true;
      };
    }

    Image.getSizeWithHeaders(
      item.photoUri,
      {},
      (imageWidth, imageHeight) => {
        if (!cancelled) {
          const imageTarget = buildTargetRect(imageWidth, imageHeight);
          setTransitionTargetRect(imageTarget);
        }
      },
      setFallbackTarget,
    );

    return () => {
      cancelled = true;
    };
  }, [
    clampIndex,
    initialTransitionOrigin,
    items,
    selectedIndex,
    transitionAnimation,
    visible,
  ]);

  const handleTransitionCoverLoad = useCallback(() => {
    setTransitionCoverLoaded(true);
  }, []);

  const handleTransitionCoverError = useCallback(() => {
    setTransitionCoverLoaded(true);
  }, []);

  useEffect(() => {
    if (!visible || !transitionActive || !transitionTargetRect || !transitionCoverLoaded) return;

    transitionAnimation.setValue(0);
    const animation = Animated.timing(transitionAnimation, {
      toValue: 1,
      duration: OPEN_TRANSITION_DURATION_MS,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        setTransitionReady(true);
      }
    });

    return () => {
      animation.stop();
    };
  }, [
    transitionActive,
    transitionAnimation,
    transitionCoverLoaded,
    transitionTargetRect,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !transitionActive || !transitionReady || !viewerContentLoaded) return;
    setTransitionActive(false);
    setControlsVisible(true);
  }, [transitionActive, transitionReady, viewerContentLoaded, visible]);

  useEffect(() => {
    if (!visible || !initialTransitionOrigin || !transitionActive) return;

    const timeout = setTimeout(() => {
      setTransitionActive(false);
      setTransitionReady(true);
      setControlsVisible(true);
    }, OPEN_TRANSITION_FALLBACK_MS);

    return () => clearTimeout(timeout);
  }, [initialTransitionOrigin, transitionActive, visible]);

  const HeaderComponent = useCallback(({ imageIndex }: IndexComponentProps) => {
    const item = items[clampIndex(imageIndex)] ?? null;

    return (
      <>
        {showOpeningTransition && transitionAnimatedStyle && transitionItem ? (
          <View
            testID="image-opening-transition"
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: screenWidth,
              height: screenHeight,
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#000000',
                ...transitionBackdropStyle,
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                overflow: 'hidden',
                backgroundColor: transitionCoverLoaded ? '#000000' : 'transparent',
                ...transitionAnimatedStyle,
              }}
            >
              <Image
                source={{ uri: transitionItem.photoUri }}
                resizeMode="cover"
                fadeDuration={0}
                onLoad={handleTransitionCoverLoad}
                onError={handleTransitionCoverError}
                style={{ width: '100%', height: '100%' }}
              />
            </Animated.View>
          </View>
        ) : null}

        <Animated.View
          testID="image-viewer-header-controls"
          pointerEvents={!showOpeningTransition && controlsVisible ? 'auto' : 'none'}
          style={{
            paddingTop: insets.top + 6,
            minHeight: insets.top + HEADER_HEIGHT,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            ...headerAnimatedStyle,
            opacity: showOpeningTransition ? 0 : headerAnimatedStyle.opacity,
          }}
        >
          <HeaderButton
            icon="close"
            accessibilityLabel="关闭图片查看"
            color={colors.white}
            onPress={onClose}
            restBackgroundColor={colors.heroDecorWeak}
            pressedBackgroundColor={colors.heroDecor}
          />
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.heroEyebrow }}>
              {items.length > 0 ? imageIndex + 1 : 0} / {items.length}
            </Text>
          </View>
          {onEdit && item ? (
            <HeaderButton
              icon="edit"
              accessibilityLabel="编辑图片"
              color={colors.white}
              onPress={() => onEdit(item)}
              restBackgroundColor={colors.heroDecorWeak}
              pressedBackgroundColor={colors.heroDecor}
            />
          ) : <View style={{ width: 40, height: 40 }} />}
        </Animated.View>
      </>
    );
  }, [
    clampIndex,
    controlsVisible,
    colors.heroDecor,
    colors.heroDecorWeak,
    colors.heroEyebrow,
    colors.white,
    headerAnimatedStyle,
    handleTransitionCoverError,
    handleTransitionCoverLoad,
    insets.top,
    items,
    onClose,
    onDelete,
    onEdit,
    screenHeight,
    screenWidth,
    showOpeningTransition,
    transitionAnimatedStyle,
    transitionBackdropStyle,
    transitionCoverLoaded,
    transitionItem,
  ]);

  const FooterComponent = useCallback(({ imageIndex }: IndexComponentProps) => {
    const item = items[clampIndex(imageIndex)] ?? null;
    if (!item) return null;

    return (
      <View
        testID="image-viewer-footer-controls"
        pointerEvents={controlsVisible ? 'box-none' : 'none'}
        style={{
          paddingHorizontal: 16,
          paddingBottom: footerBottomPadding,
          minHeight: COLLAPSED_PILL_HEIGHT + footerBottomPadding,
          alignItems: 'center',
        }}
      >
        {hasDetails && getDetailSummary && renderDetails ? (
          <Animated.View
            style={{
              width: detailsExpanded ? '100%' : undefined,
              minWidth: detailsExpanded ? undefined : 160,
              maxWidth: detailsExpanded ? undefined : '88%',
              height: detailsExpanded ? expandedSheetHeight : undefined,
              maxHeight: detailsExpanded ? expandedSheetHeight : COLLAPSED_PILL_HEIGHT,
              borderRadius: detailsExpanded ? 24 : 999,
              overflow: 'hidden',
              backgroundColor: sheetBackgroundColor,
              borderWidth: 1,
              borderColor: sheetBorderColor,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.24,
              shadowRadius: 22,
              elevation: 10,
              ...footerAnimatedStyle,
              opacity: showOpeningTransition ? 0 : footerAnimatedStyle.opacity,
            }}
          >
            <Pressable
              onPress={() => setDetailsExpanded((expanded) => !expanded)}
              accessibilityLabel={detailsExpanded ? '收起图片信息' : '展开图片信息'}
              accessibilityRole="button"
              style={({ pressed }) => ({
                minHeight: COLLAPSED_PILL_HEIGHT,
                paddingHorizontal: 18,
                paddingVertical: 11,
                opacity: pressed ? 0.82 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              })}
            >
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: '700',
                  color: colors.white,
                }}
              >
                {getDetailSummary(item)}
              </Text>
              <AppIcon
                name="disclosure"
                variant={detailsExpanded ? 'down' : 'up'}
                size={14}
                color={detailLabelColor}
              />
            </Pressable>

            {detailsExpanded ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: insets.bottom + 18,
                }}
              >
                {renderDetails(item)}
              </ScrollView>
            ) : null}
          </Animated.View>
        ) : null}

        {onDelete ? (
          <Animated.View
            testID="image-viewer-delete-action"
            style={{
              ...(detailsExpanded && hasDetails
                ? {
                  width: '100%',
                  height: FOOTER_ACTION_HEIGHT,
                  marginTop: FOOTER_ACTION_GAP,
                  alignItems: 'flex-end' as const,
                }
                : {
                  position: 'absolute' as const,
                  right: 16,
                  bottom: footerBottomPadding,
                }),
              ...footerAnimatedStyle,
              opacity: showOpeningTransition ? 0 : footerAnimatedStyle.opacity,
            }}
          >
            <HeaderButton
              icon="trash"
              accessibilityLabel="删除图片"
              color={colors.danger}
              onPress={() => onDelete(item)}
              restBackgroundColor={colors.dangerSoft}
              pressedBackgroundColor={colors.dangerBorder}
            />
          </Animated.View>
        ) : null}
      </View>
    );
  }, [
    clampIndex,
    controlsVisible,
    colors.danger,
    colors.dangerBorder,
    colors.dangerSoft,
    colors.shadow,
    colors.white,
    detailLabelColor,
    detailsExpanded,
    expandedSheetHeight,
    footerAnimatedStyle,
    footerBottomPadding,
    getDetailSummary,
    hasDetails,
    insets.bottom,
    items,
    onDelete,
    renderDetails,
    sheetBackgroundColor,
    sheetBorderColor,
    showOpeningTransition,
  ]);

  if (!visible || images.length === 0 || !currentItem) {
    return null;
  }

  return (
    <ImageViewing
      images={images}
      imageIndex={initialImageIndex}
      visible={visible}
      onRequestClose={onClose}
      onImageIndexChange={handleImageIndexChange}
      onImageLoad={handleViewerImageLoad}
      imageHidden={showOpeningTransition}
      keyExtractor={(_, index) => items[index]?.id ?? String(index)}
      HeaderComponent={HeaderComponent}
      FooterComponent={hasDetails || onDelete ? FooterComponent : undefined}
      presentationStyle="overFullScreen"
      animationType={initialTransitionOrigin ? 'none' : 'fade'}
      backgroundColor={showOpeningTransition ? 'transparent' : '#000000'}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
    />
  );
}

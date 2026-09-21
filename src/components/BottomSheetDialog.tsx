import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Text,
  BackHandler,
  ActivityIndicator,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/appTheme';
import { getWindowMode } from '../utils/windowMode';
import { ADAPTIVE_GUTTER, READING_MAX_WIDTH } from './adaptive/AppContainers';

interface BottomSheetDialogProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  headerAccessory?: ReactNode;
  scrollable?: boolean;
  snapPoints?: Array<number | string>;
  maxDynamicContentSize?: number;
  maxHeightRatio?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  dismissible?: boolean;
  footer?: ReactNode;
}

/** Shared primary/secondary actions for the fixed sheet footer. */
export function BottomSheetAction({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  accessibilityLabel = label,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const foreground = variant === 'primary' ? colors.onAccent : colors.accent;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      activeOpacity={0.72}
      style={[{
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: variant === 'primary' ? colors.accent : colors.cardAlt,
        opacity: disabled || loading ? 0.5 : 1,
      }, style]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : (
        <Text style={{ fontSize: 16, fontWeight: '800', color: foreground, textAlign: 'center' }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function BottomSheetActionFooter({
  animatedFooterPosition,
  children,
}: BottomSheetFooterProps & { children: ReactNode }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <BottomSheetFooter animatedFooterPosition={animatedFooterPosition} bottomInset={0}>
      <View
        style={{
          paddingHorizontal: ADAPTIVE_GUTTER[getWindowMode(width)],
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: 1,
          borderTopColor: colors.divider,
          backgroundColor: colors.screen,
        }}
      >
        {children}
      </View>
    </BottomSheetFooter>
  );
}

export function BottomSheetDialog({
  visible,
  title,
  onClose,
  children,
  headerAccessory,
  scrollable = true,
  snapPoints,
  maxDynamicContentSize,
  maxHeightRatio = 0.82,
  contentContainerStyle,
  dismissible = true,
  footer,
}: BottomSheetDialogProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width } = useWindowDimensions();
  const sheetModalRef = useRef<BottomSheetModal>(null);
  const wasVisibleRef = useRef(false);
  const dismissedInternallyRef = useRef(false);
  const hiddenByParentRef = useRef(false);

  const resolvedMaxDynamicContentSize = useMemo(() => {
    if (maxDynamicContentSize != null) return maxDynamicContentSize;
    const availableHeight = Math.max(0, windowHeight - insets.top - 24);
    return Math.min(availableHeight, Math.max(320, Math.floor(windowHeight * maxHeightRatio)));
  }, [insets.top, maxDynamicContentSize, maxHeightRatio, windowHeight]);

  useEffect(() => {
    if (visible) {
      hiddenByParentRef.current = false;
      dismissedInternallyRef.current = false;
      sheetModalRef.current?.present();
    } else if (wasVisibleRef.current && !dismissedInternallyRef.current) {
      hiddenByParentRef.current = true;
      sheetModalRef.current?.dismiss();
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissible) sheetModalRef.current?.dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [dismissible, visible]);

  const handleDismiss = () => {
    const shouldNotifyClose = !hiddenByParentRef.current;
    hiddenByParentRef.current = false;
    dismissedInternallyRef.current = true;
    wasVisibleRef.current = false;
    if (shouldNotifyClose) onClose();
  };

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.82}
      pressBehavior={dismissible ? 'close' : 'none'}
      style={{ backgroundColor: colors.scrim }}
    />
  );

  const renderFooter = useCallback((props: BottomSheetFooterProps) => (
    <BottomSheetActionFooter {...props}>{footer}</BottomSheetActionFooter>
  ), [footer]);

  const header = (
    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <Text style={{ flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '800', color: colors.heading }}>
        {title}
      </Text>
      {headerAccessory}

    </View>
  );

  return (
    <BottomSheetModal
      ref={sheetModalRef}
      enableDynamicSizing={!snapPoints}
      snapPoints={snapPoints}
      enableDismissOnClose
      enablePanDownToClose={dismissible}
      maxDynamicContentSize={snapPoints ? undefined : resolvedMaxDynamicContentSize}
      // Let the sheet background extend through the system safe area. The
      // content wrapper below owns the inset padding so the bottom never
      // becomes a transparent strip.
      bottomInset={0}
      style={{ marginHorizontal: Math.max(0, (width - READING_MAX_WIDTH) / 2) }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      footerComponent={footer ? renderFooter : undefined}
      backgroundStyle={{
        backgroundColor: colors.screen,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.inputBorder,
      }}
      onDismiss={handleDismiss}
    >
      {scrollable ? (
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableFooterMarginAdjustment={Boolean(footer)}
          contentContainerStyle={[{ paddingHorizontal: ADAPTIVE_GUTTER[getWindowMode(width)], paddingTop: 8, paddingBottom: 12 }, contentContainerStyle]}
        >
          <View style={{ paddingBottom: footer ? 0 : insets.bottom }}>
            {header}
            {children}
          </View>
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          enableFooterMarginAdjustment={Boolean(footer)}
          style={[{ paddingHorizontal: ADAPTIVE_GUTTER[getWindowMode(width)], paddingTop: 8, paddingBottom: 12 }, contentContainerStyle]}
        >
          <View style={{ paddingBottom: footer ? 0 : insets.bottom }}>
            {header}
            {children}
          </View>
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

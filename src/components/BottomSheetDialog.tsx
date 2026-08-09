import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';

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
  enablePanDownToClose?: boolean;
}

export function BottomSheetDialog({
  visible,
  title,
  onClose,
  children,
  headerAccessory,
  scrollable = false,
  snapPoints,
  maxDynamicContentSize,
  maxHeightRatio = 0.82,
  contentContainerStyle,
  enablePanDownToClose = true,
}: BottomSheetDialogProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetModalRef = useRef<BottomSheetModal>(null);
  const wasVisibleRef = useRef(false);
  const dismissedInternallyRef = useRef(false);
  const hiddenByParentRef = useRef(false);

  const resolvedMaxDynamicContentSize = useMemo(() => {
    if (maxDynamicContentSize != null) return maxDynamicContentSize;
    const availableHeight = Math.max(320, windowHeight - insets.top - 24);
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
      pressBehavior="close"
      style={{ backgroundColor: colors.scrim }}
    />
  );

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <Text style={{ flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '800', color: colors.heading }}>
        {title}
      </Text>
      {headerAccessory}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => sheetModalRef.current?.dismiss()}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.cardAlt,
          marginLeft: headerAccessory ? 10 : 0,
        }}
      >
        <AppIcon name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheetModal
      ref={sheetModalRef}
      enableDynamicSizing={!snapPoints}
      snapPoints={snapPoints}
      enableDismissOnClose
      enablePanDownToClose={enablePanDownToClose}
      maxDynamicContentSize={snapPoints ? undefined : resolvedMaxDynamicContentSize}
      // Let the sheet background extend through the system safe area. The
      // content wrapper below owns the inset padding so the bottom never
      // becomes a transparent strip.
      bottomInset={0}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
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
          contentContainerStyle={contentContainerStyle}
        >
          <View style={{ paddingBottom: insets.bottom }}>
            {header}
            {children}
          </View>
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={contentContainerStyle}>
          <View style={{ paddingBottom: insets.bottom }}>
            {header}
            {children}
          </View>
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

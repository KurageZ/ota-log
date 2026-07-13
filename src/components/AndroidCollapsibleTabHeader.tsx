import { ReactNode, useCallback } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/appTheme';
import { useFloatingTabBarScroll } from '../navigation/FloatingTabBarVisibility';
import { withAlpha } from '../utils/color';

export function useAndroidCollapsibleTabHeader() {
  const insets = useSafeAreaInsets();
  const titleScrollY = useSharedValue(0);

  const handleTitleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      titleScrollY.value = Math.max(event.nativeEvent.contentOffset.y, 0);
    },
    [titleScrollY],
  );

  const scrollProps = useFloatingTabBarScroll({
    onScroll: handleTitleScroll,
    topRevealOffset: 8,
  });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleScrollY.value, [0, 24, 72], [1, 0.72, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(titleScrollY.value, [0, 72], [0, -18], Extrapolation.CLAMP),
      },
    ],
  }));

  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleScrollY.value, [0, 28, 88], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(titleScrollY.value, [0, 88], [-10, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  return {
    compactHeaderStyle,
    contentTopPadding: insets.top + 18,
    largeTitleStyle,
    overlayHeight: insets.top + 50,
    overlayPaddingTop: insets.top + 8,
    scrollProps,
  };
}

export function AndroidCompactTabHeader({
  title,
  right,
  compactHeaderStyle,
  overlayHeight,
  overlayPaddingTop,
}: {
  title: string;
  right?: ReactNode;
  compactHeaderStyle: ReturnType<typeof useAnimatedStyle>;
  overlayHeight: number;
  overlayPaddingTop: number;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: overlayHeight,
          paddingTop: overlayPaddingTop,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: withAlpha(colors.screen, isDark ? 0.94 : 0.9),
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          zIndex: 10,
        },
        compactHeaderStyle,
      ]}
    >
      <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.heading }}>
        {title}
      </Text>
      {right}
    </Animated.View>
  );
}

export function AndroidLargeTabTitle({
  title,
  right,
  largeTitleStyle,
}: {
  title: string;
  right?: ReactNode;
  largeTitleStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  const { colors } = useAppTheme();

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        },
        largeTitleStyle,
      ]}
    >
      <Text style={{ fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, color: colors.heading }}>
        {title}
      </Text>
      {right}
    </Animated.View>
  );
}

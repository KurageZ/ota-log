import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { FLOATING_TAB_BAR_HORIZONTAL_MARGIN, useFloatingTabBarSpacing } from './floatingTabBar';
import { useFloatingTabBarVisibility } from './FloatingTabBarVisibility';

const SHELL_PADDING_HORIZONTAL = 6;
const SHELL_BORDER_WIDTH = 1;
const ACTIVE_PILL_HEIGHT = 58;
const ACTIVE_PILL_BORDER_RADIUS = ACTIVE_PILL_HEIGHT / 2;
const ACTIVE_PILL_SIDE_INSET = 4;
const TAB_LABEL_FONT_SIZE = 10.5;
const TAB_LABEL_LINE_HEIGHT = 13;

function canUseLiquidGlass(reduceTransparency: boolean) {
  if (Platform.OS !== 'ios' || reduceTransparency) return false;

  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}


function resolveLabel(options: BottomTabBarProps['descriptors'][string]['options'], fallback: string) {
  if (typeof options.tabBarLabel === 'string') return options.tabBarLabel;
  if (typeof options.title === 'string') return options.title;
  return fallback;
}

function TabIcon({ name, color, focused }: { name: AppIconName; color: string; focused: boolean }) {
  return <AppIcon name={name} variant={focused ? 'active' : 'inactive'} size={19} color={color} />;
}

function FloatingTabBarItem({
  isFocused,
  accessibilityLabel,
  selectedIndex,
  routeIndex,
  activeIcon,
  label,
  accent,
  inactiveTint,
  onLongPress,
  onPress,
}: {
  isFocused: boolean;
  accessibilityLabel: string;
  selectedIndex: SharedValue<number>;
  routeIndex: number;
  activeIcon: AppIconName;
  label: string;
  accent: string;
  inactiveTint: string;
  onLongPress: () => void;
  onPress: () => void;
}) {
  const iconStyle = useAnimatedStyle(() => {
    const focusProgress = interpolate(
      selectedIndex.value,
      [routeIndex - 1, routeIndex, routeIndex + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { scale: interpolate(focusProgress, [0, 1], [1, 1.08]) },
      ],
    };
  }, [routeIndex]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        onLongPress={onLongPress}
        onPress={onPress}
        style={{
          width: '100%',
          height: ACTIVE_PILL_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <Animated.View style={iconStyle}>
          <TabIcon name={activeIcon} color={isFocused ? accent : inactiveTint} focused={isFocused} />
        </Animated.View>
        <Text
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.1}
          minimumFontScale={0.85}
          numberOfLines={1}
          style={{
            color: isFocused ? accent : inactiveTint,
            fontSize: TAB_LABEL_FONT_SIZE,
            fontWeight: isFocused ? '700' : '500',
            lineHeight: TAB_LABEL_LINE_HEIGHT,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export function CustomFloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { barHeight, bottomOffset, safeBottom } = useFloatingTabBarSpacing();
  const { isHidden } = useFloatingTabBarVisibility();
  const [containerWidth, setContainerWidth] = useState(0);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const hiddenProgress = useSharedValue(0);
  const usesLiquidGlass = canUseLiquidGlass(reduceTransparency);
  const focusedVisibleIndex = Math.max(
    0,
    state.routes.findIndex((route) => route.key === state.routes[state.index]?.key),
  );
  const selectedIndex = useSharedValue(focusedVisibleIndex);

  useEffect(() => {
    hiddenProgress.value = withSpring(isHidden ? 1 : 0, {
      damping: 24,
      stiffness: 240,
      mass: 0.9,
    });
  }, [hiddenProgress, isHidden]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let isActive = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((isEnabled) => {
      if (isActive) setReduceTransparency(isEnabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    selectedIndex.value = withSpring(focusedVisibleIndex, {
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    });
  }, [focusedVisibleIndex, selectedIndex]);

  const slotWidth = containerWidth > 0
    ? (containerWidth - SHELL_PADDING_HORIZONTAL * 2) / state.routes.length
    : 0;
  const shellHeight = barHeight - safeBottom;
  const shellBottomOffset = safeBottom + bottomOffset;
  const shellBorderRadius = shellHeight / 2;
  const shellPaddingTop = 0;
  const shellPaddingBottom = 0;
  const pillWidth = slotWidth > 0 ? Math.max(0, slotWidth - ACTIVE_PILL_SIDE_INSET * 2) : 0;
  const activePillVerticalInset = usesLiquidGlass
    ? Math.max(0, (shellHeight - ACTIVE_PILL_HEIGHT) / 2)
    : Math.max(0, (shellHeight - ACTIVE_PILL_HEIGHT - SHELL_BORDER_WIDTH * 2) / 2);
  const shellWidth = Math.max(
    0,
    screenWidth - FLOATING_TAB_BAR_HORIZONTAL_MARGIN * 2,
  );

  const shellStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: FLOATING_TAB_BAR_HORIZONTAL_MARGIN,
    bottom: shellBottomOffset,
    width: shellWidth,
    height: shellHeight,
    paddingTop: shellPaddingTop,
    paddingBottom: shellPaddingBottom,
    paddingHorizontal: SHELL_PADDING_HORIZONTAL,
    borderRadius: shellBorderRadius,
    borderWidth: SHELL_BORDER_WIDTH,
    borderColor: withAlpha(colors.tabBarBorder, usesLiquidGlass ? 0.42 : 0.68),
    backgroundColor: usesLiquidGlass
      ? withAlpha(colors.tabBar, 0.1)
      : withAlpha(colors.tabBar, isDark ? 0.9 : 0.86),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    overflow: 'hidden' as const,
    boxShadow: `0 ${isDark ? 12 : 10}px ${isDark ? 30 : 24}px ${withAlpha(colors.shadow, isDark ? 0.28 : 0.1)}`,
  }), [colors.shadow, colors.tabBar, colors.tabBarBorder, isDark, shellBorderRadius, shellBottomOffset, shellHeight, shellPaddingBottom, shellPaddingTop, shellWidth, usesLiquidGlass]);

  const shellAnimatedStyle = useAnimatedStyle(() => ({
    opacity: usesLiquidGlass
      ? 1
      : interpolate(hiddenProgress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          hiddenProgress.value,
          [0, 1],
          [0, shellHeight + shellBottomOffset + 18],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }), [shellBottomOffset, shellHeight, usesLiquidGlass]);

  const activePillStyle = useAnimatedStyle(() => {
    if (!slotWidth || !pillWidth) {
      return {
        opacity: 0,
      };
    }

    const translateX = SHELL_PADDING_HORIZONTAL
      + slotWidth * selectedIndex.value
      + (slotWidth - pillWidth) / 2;

    return {
      opacity: 1,
      transform: [{ translateX }],
    };
  }, [pillWidth, slotWidth]);

  const shellContent = (
    <>
      {slotWidth > 0 && pillWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: activePillVerticalInset,
              bottom: usesLiquidGlass ? activePillVerticalInset : undefined,
              left: 0,
              width: pillWidth,
              height: usesLiquidGlass ? undefined : ACTIVE_PILL_HEIGHT,
              borderRadius: ACTIVE_PILL_BORDER_RADIUS,
              borderWidth: usesLiquidGlass ? 1 : 0,
              borderColor: usesLiquidGlass ? withAlpha(colors.accent, isDark ? 0.2 : 0.16) : 'transparent',
              backgroundColor: isDark ? withAlpha(colors.accent, 0.1) : withAlpha(colors.accent, 0.07),
            },
            activePillStyle,
          ]}
        />
      ) : null}

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const isFocused = state.routes[state.index]?.key === route.key;
          const label = resolveLabel(options, route.name);
          const accessibilityLabel = options.tabBarAccessibilityLabel ?? label;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const iconMap: Record<string, AppIconName> = {
            '(home)': 'home',
            calendar: 'calendar',
            cheki: 'cheki',
            stats: 'stats',
            profile: 'profile',
          };

          const icon = iconMap[route.name] ?? 'add';

          return (
            <FloatingTabBarItem
              key={route.key}
              accessibilityLabel={accessibilityLabel}
              accent={colors.accent}
              activeIcon={icon}
              inactiveTint={colors.tabBarInactive}
              isFocused={isFocused}
              label={label}
              onLongPress={onLongPress}
              onPress={onPress}
              routeIndex={index}
              selectedIndex={selectedIndex}
            />
          );
        })}
      </View>
    </>
  );

  return (
    <Animated.View
      pointerEvents={isHidden ? 'none' : 'auto'}
      style={shellAnimatedStyle}
    >
      <View
        onLayout={(event) => {
          setContainerWidth(event.nativeEvent.layout.width);
        }}
        style={shellStyle}
      >
        {usesLiquidGlass ? (
          <GlassView
            colorScheme={isDark ? 'dark' : 'light'}
            glassEffectStyle="regular"
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderRadius: shellBorderRadius }]}
            tintColor={withAlpha(colors.tabBar, 0.32)}
          />
        ) : null}
        {shellContent}
      </View>
    </Animated.View>
  );
}

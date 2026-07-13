import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  pressedOpacity?: number;
  disabledOpacity?: number;
}

export function AnimatedPressable({
  children,
  disabled,
  disabledOpacity = 0.5,
  onPressIn,
  onPressOut,
  pressedOpacity = 0.76,
  pressedScale = 0.97,
  style,
  ...rest
}: AnimatedPressableProps) {
  const progress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled ? disabledOpacity : 1 - progress.value * (1 - pressedOpacity),
    transform: [{ scale: 1 - progress.value * (1 - pressedScale) }],
  }));

  return (
    <ReanimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        progress.value = withTiming(1, {
          duration: 70,
          easing: Easing.out(Easing.quad),
        });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.value = withTiming(0, {
          duration: 120,
          easing: Easing.out(Easing.cubic),
        });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </ReanimatedPressable>
  );
}

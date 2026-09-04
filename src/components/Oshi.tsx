import { useEffect, useRef, useState } from 'react';
import { Animated, ColorValue, Easing, Image, ImageSourcePropType, LayoutChangeEvent, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';
import { getArtistAvatarFallback } from '../utils/artistDisplay';

function AvatarContent({
  source,
  size,
  radius,
  fallbackText,
  fallbackFontSize,
  textColor,
  iconSize,
  imageLoadFailed,
  onImageError,
}: {
  source: ImageSourcePropType | null;
  size: number;
  radius: number;
  fallbackText: string | null;
  fallbackFontSize: number;
  textColor: ColorValue;
  iconSize: number;
  imageLoadFailed: boolean;
  onImageError: () => void;
}) {
  if (source && !imageLoadFailed) {
    return (
      <Image
        source={source}
        onError={onImageError}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  if (fallbackText) {
    return (
      <Text
        numberOfLines={1}
        style={{ fontSize: fallbackFontSize, lineHeight: size, fontWeight: '700', color: textColor }}
      >
        {fallbackText}
      </Text>
    );
  }

  return <AppIcon name="artist" size={iconSize} color={textColor} />;
}

export function OshiBadge({ inverted = false }: { inverted?: boolean }) {
  const { colors } = useAppTheme();

  return (
    <View style={{
      height: 18,
      borderRadius: 99,
      paddingHorizontal: 7,
      backgroundColor: inverted ? colors.oshiBadgeBgInverted : colors.oshiBadgeBg,
      borderWidth: inverted ? 1.5 : 0,
      borderColor: colors.oshiBadgeBorder,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    }}>
      <Text style={{
        color: inverted ? colors.oshiBadgeTextInverted : colors.oshiBadgeText,
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '700',
      }}>
        单推
      </Text>
    </View>
  );
}

export function OshiMatchBadge({
  oshiArtistName,
  style,
  outerHeight,
}: {
  oshiArtistName: string;
  style?: ViewStyle;
  outerHeight?: number;
}) {
  const { colors } = useAppTheme();
  const rotateValue = useRef(new Animated.Value(0)).current;
  // innerLayout measures the inner content view; outer = inner + 2*1.5px margin
  const [innerLayout, setInnerLayout] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    rotateValue.setValue(0);
    const animation = Animated.loop(
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotateValue]);

  const rotate = rotateValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Size the gradient as a square whose diagonal equals the badge diagonal,
  // so the full color spectrum is visible across the ring and coverage is
  // guaranteed at any rotation angle.
  const outerW = innerLayout ? innerLayout.w + 3 : 0;
  const outerH = outerHeight ?? (innerLayout ? innerLayout.h + 3 : 0);
  const sqSide = Math.ceil(Math.sqrt(outerW * outerW + outerH * outerH));
  const gradOffset = (n: number, sq: number) => (n - sq) / 2;

  const onInnerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setInnerLayout(prev =>
      prev && prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  };

  return (
    <View style={[{
      alignSelf: 'flex-start',
      height: outerHeight,
      borderRadius: 999,
      overflow: 'hidden',
    }, style]}>
      {innerLayout && (
        <Animated.View style={{
          position: 'absolute',
          width: sqSide,
          height: sqSide,
          top: gradOffset(outerH, sqSide),
          left: gradOffset(outerW, sqSide),
          transform: [{ rotate }],
        }}>
          <LinearGradient
            colors={colors.oshiGradient}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
      <View
        onLayout={onInnerLayout}
        style={{
          flex: outerHeight ? 1 : undefined,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 999,
          paddingHorizontal: 9,
          paddingVertical: outerHeight ? 0 : 5,
          margin: 1.5,
          backgroundColor: colors.card,
        }}
      >
        <Text
          style={{ fontSize: 11.5, lineHeight: 13, fontWeight: '700', color: colors.accentText }}
          numberOfLines={1}
        >
          {oshiArtistName} 参演
        </Text>
      </View>
    </View>
  );
}

export function OshiAvatar({
  source,
  size,
  isOshi,
  name,
}: {
  source: ImageSourcePropType | null;
  size: number;
  isOshi: boolean;
  /** 关联艺人的显示名；缺少头像或图片加载失败时显示首个字素 */
  name?: string | null;
}) {
  const { colors } = useAppTheme();
  const ringWidth = isOshi ? Math.max(2, Math.round(size * 0.05)) : 0;
  const innerSize = isOshi ? size - ringWidth * 2 : size;
  const radius = size / 2;
  const fallbackFontSize = Math.max(11, Math.round(size * 0.38));
  const fallbackText = getArtistAvatarFallback(name);
  const sourceKey = source == null ? null : JSON.stringify(source);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const rotateValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setImageLoadFailed(false);
  }, [sourceKey]);

  useEffect(() => {
    if (!isOshi) return undefined;

    rotateValue.setValue(0);
    const animation = Animated.loop(
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [isOshi, rotateValue]);

  if (!isOshi) {
    return (
      <View style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.oshiAvatarBg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <AvatarContent
          source={source}
          size={size}
          radius={radius}
          fallbackText={fallbackText}
          fallbackFontSize={fallbackFontSize}
          textColor={colors.textSecondary}
          iconSize={Math.round(size * 0.45)}
          imageLoadFailed={imageLoadFailed}
          onImageError={() => setImageLoadFailed(true)}
        />
      </View>
    );
  }

  const rotate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ width: size, height: size, position: 'relative', overflow: 'visible' }}>
      <Animated.View style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        transform: [{ rotate }],
      }}>
        <LinearGradient
          colors={colors.oshiGradient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ width: size, height: size }}
        />
      </Animated.View>
      <View style={{
        position: 'absolute',
        left: ringWidth,
        top: ringWidth,
        width: innerSize,
        height: innerSize,
        borderRadius: innerSize / 2,
        backgroundColor: colors.oshiAvatarBg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <AvatarContent
          source={source}
          size={innerSize}
          radius={innerSize / 2}
          fallbackText={fallbackText}
          fallbackFontSize={fallbackFontSize}
          textColor={colors.textSecondary}
          iconSize={Math.round(size * 0.38)}
          imageLoadFailed={imageLoadFailed}
          onImageError={() => setImageLoadFailed(true)}
        />
      </View>
      <View style={{
        position: 'absolute',
        top: -3,
        right: -3,
        width: Math.max(14, Math.round(size * 0.36)),
        height: Math.max(14, Math.round(size * 0.36)),
        borderRadius: Math.max(7, Math.round(size * 0.18)),
        backgroundColor: colors.oshiHeartBg,
        borderWidth: 1.5,
        borderColor: colors.oshiHeartBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <AppIcon name="oshi" size={Math.max(8, Math.round(size * 0.2))} color={colors.white} />
      </View>
    </View>
  );
}

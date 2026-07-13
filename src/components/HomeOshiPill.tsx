import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';

export function HomeOshiPill({
  label,
  tone = 'card',
}: {
  label: string;
  tone?: 'card' | 'hero';
}) {
  const { colors } = useAppTheme();
  const isHero = tone === 'hero';

  if (!isHero) {
    return (
      <View style={{ alignSelf: 'flex-start', borderRadius: 999, overflow: 'hidden' }}>
        <LinearGradient
          colors={colors.oshiGradient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ borderRadius: 999, padding: 1.5 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              borderRadius: 999,
              paddingLeft: 6,
              paddingRight: 8,
              paddingVertical: 3,
              backgroundColor: colors.card,
            }}
          >
            <AppIcon
              name="oshi"
              size={9.5}
              color={colors.oshiHeartBg}
            />
            <Text
              style={{
                fontSize: 10,
                lineHeight: 11,
                fontWeight: '700',
                color: colors.accentText,
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 5,
        backgroundColor: colors.heroCalloutBg,
        borderWidth: 1,
        borderColor: colors.heroCalloutBorder,
      }}
    >
      <AppIcon
        name="oshi"
        size={10}
        color={colors.heroSubtext}
      />
      <Text
        style={{
          fontSize: 11.5,
          lineHeight: 13.5,
          fontWeight: '700',
          color: colors.heroSubtext,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

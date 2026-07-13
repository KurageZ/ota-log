import { ReactNode } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon, type AppIconName } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';

export type MenuBadge = number | string | 'spinner';

export function SectionLabel({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          paddingLeft: 2,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 3,
          height: 16,
          borderRadius: 999,
          backgroundColor: colors.accent,
        }}
      />
      <Text
        style={{
          fontSize: 17,
          lineHeight: 35,
          fontWeight: '500',
          color: colors.heading,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function MenuCard({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

export function MenuItem({
  icon,
  label,
  subtitle,
  badge,
  onPress,
  tint,
  isLast = false,
  disabled = false,
}: {
  icon: AppIconName;
  label: string;
  subtitle?: string;
  badge?: MenuBadge;
  onPress: () => void;
  tint?: string;
  isLast?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const resolvedTint = tint ?? colors.accent;

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: subtitle ? 13 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.divider,
        opacity: disabled ? 0.5 : 1,
      }}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.6}
      disabled={disabled}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: `${resolvedTint}22`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <AppIcon name={icon} size={18} color={resolvedTint} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {badge === 'spinner' ? (
        <View style={{ marginRight: 8 }}>
          <ActivityIndicator size="small" color={resolvedTint} />
        </View>
      ) : null}

      {badge != null && badge !== 'spinner' && !(typeof badge === 'number' && badge <= 0) ? (
        <View
          style={{
            borderRadius: 99,
            backgroundColor: `${resolvedTint}20`,
            paddingHorizontal: 8,
            paddingVertical: 2,
            marginLeft: 8,
            marginRight: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: resolvedTint }}>{badge}</Text>
        </View>
      ) : null}

      <AppIcon name="disclosure" variant="forward" size={16} color={colors.chevron} />
    </TouchableOpacity>
  );
}

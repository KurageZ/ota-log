import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon, type AppIconName } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';

export type MenuBadge = number | string | 'spinner';

/** 行分隔线：左侧与文字平齐（跳过 icon），右侧不触达卡片边界。 */
export function MenuRowSeparator({ leadingInset = 62 }: { leadingInset?: number }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.divider,
        marginLeft: leadingInset,
        marginRight: 16,
      }}
    />
  );
}

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
        accessibilityRole="header"
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

export function MenuCard({ children, testID }: { children: ReactNode; testID?: string }) {
  const { colors } = useAppTheme();

  return (
    <View
      testID={testID}
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

/** 菜单行 / 卡片头部左侧的图标底块：34x34、主题 tint 半透明底。 */
export function MenuIconTile({
  tint,
  name,
  size = 18,
  style,
}: {
  tint: string;
  name: AppIconName;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: `${tint}22`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        style,
      ]}
    >
      <AppIcon name={name} size={size} color={tint} />
    </View>
  );
}

export function MenuItem({
  icon,
  label,
  accessibilityLabel,
  subtitle,
  badge,
  onPress,
  tint,
  isLast = false,
  disabled = false,
}: {
  icon: AppIconName;
  label: string;
  accessibilityLabel?: string;
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
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: subtitle ? 13 : 14,
          opacity: disabled ? 0.5 : 1,
        }}
        onPress={onPress}
        activeOpacity={disabled ? 1 : 0.6}
        disabled={disabled}
      >
        <MenuIconTile tint={resolvedTint} name={icon} />

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

      {!isLast ? <MenuRowSeparator /> : null}
    </View>
  );
}

/** 独立单选页的选项卡片：label + 可选描述 + radio，保存中显示 spinner。 */
export function SettingsChoiceCard<T extends string>({
  options,
  value,
  pending,
  labelOf,
  descriptionOf,
  leadingColorOf,
  onSelect,
}: {
  options: readonly T[];
  value: T;
  pending: T | null;
  labelOf: (option: T) => string;
  descriptionOf?: (option: T) => string | undefined;
  leadingColorOf?: (option: T) => string | undefined;
  onSelect: (option: T) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <MenuCard>
      {options.map((option, index) => {
        const selected = (pending ?? value) === option;
        const description = descriptionOf?.(option);
        const leadingColor = leadingColorOf?.(option);
        const isLast = index === options.length - 1;

        return (
          <View key={option}>
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: pending !== null }}
              activeOpacity={0.7}
              disabled={pending !== null}
              onPress={() => onSelect(option)}
              style={{
                minHeight: description ? 64 : 52,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 11,
                opacity: pending ? 0.7 : 1,
              }}
            >
              {leadingColor ? (
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: leadingColor,
                    marginRight: 12,
                  }}
                />
              ) : null}
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    fontWeight: selected ? '700' : '500',
                  }}
                >
                  {labelOf(option)}
                </Text>
                {description ? (
                  <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                    {description}
                  </Text>
                ) : null}
              </View>
              {pending === option ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <AppIcon
                  name="radio"
                  variant={selected ? 'selected' : 'unselected'}
                  size={18}
                  color={selected ? colors.accent : colors.chevron}
                  secondaryColor={colors.onAccent}
                />
              )}
            </TouchableOpacity>
            {!isLast ? <MenuRowSeparator leadingInset={16} /> : null}
          </View>
        );
      })}
    </MenuCard>
  );
}

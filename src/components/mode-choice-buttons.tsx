import { Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '../theme/appTheme';
import { AppIcon, type AppIconName } from './AppIcon';

export type ModeChoiceOption<T extends string> = {
  value: T;
  label: string;
  icon: AppIconName;
};

export function ModeChoiceButtons<T extends string>({
  colors,
  options,
  value,
  onChange,
}: {
  colors: ThemeColors;
  options: ReadonlyArray<ModeChoiceOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.72}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 56,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? colors.accent : colors.inputBorder,
              backgroundColor: selected ? colors.accentSofter : colors.card,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.accent : colors.cardAlt,
                }}
              >
                <AppIcon
                  name={option.icon}
                  size={17}
                  color={selected ? colors.onAccent : colors.textSecondary}
                />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 20,
                  fontWeight: '800',
                  color: colors.heading,
                }}
              >
                {option.label}
              </Text>
              <AppIcon
                name="radio"
                variant={selected ? 'selected' : 'unselected'}
                size={18}
                color={selected ? colors.accent : colors.textMuted}
                secondaryColor={colors.card}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

import { Text, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../theme/appTheme';

interface Props {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}

export function FilterBatchChip({ label, selected, disabled, onPress }: Props) {
  const { colors, isDark } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 99,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.accent : isDark ? colors.input : colors.cardAlt,
        borderColor: selected ? colors.accent : colors.inputBorder,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? colors.onAccent : colors.textSecondary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

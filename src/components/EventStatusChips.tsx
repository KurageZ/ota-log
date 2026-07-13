import { View, Text, TouchableOpacity } from 'react-native';
import { EventStatus } from '../types/models';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { AppIcon, type AppIconName } from './AppIcon';

type StatusOption = {
  value: EventStatus;
  label: string;
  icon: AppIconName;
};

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'planned',
    label: '计划中',
    icon: 'statusPlanned',
  },
  {
    value: 'wishlist',
    label: '心愿单',
    icon: 'statusWishlist',
  },
  {
    value: 'completed',
    label: '已完成',
    icon: 'statusCompleted',
  },
  {
    value: 'cancelled',
    label: '已取消',
    icon: 'statusCancelled',
  },
];

interface EventStatusChipsProps {
  value: EventStatus;
  onChange: (value: EventStatus) => void;
  isDark: boolean;
}

export function EventStatusChips({ value, onChange, isDark }: EventStatusChipsProps) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {STATUS_OPTIONS.map((option) => {
        const active = option.value === value;
        const statusColors = colors.status[option.value];
        const foregroundColor = active
          ? statusColors.accent
          : colors.textMuted;

        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.78}
            style={{
              flex: 1,
              height: 36,
              paddingHorizontal: 6,
              borderRadius: 99,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 3,
              backgroundColor: active
                ? withAlpha(statusColors.accent, 0.18)
                : isDark ? colors.input : colors.cardAlt,
              borderWidth: 1.5,
              borderColor: active
                ? statusColors.accent
                : colors.inputBorder,
            }}
          >
            <AppIcon name={option.icon} size={12} color={foregroundColor} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: foregroundColor }}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

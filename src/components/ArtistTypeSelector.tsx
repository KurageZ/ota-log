import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ArtistType } from '../types/models';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';

const OPTIONS: Array<{ value: ArtistType | null; label: string }> = [
  { value: null, label: '未设置' },
  { value: 'person', label: '个人' },
  { value: 'group', label: '团体' },
];

export function ArtistTypeSelector({
  value,
  onChange,
}: {
  value: ArtistType | null;
  onChange: (value: ArtistType | null) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}${selected ? '，已选择' : ''}`}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 10,
                flexDirection: 'row',
                gap: 6,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.inputBorder,
                backgroundColor: selected ? colors.accentSoft : colors.input,
              }}
            >
              <AppIcon
                name="checkbox"
                variant={selected ? 'selected' : 'unselected'}
                size={16}
                color={selected ? colors.accent : colors.textMuted}
              />
              <Text style={{ color: selected ? colors.accent : colors.textSecondary, fontWeight: '700' }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ marginTop: 10, color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
        设置为个人或团体后，可记录多团体履历、成员时间，并按在团日期关联活动。没有这些需要时可以保持未设置。
      </Text>
    </View>
  );
}

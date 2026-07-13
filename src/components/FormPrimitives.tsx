import { ReactNode } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/appTheme';

export function FormSectionLabel({ label }: { label: string }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        paddingLeft: 2,
      }}
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

export function FormCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function FormFieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  const { colors } = useAppTheme();

  return (
    <Text
      style={{
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
      }}
    >
      {children}
      {required ? ' *' : null}
    </Text>
  );
}

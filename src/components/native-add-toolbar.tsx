import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { getAppIconSFSymbol } from './AppIcon';

export function NativeAddToolbar({
  accessibilityLabel,
  onPress,
  leading,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  leading?: ReactNode;
}) {
  return (
    <Stack.Toolbar placement="right">
      {leading}
      {leading ? <Stack.Toolbar.Spacer width={8} /> : null}
      <Stack.Toolbar.Button
        accessibilityLabel={accessibilityLabel}
        icon={getAppIconSFSymbol('add')}
        onPress={onPress}
        separateBackground
      />
    </Stack.Toolbar>
  );
}

import { Stack } from 'expo-router';
import { getAppIconSFSymbol } from './AppIcon';

export function NativeAddToolbar({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        accessibilityLabel={accessibilityLabel}
        icon={getAppIconSFSymbol('add')}
        onPress={onPress}
        separateBackground
      />
    </Stack.Toolbar>
  );
}

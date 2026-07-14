import { Stack } from 'expo-router';
import { ColorValue, Platform } from 'react-native';

type NativeTextToolbarAction = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  tintColor?: ColorValue;
  variant?: 'plain' | 'done' | 'prominent';
};

export function NativeTextToolbar({
  left,
  right,
}: {
  left?: NativeTextToolbarAction;
  right?: NativeTextToolbarAction;
}) {
  if (Platform.OS !== 'ios') return null;

  return (
    <>
      {left ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel={left.accessibilityLabel ?? left.label}
            disabled={left.disabled}
            onPress={left.onPress}
            tintColor={left.tintColor}
            variant={left.variant}
          >
            {left.label}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      {right ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={right.accessibilityLabel ?? right.label}
            disabled={right.disabled}
            onPress={right.onPress}
            tintColor={right.tintColor}
            variant={right.variant}
          >
            {right.label}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

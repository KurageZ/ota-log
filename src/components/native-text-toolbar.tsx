import { Stack } from 'expo-router';
import { ColorValue, Platform } from 'react-native';
import { getAppIconSFSymbol, type AppIconName } from './AppIcon';

type NativeTextToolbarAction = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  tintColor?: ColorValue;
  variant?: 'plain' | 'done' | 'prominent';
  icon?: AppIconName;
  separateBackground?: boolean;
};

export function NativeTextToolbar({
  left,
  right,
}: {
  left?: NativeTextToolbarAction;
  right?: NativeTextToolbarAction | NativeTextToolbarAction[];
}) {
  if (Platform.OS !== 'ios') return null;

  const rightActions = right ? (Array.isArray(right) ? right : [right]) : [];

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
          {rightActions.map((action) => (
            <Stack.Toolbar.Button
              key={`${action.label}-${action.icon ?? 'text'}`}
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              disabled={action.disabled}
              icon={action.icon ? getAppIconSFSymbol(action.icon) : undefined}
              onPress={action.onPress}
              separateBackground={action.separateBackground}
              tintColor={action.tintColor}
              variant={action.variant}
            >
              {action.icon ? undefined : action.label}
            </Stack.Toolbar.Button>
          ))}
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

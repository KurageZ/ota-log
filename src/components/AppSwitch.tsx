import { Switch, type SwitchProps } from 'react-native';
import { hapticToggle } from '../utils/haptics';

/**
 * Shared switch with a lightweight platform-appropriate haptic on user toggles.
 * The system setting is respected automatically on iOS/Android; the haptic is
 * only a confirmation for the interaction, not a decorative effect.
 */
export function AppSwitch(props: SwitchProps) {
  const { onValueChange, ...rest } = props;

  return (
    <Switch
      {...rest}
      onValueChange={(value) => {
        hapticToggle(value);
        onValueChange?.(value);
      }}
    />
  );
}

import { useEffect, useState } from 'react';
import { Switch, type SwitchProps } from 'react-native';
import { hapticToggle } from '../utils/haptics';

/**
 * Shared switch with a lightweight platform-appropriate haptic on user toggles.
 * The system setting is respected automatically on iOS/Android; the haptic is
 * only a confirmation for the interaction, not a decorative effect.
 */
export function AppSwitch(props: SwitchProps) {
  const { onValueChange, thumbColor, ...rest } = props;
  const [nativeColorReady, setNativeColorReady] = useState(false);

  // Commit the tint on a later frame so Fabric sends it to the native switch
  // separately from the initial mount. UISwitch can otherwise keep its default
  // white thumb until the first user-driven value change.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNativeColorReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Switch
      {...rest}
      thumbColor={nativeColorReady ? thumbColor : undefined}
      onValueChange={(value) => {
        hapticToggle(value);
        onValueChange?.(value);
      }}
    />
  );
}

import { Lucide } from '@react-native-vector-icons/lucide';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { getAppIconGlyph, type AppIconName } from '../components/AppIcon';

export function createNativeTabIcon(name: AppIconName) {
  return (
    <NativeTabs.Trigger.Icon
      src={{
        default: (
          <NativeTabs.Trigger.VectorIcon
            family={Lucide}
            name={getAppIconGlyph(name, 'inactive')}
          />
        ),
        selected: (
          <NativeTabs.Trigger.VectorIcon
            family={Lucide}
            name={getAppIconGlyph(name, 'active')}
          />
        ),
      }}
    />
  );
}

import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../AppIcon';

export const MASTER_PANE_WIDTH = 360;

export function MasterPaneHeader({
  title,
  actionLabel,
  onAction,
  colors,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  colors: { header: string; heading: string; accent: string; divider: string };
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        height: 52 + insets.top,
        paddingTop: insets.top,
        paddingLeft: 16,
        paddingRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.header,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.heading }}>
        {title}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        hitSlop={4}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppIcon name="add" size={22} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

type MasterDetailLayoutProps = {
  master: ReactNode;
  detail: ReactNode;
  dividerColor: string;
};

/** iPad wide-window split view. Compact and regular routing stays in each screen. */
export function MasterDetailLayout({ master, detail, dividerColor }: MasterDetailLayoutProps) {
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: MASTER_PANE_WIDTH, flexShrink: 0 }}>
        {master}
      </View>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          borderLeftWidth: 1,
          borderLeftColor: dividerColor,
        }}
      >
        {detail}
      </View>
    </View>
  );
}

export function MasterDetailEmptyState({
  icon,
  title,
  message,
  colors,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  colors: { screen: string; text: string; textSecondary: string };
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        backgroundColor: colors.screen,
      }}
    >
      {icon}
      <View style={{ height: 14 }} />
      <TextContent title={title} message={message} colors={colors} />
    </View>
  );
}

function TextContent({
  title,
  message,
  colors,
}: {
  title: string;
  message: string;
  colors: { text: string; textSecondary: string };
}) {
  return (
    <>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{title}</Text>
      <Text style={{ marginTop: 7, fontSize: 13, lineHeight: 20, textAlign: 'center', color: colors.textSecondary }}>
        {message}
      </Text>
    </>
  );
}

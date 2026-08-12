import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';

interface ExpandableListProps<T> {
  items: readonly T[];
  initialVisibleCount: number;
  renderItems: (items: readonly T[]) => ReactNode;
  expandLabel?: (hiddenCount: number, totalCount: number) => string;
  collapseLabel?: (totalCount: number) => string;
  resetKey?: string | number | null;
}

export function ExpandableList<T>({
  items,
  initialVisibleCount,
  renderItems,
  expandLabel = (hiddenCount) => `展开其余 ${hiddenCount} 项`,
  collapseLabel = () => '收起',
  resetKey = null,
}: ExpandableListProps<T>) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  const visibleCount = Number.isFinite(initialVisibleCount)
    ? Math.max(1, Math.floor(initialVisibleCount))
    : 1;
  const hasOverflow = items.length > visibleCount;
  const visibleItems = expanded ? items : items.slice(0, visibleCount);
  const hiddenCount = items.length - visibleItems.length;
  const toggleLabel = expanded
    ? collapseLabel(items.length)
    : expandLabel(hiddenCount, items.length);

  return (
    <View>
      {renderItems(visibleItems)}
      {hasOverflow ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          accessibilityState={{ expanded }}
          activeOpacity={0.7}
          onPress={() => setExpanded((current) => !current)}
          style={{
            minHeight: 44,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
            {toggleLabel}
          </Text>
          <AppIcon
            name="disclosure"
            variant={expanded ? 'up' : 'down'}
            size={15}
            color={colors.accent}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';

interface EventRowProps {
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress: () => void;
  isLast?: boolean;
  showChevron?: boolean;
  accessibilityLabel?: string;
}

/**
 * 活动列表行：标题 + 副文本（可选）+ 右侧度量值。
 * 行高固定 70，分隔线由 isLast 控制，不内置卡片外壳。
 */
export function EventRow({
  title,
  subtitle,
  trailing,
  onPress,
  isLast = false,
  showChevron = false,
  accessibilityLabel,
}: EventRowProps) {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        minHeight: 70,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.divider,
        justifyContent: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, lineHeight: 17, fontWeight: '800', color: colors.text }}
          >
            {title}
          </Text>
          {subtitle != null ? (
            <View style={{ marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
              {subtitle}
            </View>
          ) : null}
        </View>
        {trailing != null ? (
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 0,
              fontSize: 15,
              lineHeight: 19,
              fontWeight: '900',
              color: colors.accent,
              fontVariant: ['tabular-nums'],
            }}
          >
            {trailing}
          </Text>
        ) : null}
        {showChevron ? (
          <AppIcon name="disclosure" variant="forward" size={16} color={colors.chevron} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function EventRowMetaText({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();

  return (
    <Text
      numberOfLines={1}
      style={{ flexShrink: 1, fontSize: 12, lineHeight: 16, color: colors.textSecondary }}
    >
      {children}
    </Text>
  );
}

/**
 * 副文本结构化元信息：日期段不带 icon，地点段前置 eventLocation icon，
 * 城市与地点之间用「·」连接。
 */
export function EventRowLocationMeta({
  date,
  city,
  venue,
}: {
  date?: string | null;
  city?: string | null;
  venue?: string | null;
}) {
  const { colors } = useAppTheme();
  const locationText = [city, venue].filter(Boolean).join(' · ');

  return (
    <>
      {date ? <EventRowMetaText>{date}</EventRowMetaText> : null}
      {date && locationText ? <EventRowMetaText>·</EventRowMetaText> : null}
      {locationText ? (
        <>
          <AppIcon name="eventLocation" size={12} color={colors.textMuted} />
          <EventRowMetaText>{locationText}</EventRowMetaText>
        </>
      ) : null}
    </>
  );
}

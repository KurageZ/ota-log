import { Text, TouchableOpacity, View } from 'react-native';
import { Event } from '../types/models';
import { useAppTheme } from '../theme/appTheme';
import { OshiAvatar, OshiBadge } from './Oshi';
import { AppIcon } from './AppIcon';
import { resolveAvatarSource } from '../utils/avatarSource';
import { HomeFeaturedArtistData, HomeMonthOverviewData } from './HomeDashboardCards';
import { daysUntil } from '../utils/date';

export function HomePinnedNextEventEmptyHero({ onCreatePress }: { onCreatePress: () => void }) {
  const { colors, isDark } = useAppTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onCreatePress}
      style={{
        borderRadius: 22,
        padding: 16,
        marginBottom: 18,
        backgroundColor: colors.heroBg,
        overflow: 'hidden',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.26 : 0.12,
        shadowRadius: 16,
        elevation: 4,
      }}
      accessibilityRole="button"
      accessibilityLabel="添加下一场活动"
    >
      <HeroDecor />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.heroCalloutBg,
            borderWidth: 1,
            borderColor: colors.heroCalloutBorder,
          }}
        >
          <AppIcon name="addCircle" size={28} color={colors.heroText} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.heroEyebrow, fontSize: 10, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8 }}>
            下一场活动
          </Text>
          <Text style={{ marginTop: 6, color: colors.heroText, fontSize: 16, lineHeight: 21, fontWeight: '900' }}>
            还没有下一场活动
          </Text>
          <Text style={{ marginTop: 4, color: colors.heroSubtext, fontSize: 12, lineHeight: 17, fontWeight: '500' }}>
            添加计划中的活动后，这里会显示倒计时和活动安排。
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function HomePinnedArtistHero({
  data,
  onPress,
  onSetupPress,
}: {
  data: HomeFeaturedArtistData | null;
  onPress: (data: HomeFeaturedArtistData) => void;
  onSetupPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const artist = data?.artist ?? null;

  if (!artist || !data) {
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onSetupPress}
        style={{
          borderRadius: 22,
          padding: 16,
          marginBottom: 18,
          backgroundColor: colors.heroBg,
          overflow: 'hidden',
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.26 : 0.12,
          shadowRadius: 16,
          elevation: 4,
        }}
        accessibilityRole="button"
        accessibilityLabel="选择置顶艺人"
      >
        <HeroDecor />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.heroCalloutBg,
              borderWidth: 1,
              borderColor: colors.heroCalloutBorder,
            }}
          >
            <AppIcon name="oshi" size={25} color={colors.heroText} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.heroEyebrow, fontSize: 10, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8 }}>
              关注艺人
            </Text>
            <Text style={{ marginTop: 6, color: colors.heroText, fontSize: 16, lineHeight: 21, fontWeight: '900' }}>
              选择置顶艺人
            </Text>
            <Text style={{ marginTop: 4, color: colors.heroSubtext, fontSize: 12, lineHeight: 17, fontWeight: '500' }}>
              选择一位艺人后，首页顶部会显示下一场活动和记录摘要。
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const artistName = artist.short_name || artist.name;
  const nextEvent = data.nextEvent;
  const nextEventMeta = nextEvent ? formatEventMeta(nextEvent) : '暂无计划中的活动';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(data)}
      style={{
        borderRadius: 22,
        padding: 16,
        marginBottom: 18,
        backgroundColor: colors.heroBg,
        overflow: 'hidden',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.26 : 0.12,
        shadowRadius: 16,
        elevation: 4,
      }}
      accessibilityRole="button"
      accessibilityLabel={`查看${artistName}`}
    >
      <HeroDecor strong />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <OshiAvatar
          source={resolveAvatarSource(artist.avatar_uri)}
          size={72}
          isOshi={data.isOshi}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.heroEyebrow, fontSize: 10, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8 }}>
            关注艺人
          </Text>
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.heroText, fontSize: 17, lineHeight: 22, fontWeight: '900' }}>
              {artistName}
            </Text>
            {data.isOshi ? <OshiBadge /> : null}
          </View>
          <Text numberOfLines={1} style={{ marginTop: 4, color: colors.heroSubtext, fontSize: 12, lineHeight: 17, fontWeight: '500' }}>
            {nextEvent ? `下一场：${nextEventMeta}` : nextEventMeta}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <HeroMetric value={`${data.yearEventCount}`} label="今年活动" />
        <HeroMetric value={`${data.chekiCount}`} label="拍立得" />
        <HeroMetric value={nextEvent ? getCountdownLabel(nextEvent) : '暂无'} label="下一场" />
      </View>
    </TouchableOpacity>
  );
}

export function HomePinnedMonthSummaryHero({
  data,
  onPress,
}: {
  data: HomeMonthOverviewData;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const monthTitle = `${new Date().getMonth() + 1} 月记录`;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        borderRadius: 22,
        padding: 16,
        marginBottom: 18,
        backgroundColor: colors.heroBg,
        overflow: 'hidden',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.26 : 0.12,
        shadowRadius: 16,
        elevation: 4,
      }}
      accessibilityRole="button"
      accessibilityLabel="查看本月概览"
    >
      <HeroDecor />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.heroCalloutBg,
            borderWidth: 1,
            borderColor: colors.heroCalloutBorder,
          }}
        >
          <AppIcon name="stats" size={25} color={colors.heroText} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: colors.heroText, fontSize: 17, lineHeight: 22, fontWeight: '900' }}>
            {monthTitle}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <HeroMetric value={`${data.eventCount}`} label="已完成" />
        <HeroMetric value={`${data.plannedCount}`} label="计划中" />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <HeroMetric value={`${data.chekiArtistCount}`} label="拍立得人数" />
        <HeroMetric value={`${data.chekiCount}`} label="拍立得张数" />
      </View>
    </TouchableOpacity>
  );
}

function HeroDecor({ strong = false }: { strong?: boolean }) {
  const { colors } = useAppTheme();

  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: -24,
          right: -18,
          width: 116,
          height: 116,
          borderRadius: 58,
          backgroundColor: strong ? colors.heroDecorOshi : colors.heroDecor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -44,
          left: 34,
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.heroDecorWeak,
        }}
      />
    </>
  );
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 62,
        borderRadius: 15,
        paddingHorizontal: 8,
        paddingVertical: 9,
        justifyContent: 'center',
        backgroundColor: colors.heroCalloutBg,
        borderWidth: 1,
        borderColor: colors.heroCalloutBorder,
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={{
          color: colors.heroText,
          fontSize: 20,
          lineHeight: 24,
          fontWeight: '900',
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.76}
        style={{
          marginTop: 3,
          color: colors.heroSubtext,
          fontSize: 10.5,
          lineHeight: 13,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function formatShortDate(isoDate: string) {
  const [, month, day] = isoDate.split('-');
  return `${month}-${day}`;
}

function formatEventMeta(event: Event) {
  const parts = [formatShortDate(event.event_date), event.event_time || '全天', event.venue]
    .filter(Boolean);
  return parts.join(' · ') || '时间地点待确认';
}

function getCountdownLabel(event: Event) {
  const days = daysUntil(event.event_date);
  if (days <= 0) return '今天';
  if (days === 1) return '明天';
  return `${days} 天后`;
}

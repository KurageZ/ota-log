import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Artist, Cheki, Event } from '../types/models';
import type { HydratedDateItem } from '../repositories/DateItemRepository';
import { useAppTheme } from '../theme/appTheme';
import { OshiAvatar, OshiBadge } from './Oshi';
import { resolveAvatarSource } from '../utils/avatarSource';
import { daysUntil } from '../utils/date';
import { withAlpha } from '../utils/color';
import { AppIcon } from './AppIcon';
import { AnimatedPressable } from './AnimatedPressable';
import { getDateItemPresetKind } from '../utils/dateItemDisplay';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { PresetDateItemTitle } from './PresetDateItemTitle';

export interface HomeFeaturedArtistData {
  artist: Artist | null;
  isOshi: boolean;
  recentEvent: Event | null;
  nextEvent: Event | null;
  yearEventCount: number;
  chekiCount: number;
}

export interface HomeMonthOverviewData {
  eventCount: number;
  plannedCount: number;
  chekiArtistCount: number;
  chekiCount: number;
}

export interface HomeChekiPreview {
  cheki: Cheki;
  artistName: string | null;
}

export function HomeImportantDatesCard({
  items,
  onPressItem,
  onSetupPress,
}: {
  items: HydratedDateItem[];
  onPressItem: (item: HydratedDateItem) => void;
  onSetupPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();

  if (items.length === 0) {
    return (
      <AnimatedPressable
        onPress={onSetupPress}
        style={{
          borderRadius: 16,
          padding: 15,
          marginBottom: 12,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.divider,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.1 : 0.05,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accentSoft,
            }}
          >
            <AppIcon name="dateItem" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.heading }}>
              未选择
            </Text>
            <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, fontWeight: '500', color: colors.textSecondary }}>
              在设置中选择要固定展示的重要日期。
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <View
      style={{
        borderRadius: 16,
        padding: 15,
        marginBottom: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.divider,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.1 : 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {items.map((item, index) => (
        <HomeImportantDateRow
          key={item.item.id}
          item={item}
          isFirst={index === 0}
          isLast={index === items.length - 1}
          onPress={() => onPressItem(item)}
        />
      ))}
    </View>
  );
}

function HomeImportantDateRow({
  item,
  isFirst,
  isLast,
  onPress,
}: {
  item: HydratedDateItem;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const presetKind = getDateItemPresetKind(item.item);
  const presetArtist = presetKind && item.artists.length === 1 ? item.artists[0] : null;
  const relativeDays = item.relativeText.match(/\d+/)?.[0] ?? '';
  const relativeMain = item.relativeState === 'today' ? '今天' : relativeDays;
  const relativeLabel = item.relativeState === 'today' ? '就是今天' : item.relativeState === 'future' ? '天后' : '天前';
  const displayedArtists = item.item.linked_event_id || presetKind ? [] : item.artists;
  const artistText = displayedArtists.map(getArtistPrimaryName).join(' / ');

  return (
    <TouchableOpacity
      activeOpacity={0.68}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 66,
        paddingTop: isFirst ? 0 : 10,
        paddingBottom: isLast ? 0 : 10,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.divider,
      }}
      accessibilityRole="button"
      accessibilityLabel={`查看重要日期 ${item.item.title}`}
    >
      <View
        style={{
          width: 54,
          minHeight: 54,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 5,
          backgroundColor: item.relativeState === 'today' ? colors.accent : isDark ? colors.input : colors.accentSofter,
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.68}
          style={{
            fontSize: item.relativeState === 'today' ? 16 : 24,
            lineHeight: item.relativeState === 'today' ? 19 : 28,
            fontWeight: '900',
            color: item.relativeState === 'today' ? colors.onAccent : colors.accent,
            fontVariant: ['tabular-nums'],
          }}
        >
          {relativeMain}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 1,
            fontSize: 10,
            lineHeight: 12,
            fontWeight: '800',
            color: item.relativeState === 'today' ? withAlpha(colors.onAccent, 0.78) : colors.accent,
          }}
        >
          {relativeLabel}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, marginLeft: 11 }}>
        <View style={{ marginBottom: 4 }}>
          {presetKind && presetArtist ? (
            <PresetDateItemTitle
              kind={presetKind}
              artist={presetArtist}
              color={colors.text}
              fontSize={15}
              lineHeight={19}
              fontWeight="800"
              avatarSize={22}
            />
          ) : (
            <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 19, fontWeight: '800', color: colors.text }}>
              {item.item.title}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
            {item.item.date}
          </Text>
          {item.nextAnniversary ? (
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.textMuted }}>
              下个纪念日 {item.nextAnniversary.label}
            </Text>
          ) : null}
        </View>
        {artistText ? (
          <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {displayedArtists.slice(0, 2).map((artist) => (
              <OshiAvatar
                key={artist.id}
                source={resolveAvatarSource(artist.avatar_uri)}
                size={20}
                isOshi={false}
              />
            ))}
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textMuted }}>
              {artistText}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function HomeFeaturedArtistsCard({
  items,
  onPressArtist,
  onSetupPress,
  emptyTitle = '选择关注艺人',
  emptyDescription = '最多选择五位艺人，展示下一场活动和记录摘要。',
}: {
  items: HomeFeaturedArtistData[];
  onPressArtist: (data: HomeFeaturedArtistData) => void;
  onSetupPress: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { colors, isDark } = useAppTheme();
  const visibleItems = items.filter((item) => item.artist);

  if (visibleItems.length === 0) {
    return (
      <AnimatedPressable
        onPress={onSetupPress}
        style={{
          borderRadius: 16,
          padding: 15,
          marginBottom: 12,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.divider,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.1 : 0.05,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.oshiAvatarBg,
            }}
          >
            <AppIcon name="oshi" variant="inactive" size={22} color={colors.oshiBadgeBg} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.heading }}>
              {emptyTitle}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, fontWeight: '500', color: colors.textSecondary }}>
              {emptyDescription}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <View
      style={{
        borderRadius: 16,
        padding: 15,
        marginBottom: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.divider,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.1 : 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {visibleItems.map((data, index) => {
        const artist = data.artist;
        if (!artist) return null;
        const artistName = artist.short_name || artist.name;
        const metaLabel = data.nextEvent
          ? `下一场：${formatEventMeta(data.nextEvent)}`
          : data.recentEvent
            ? `最近一次见面：${formatShortDate(data.recentEvent.event_date)}`
            : '暂无计划中的活动';
        const nextCountdown = data.nextEvent ? getCountdownLabel(data.nextEvent.event_date) : null;

        return (
          <TouchableOpacity
            key={artist.id}
            activeOpacity={0.68}
            onPress={() => onPressArtist(data)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 58,
              paddingTop: index === 0 ? 0 : 10,
              paddingBottom: index === visibleItems.length - 1 ? 0 : 10,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.divider,
            }}
          >
            <OshiAvatar
              source={resolveAvatarSource(artist.avatar_uri)}
              size={40}
              isOshi={data.isOshi}
            />
            <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text
                  numberOfLines={1}
                  style={{ flexShrink: 1, fontSize: 15, lineHeight: 19, fontWeight: '800', color: colors.heading }}
                >
                  {artistName}
                </Text>
                {data.isOshi ? <OshiBadge /> : null}
              </View>
              <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, lineHeight: 15, fontWeight: '500', color: colors.textSecondary }}>
                {metaLabel}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.textMuted }}>
                今年活动 {data.yearEventCount} 场 · 拍立得 {data.chekiCount} 张
              </Text>
            </View>
            {nextCountdown ? (
              <View
                style={{
                  marginLeft: 8,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: withAlpha(colors.accent, isDark ? 0.16 : 0.09),
                }}
              >
                <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '800', color: colors.oshiBadgeBg }}>
                  {nextCountdown}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function HomeMonthOverviewCard({
  data,
  onPress,
}: {
  data: HomeMonthOverviewData;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const monthTitle = `${new Date().getMonth() + 1} 月记录`;

  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        borderRadius: 16,
        padding: 15,
        marginBottom: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.divider,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.1 : 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <Text numberOfLines={1} style={{ marginBottom: 11, fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.heading }}>
        {monthTitle}
      </Text>
      <View style={{ flexDirection: 'row', gap: 9, marginBottom: 9 }}>
        <StatTile value={String(data.eventCount)} label="已完成" />
        <StatTile value={String(data.plannedCount)} label="计划中" />
      </View>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        <StatTile value={String(data.chekiArtistCount)} label="拍立得人数" />
        <StatTile value={String(data.chekiCount)} label="拍立得张数" />
      </View>
    </AnimatedPressable>
  );
}

export function HomeChekiOverviewCard({
  totalCount,
  monthCount,
  previews,
  onPress,
}: {
  totalCount: number;
  monthCount: number;
  previews: HomeChekiPreview[];
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        borderRadius: 16,
        padding: 15,
        marginBottom: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.divider,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.1 : 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.heading }}>
        {previews.length > 0 ? `本月新增 ${monthCount} 张` : '还没有拍立得'}
      </Text>
      <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 18, fontWeight: '500', color: colors.textSecondary }}>
        {previews.length > 0 ? '最近拍立得' : '添加拍立得后，这里会展示最近的图片记录。'}
      </Text>

      {previews.length > 0 ? (
        <View style={{ marginTop: 13, flexDirection: 'row', gap: 9 }}>
          {previews.map((item) => (
            <View key={item.cheki.id} style={{ flex: 1, minWidth: 0 }}>
              <Image
                source={{ uri: item.cheki.photo_uri }}
                style={{
                  width: '100%',
                  aspectRatio: 54 / 86,
                  borderRadius: 10,
                  borderWidth: 3,
                  borderColor: colors.card,
                  backgroundColor: colors.cardAlt,
                }}
                resizeMode="cover"
              />
              <Text numberOfLines={1} style={{ marginTop: 7, fontSize: 11.5, lineHeight: 14, fontWeight: '800', color: colors.text }}>
                {item.artistName ?? '未关联艺人'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        minHeight: 76,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.cardAlt,
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        style={{
          width: '100%',
          fontSize: 25,
          lineHeight: 28,
          fontWeight: '900',
          color: colors.heading,
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
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '600',
          color: colors.textMuted,
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

function getCountdownLabel(eventDate: string) {
  const days = daysUntil(eventDate);
  if (days <= 0) return '今天';
  if (days === 1) return '明天';
  return `${days} 天后`;
}

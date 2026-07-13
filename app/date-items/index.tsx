import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../src/components/AppIcon';
import { OshiAvatar } from '../../src/components/Oshi';
import { PresetDateItemTitle } from '../../src/components/PresetDateItemTitle';
import { SectionLabel } from '../../src/components/SettingsMenu';
import { useDB } from '../../src/context/DBContext';
import { HydratedDateItem } from '../../src/repositories/DateItemRepository';
import { useAppTheme } from '../../src/theme/appTheme';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { getDateItemPresetKind } from '../../src/utils/dateItemDisplay';
import { toISODate } from '../../src/utils/date';
import { withAlpha } from '../../src/utils/color';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

function DateItemCard({ item }: { item: HydratedDateItem }) {
  const { colors, isDark } = useAppTheme();
  const presetKind = getDateItemPresetKind(item.item);
  const presetArtist = presetKind && item.artists.length === 1 ? item.artists[0] : null;
  const displayedArtists = item.item.linked_event_id || presetKind ? [] : item.artists;
  const artistText = displayedArtists.map(getArtistPrimaryName).join(' / ');
  const relativeDays = item.relativeText.match(/\d+/)?.[0] ?? '';
  const relativeMain = item.relativeState === 'today' ? '今天' : relativeDays;
  const relativeLabel = item.relativeState === 'today' ? '就是今天' : item.relativeState === 'future' ? '天后' : '天前';
  const metaChipBg = isDark ? colors.input : colors.cardAlt;

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={() => router.push(`/date-items/${item.item.id}`)}
      style={{
        borderRadius: 18,
        padding: 15,
        marginBottom: 10,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.divider,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
      }}
      accessibilityRole="button"
      accessibilityLabel={`查看重要日期 ${item.item.title}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 62,
          minHeight: 62,
          borderRadius: 16,
          backgroundColor: item.relativeState === 'today' ? colors.accent : isDark ? colors.input : colors.accentSofter,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 6,
        }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.68}
            style={{
              fontSize: item.relativeState === 'today' ? 18 : 27,
              lineHeight: item.relativeState === 'today' ? 21 : 31,
              fontWeight: '900',
              textAlign: 'center',
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

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ marginBottom: 4 }}>
            {presetKind && presetArtist ? (
              <PresetDateItemTitle
                kind={presetKind}
                artist={presetArtist}
                color={colors.text}
                fontSize={16}
                lineHeight={21}
                fontWeight="800"
                avatarSize={24}
              />
            ) : (
              <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', color: colors.text }}>
                {item.item.title}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
              {item.item.date}
            </Text>
            {item.nextAnniversary ? (
              <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: metaChipBg }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                  下个纪念日 {item.nextAnniversary.label}
                </Text>
              </View>
            ) : null}
          </View>
          {artistText ? (
            <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              {displayedArtists.slice(0, 2).map((artist) => (
                <OshiAvatar
                  key={artist.id}
                  source={resolveAvatarSource(artist.avatar_uri)}
                  size={22}
                  isOshi={false}
                />
              ))}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: colors.textMuted }}>
                {artistText}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DateItemsScreen() {
  const db = useDB();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<HydratedDateItem[]>([]);
  const today = toISODate(new Date());

  const loadData = useCallback(() => {
    db.dateItems.findAll(today).then(setItems).catch(() => {});
  }, [db, today]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const grouped = useMemo(() => ({
    upcoming: items.filter((item) => item.item.date >= today),
    past: items.filter((item) => item.item.date < today),
  }), [items, today]);

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/date-items/new')}
              activeOpacity={0.72}
              hitSlop={10}
              style={{ paddingHorizontal: 4, paddingVertical: 6 }}
            >
              <AppIcon name="add" size={24} color={colors.accent} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 80 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: colors.accentSofter, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name="dateItem" size={26} color={colors.accent} />
            </View>
            <Text style={{ marginTop: 14, fontSize: 17, fontWeight: '800', color: colors.heading }}>无记录</Text>
            <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' }}>
              添加后将根据日期自动显示为倒数日或纪念日
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/date-items/new')}
              activeOpacity={0.85}
              style={{ marginTop: 18, minHeight: 44, borderRadius: 14, paddingHorizontal: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>新建重要日期</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 16 }}>
              <SectionLabel label="即将到来" />
              {grouped.upcoming.length > 0 ? grouped.upcoming.map((item) => (
                <DateItemCard key={item.item.id} item={item} />
              )) : (
                <Text style={{ paddingVertical: 12, color: colors.textMuted, fontSize: 13 }}>暂无即将到来的日期</Text>
              )}
            </View>
            <View>
              <SectionLabel label="已经发生" />
              {grouped.past.length > 0 ? grouped.past.map((item) => (
                <DateItemCard key={item.item.id} item={item} />
              )) : (
                <Text style={{ paddingVertical: 12, color: colors.textMuted, fontSize: 13 }}>暂无已经发生的日期</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

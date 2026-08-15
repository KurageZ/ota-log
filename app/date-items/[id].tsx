import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../src/components/AppIcon';
import { OshiAvatar } from '../../src/components/Oshi';
import { PresetDateItemTitle } from '../../src/components/PresetDateItemTitle';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { SectionLabel } from '../../src/components/SettingsMenu';
import { useDB } from '../../src/context/DBContext';
import { HydratedDateItem } from '../../src/repositories/DateItemRepository';
import { useAppTheme } from '../../src/theme/appTheme';
import { Event } from '../../src/types/models';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { getDateItemPresetKind } from '../../src/utils/dateItemDisplay';
import { showDeleteFailedAlert, showSaveFailedAlert } from '../../src/utils/failureAlert';
import { withAlpha } from '../../src/utils/color';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import { formatEventTimes } from '../../src/components/EventPrimitives';

export default function DateItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const [item, setItem] = useState<HydratedDateItem | null>(null);
  const [sourceEvent, setSourceEvent] = useState<Event | null>(null);
  const [missing, setMissing] = useState(false);
  const [pendingSetting, setPendingSetting] = useState<'calendar' | null>(null);
  const [pendingAnniversaryId, setPendingAnniversaryId] = useState<string | null>(null);
  const [customAnniversaryDays, setCustomAnniversaryDays] = useState('');

  const loadData = useCallback(() => {
    if (!id) return;
    db.dateItems.findById(id).then(async (result) => {
      if (result) {
        setItem(result);
        setMissing(false);
        if (result.item.linked_event_id) {
          setSourceEvent(await db.events.findById(result.item.linked_event_id).catch(() => null));
        } else {
          setSourceEvent(null);
        }
      } else {
        setSourceEvent(null);
        setMissing(true);
      }
    }).catch(() => {
      setSourceEvent(null);
      setMissing(true);
    });
  }, [db, id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleDelete = () => {
    if (!id || !item) return;
    Alert.alert(
      '删除重要日期？',
      '只会删除这个重要日期和纪念日设置，不会删除活动、艺人、拍立得或本地图片。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.dateItems.delete(id);
              router.replace('/date-items');
            } catch (error) {
              showDeleteFailedAlert(error);
            }
          },
        },
      ],
    );
  };

  const handleToggleCalendar = async (value: boolean) => {
    if (!id || !item || pendingSetting) return;
    const previous = item;
    setPendingSetting('calendar');
    setItem({
      ...item,
      item: {
        ...item.item,
        show_on_calendar: value ? 1 : 0,
      },
    });
    try {
      await db.dateItems.update(id, { show_on_calendar: value });
    } catch (error) {
      setItem(previous);
      showSaveFailedAlert(error);
    } finally {
      setPendingSetting(null);
    }
  };

  const handleToggleAnniversary = async (anniversaryId: string, enabled: number) => {
    if (!item || pendingAnniversaryId) return;
    const previous = item;
    setPendingAnniversaryId(anniversaryId);
    setItem({
      ...item,
      anniversaries: item.anniversaries.map((anniversary) => (
        anniversary.id === anniversaryId ? { ...anniversary, enabled } : anniversary
      )),
    });
    try {
      await db.dateItems.updateAnniversaryRule(anniversaryId, { enabled });
    } catch (error) {
      setItem(previous);
      showSaveFailedAlert(error);
    } finally {
      setPendingAnniversaryId(null);
    }
  };

  const handleAddCustomAnniversary = async () => {
    if (!id || !item) return;
    const days = Number(customAnniversaryDays.replace(/\D/g, ''));
    if (!Number.isInteger(days) || days <= 0) {
      Alert.alert('请输入天数', '自定义纪念日需要填写大于 0 的天数。');
      return;
    }
    try {
      await db.dateItems.createAnniversaryRule(item.item.id, {
        anniversary_kind: 'day',
        anniversary_value: days,
        label: `第 ${days} 天`,
      });
      setCustomAnniversaryDays('');
      loadData();
    } catch (error) {
      showSaveFailedAlert(error);
    }
  };

  if (missing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>找不到这个重要日期</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const isActivityCountdown = item.item.source_kind === 'linked_activity';
  const presetKind = getDateItemPresetKind(item.item);
  const presetArtist = presetKind && item.artists.length === 1 ? item.artists[0] : null;
  const typeLabel = isActivityCountdown ? '关联活动' : '重要日期';
  const displayedArtists = isActivityCountdown || presetKind ? [] : item.artists;
  const showsArtistSection = !isActivityCountdown && !presetKind;
  const artistText = displayedArtists.map(getArtistPrimaryName).join(' / ');
  const relativeDays = item.relativeText.match(/\d+/)?.[0] ?? '';
  const heroValue = item.relativeState === 'today' ? '今天' : relativeDays;
  const heroLabel = item.relativeState === 'today' ? '就是今天' : item.relativeState === 'future' ? '天后' : '天前';
  const eventMetaParts = sourceEvent
    ? [
        formatShortDate(sourceEvent.event_date),
        formatEventTimes(sourceEvent.open_time, sourceEvent.start_time) || '全天',
        sourceEvent.venue,
      ].filter(Boolean)
    : [item.item.date];

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity
              onPress={() => router.push(`/date-items/${item.item.id}/edit`)}
              activeOpacity={0.72}
              hitSlop={10}
              style={{
                minHeight: 34,
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>编辑</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        right={{
          label: '编辑',
          onPress: () => router.push(`/date-items/${item.item.id}/edit`),
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {isActivityCountdown ? (
          <TouchableOpacity
            activeOpacity={sourceEvent ? 0.88 : 1}
            disabled={!sourceEvent}
            onPress={() => sourceEvent ? router.push(`/events/${sourceEvent.id}`) : undefined}
            style={{
              borderRadius: 22,
              paddingHorizontal: 14,
              paddingVertical: 14,
              marginBottom: 22,
              backgroundColor: colors.heroBg,
              overflow: 'hidden',
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.26 : 0.12,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 72,
                minHeight: 72,
                borderRadius: 16,
                backgroundColor: colors.heroCalloutBg,
                borderWidth: 1,
                borderColor: colors.heroCalloutBorder,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
                paddingVertical: 10,
              }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={{
                    color: colors.heroText,
                    fontSize: heroValue.length > 3 ? 20 : 32,
                    lineHeight: heroValue.length > 3 ? 24 : 34,
                    fontWeight: '900',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {heroValue}
                </Text>
                <Text style={{ marginTop: 2, color: colors.heroSubtext, fontSize: 10.5, lineHeight: 13, fontWeight: '700' }}>
                  {heroLabel}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text style={{ color: colors.heroEyebrow, fontSize: 10, lineHeight: 12, fontWeight: '800' }}>
                  关联活动
                </Text>
                <Text numberOfLines={2} style={{ color: colors.heroText, fontSize: 16, lineHeight: 21, fontWeight: '800' }}>
                  {sourceEvent?.title ?? item.item.title}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.heroSubtext, fontSize: 11.5, lineHeight: 15, fontWeight: '500' }}>
                  {eventMetaParts.join(' · ') || '时间地点待确认'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={{
            borderRadius: 22,
            padding: 18,
            marginBottom: 22,
            backgroundColor: colors.accentStrong,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.26 : 0.12,
            shadowRadius: 16,
            elevation: 4,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: withAlpha(colors.onAccent, 0.18) }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.onAccent }}>{typeLabel}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: withAlpha(colors.onAccent, 0.78), fontVariant: ['tabular-nums'] }}>
                {item.item.date}
              </Text>
            </View>
            {presetKind && presetArtist ? (
              <PresetDateItemTitle
                kind={presetKind}
                artist={presetArtist}
                color={colors.onAccent}
                fontSize={23}
                lineHeight={30}
                fontWeight="900"
                avatarSize={34}
                gap={8}
                lineGap={3}
              />
            ) : (
              <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '900', color: colors.onAccent }} numberOfLines={2}>
                {item.item.title}
              </Text>
            )}
            <Text style={{ marginTop: 18, fontSize: 34, lineHeight: 40, fontWeight: '900', color: colors.onAccent }}>
              {item.relativeText}
            </Text>
          </View>
        )}

        <SectionLabel label="详情" />
        <View style={{ borderRadius: 18, padding: 15, backgroundColor: colors.card, marginBottom: 22, gap: 12 }}>
          {showsArtistSection ? (
            <View>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 3 }}>关联艺人</Text>
              {displayedArtists.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  {displayedArtists.slice(0, 3).map((artist) => (
                    <OshiAvatar
                      key={artist.id}
                      source={resolveAvatarSource(artist.avatar_uri)}
                      size={32}
                      isOshi={false}
                    />
                  ))}
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: '700' }}>
                    {artistText}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 15, color: colors.text, fontWeight: '700' }}>未关联艺人</Text>
              )}
            </View>
          ) : null}
          <View style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderTopWidth: showsArtistSection ? 1 : 0,
            borderTopColor: colors.divider,
            paddingTop: showsArtistSection ? 12 : 0,
          }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, color: colors.text, fontWeight: '700' }}>展示在日历</Text>
            </View>
            <Switch
              value={item.item.show_on_calendar === 1}
              onValueChange={handleToggleCalendar}
              disabled={pendingSetting !== null}
              trackColor={{ false: colors.inputBorder, true: withAlpha(colors.accent, 0.38) }}
              thumbColor={item.item.show_on_calendar === 1 ? colors.accent : colors.card}
              style={{ alignSelf: 'center' }}
            />
          </View>
          {item.item.notes ? (
            <View>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 3 }}>备注</Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{item.item.notes}</Text>
            </View>
          ) : null}
        </View>

        {item.anniversaries.length > 0 ? (
          <>
            <SectionLabel label="纪念日设置" />
            <View style={{ borderRadius: 18, backgroundColor: colors.card, overflow: 'hidden', marginBottom: 22 }}>
              {item.anniversaries.map((anniversary, index) => {
                return (
                  <View key={anniversary.id} style={{
                    paddingHorizontal: 15,
                    paddingVertical: 13,
                    borderBottomWidth: index === item.anniversaries.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}>
                    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <Text style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                        {anniversary.label}
                      </Text>
                      <Switch
                        value={anniversary.enabled === 1}
                        onValueChange={(value) => handleToggleAnniversary(anniversary.id, value ? 1 : 0)}
                        disabled={pendingAnniversaryId !== null}
                        trackColor={{ false: colors.inputBorder, true: withAlpha(colors.accent, 0.38) }}
                        thumbColor={anniversary.enabled === 1 ? colors.accent : colors.card}
                      />
                    </View>
                  </View>
                );
              })}
              <View style={{ paddingHorizontal: 15, paddingVertical: 13, gap: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>自定义</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={customAnniversaryDays}
                    onChangeText={(value) => setCustomAnniversaryDays(value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="天数"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    style={{
                      flex: 1,
                      minHeight: 42,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      backgroundColor: colors.input,
                      paddingHorizontal: 12,
                      color: colors.text,
                      fontSize: 14,
                    }}
                  />
                  <TouchableOpacity
                    onPress={handleAddCustomAnniversary}
                    activeOpacity={0.78}
                    style={{
                      minHeight: 42,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      backgroundColor: colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: '800' }}>添加</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  例如 520，会生成第 520 天纪念日。
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.72}
          style={{
            minHeight: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(colors.danger, 0.32),
            backgroundColor: withAlpha(colors.danger, 0.08),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <AppIcon name="trash" size={17} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '800' }}>删除</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatShortDate(isoDate: string) {
  const [, month, day] = isoDate.split('-');
  return `${month}-${day}`;
}

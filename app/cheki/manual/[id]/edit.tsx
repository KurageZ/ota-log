import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AppIcon } from '../../../../src/components/AppIcon';
import { NativeTextToolbar } from '../../../../src/components/native-text-toolbar';
import { useDB } from '../../../../src/context/DBContext';
import { Artist, ChekiManualEntry, Event } from '../../../../src/types/models';
import { getArtistPrimaryName } from '../../../../src/utils/artistDisplay';
import { ArtistSearchPicker } from '../../../../src/components/ArtistSearchPicker';
import { FormCard, FormFieldLabel, FormSectionLabel } from '../../../../src/components/FormPrimitives';
import { showDeleteFailedAlert, showSaveFailedAlert } from '../../../../src/utils/failureAlert';
import { calculateManualChekiTotalPrice } from '../../../../src/utils/cheki';
import { useAppTheme } from '../../../../src/theme/appTheme';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../../../src/utils/safeArea';

function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

function parseManualEntryCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function parseManualEntryTotalPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export default function EditManualChekiEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors, isDark } = useAppTheme();

  const [entry, setEntry] = useState<ChekiManualEntry | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [date, setDate] = useState('');
  const [count, setCount] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      db.chekiManualEntries.findById(id),
      db.artists.findAll(),
      db.events.findAll(),
      db.userConfig.getConfig(),
    ]).then(([manualEntry, artists, events, config]) => {
      if (!manualEntry) {
        router.back();
        return;
      }
      setEntry(manualEntry);
      setArtistId(manualEntry.artist_id);
      setDate(manualEntry.date ?? '');
      setCount(String(manualEntry.count));
      setTotalPrice(manualEntry.total_price != null ? String(manualEntry.total_price) : '');
      setEventId(manualEntry.event_id);
      setAllArtists(artists);
      setAllEvents(events);
      setOshiArtistId(config.oshi_artist_id);
      setLoading(false);
    });
  }, [db, id]);

  const selectedArtist = useMemo(
    () => allArtists.find((artist) => artist.id === artistId) ?? null,
    [allArtists, artistId],
  );
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const filteredEvents = useMemo(
    () => eventSearch.trim()
      ? allEvents.filter((event) => event.event_date.includes(eventSearch.trim()))
      : [],
    [allEvents, eventSearch],
  );
  const selectedEvent = useMemo(
    () => allEvents.find((event) => event.id === eventId) ?? null,
    [allEvents, eventId],
  );

  useEffect(() => {
    if (!eventId) setEventSearch(date);
  }, [date, eventId]);

  const handleSave = async () => {
    const parsedCount = parseManualEntryCount(count);
    const parsedUnitPrice = parseManualEntryTotalPrice(unitPrice);
    const parsedTotalPrice = parseManualEntryTotalPrice(totalPrice);

    if (!artistId) {
      Alert.alert('请选择艺人');
      return;
    }
    if (parsedCount == null) {
      Alert.alert('数量至少为 1');
      return;
    }
    if (Number.isNaN(parsedUnitPrice)) {
      Alert.alert('请输入有效的单价');
      return;
    }
    if (parsedUnitPrice != null && parsedUnitPrice < 0) {
      Alert.alert('单价不能为负数');
      return;
    }
    if (Number.isNaN(parsedTotalPrice)) {
      Alert.alert('请输入有效的总价');
      return;
    }
    if (parsedTotalPrice != null && parsedTotalPrice < 0) {
      Alert.alert('总价不能为负数');
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('日期格式应为 YYYY-MM-DD');
      return;
    }

    setSaving(true);
    try {
      await db.chekiManualEntries.update(id, {
        artist_id: artistId,
        event_id: eventId,
        date: date || null,
        count: parsedCount,
        total_price: parsedTotalPrice != null && !Number.isNaN(parsedTotalPrice) ? parsedTotalPrice : null,
      });
      router.back();
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('删除记录', '确认删除这条记录？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.chekiManualEntries.delete(id);
            router.back();
          } catch (error) {
            showDeleteFailedAlert(error);
          }
        },
      },
    ]);
  };

  const updateCalculatedTotalPrice = useCallback((nextCount: string, nextUnitPrice: string) => {
    const parsedCount = parseManualEntryCount(nextCount);
    const parsedUnitPrice = parseManualEntryTotalPrice(nextUnitPrice);
    if (parsedCount == null || parsedUnitPrice == null || Number.isNaN(parsedUnitPrice)) return;

    const calculatedTotal = calculateManualChekiTotalPrice(parsedCount, parsedUnitPrice);
    if (calculatedTotal != null) {
      setTotalPrice(String(calculatedTotal));
    }
  }, []);
  const handleCountChange = useCallback((value: string) => {
    const nextCount = value.replace(/\D/g, '');
    setCount(nextCount);
    updateCalculatedTotalPrice(nextCount, unitPrice);
  }, [unitPrice, updateCalculatedTotalPrice]);
  const handleUnitPriceChange = useCallback((value: string) => {
    setUnitPrice(value);
    updateCalculatedTotalPrice(count, value);
  }, [count, updateCalculatedTotalPrice]);
  const handleTotalPriceChange = useCallback((value: string) => {
    setTotalPrice(value);
    setUnitPrice('');
  }, []);
  const handleDecreaseCount = useCallback(() => {
    const nextValue = Math.max(1, (parseManualEntryCount(count) ?? 1) - 1);
    setCount(String(nextValue));
    updateCalculatedTotalPrice(String(nextValue), unitPrice);
  }, [count, unitPrice, updateCalculatedTotalPrice]);
  const handleIncreaseCount = useCallback(() => {
    const nextValue = (parseManualEntryCount(count) ?? 0) + 1;
    setCount(String(nextValue));
    updateCalculatedTotalPrice(String(nextValue), unitPrice);
  }, [count, unitPrice, updateCalculatedTotalPrice]);

  const bg = colors.screen;
  const inputBg = colors.input;
  const inputBorder = colors.inputBorder;
  const selectedBg = colors.accentSofter;
  const listRowBorder = colors.divider;

  if (loading) {
    return (
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: '编辑记录', headerTitleAlign: 'center' }} />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const parsedCount = parseManualEntryCount(count);
  const parsedUnitPrice = parseManualEntryTotalPrice(unitPrice);
  const parsedTotalPrice = parseManualEntryTotalPrice(totalPrice);
  const showCountError = count.trim() !== '' && parsedCount == null;
  const showUnitPriceError = unitPrice.trim() !== '' && (Number.isNaN(parsedUnitPrice) || (parsedUnitPrice != null && parsedUnitPrice < 0));
  const showTotalPriceError = totalPrice.trim() !== '' && (Number.isNaN(parsedTotalPrice) || (parsedTotalPrice != null && parsedTotalPrice < 0));
  const showDateError = date.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date);
  const canSave = !!artistId && parsedCount != null && !showUnitPriceError && !showTotalPriceError && !showDateError && !saving;

  return (
    <>
      <Stack.Screen
        options={{
          title: '编辑记录',
          headerStyle: { backgroundColor: colors.header },
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerLeft: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={handleSave} disabled={!canSave} style={{ paddingRight: 4, opacity: canSave ? 1 : 0.4 }}>
              {saving
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Text style={{ color: canSave ? colors.accent : colors.textMuted, fontSize: 16, fontWeight: '700' }}>保存</Text>
              }
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        left={{ label: '取消', onPress: () => router.back(), disabled: saving }}
        right={{
          label: saving ? '保存中' : '保存',
          onPress: handleSave,
          disabled: !canSave,
          variant: 'done',
        }}
      />
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: bg }}>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'android' ? 200 : 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          enableAutomaticScroll
          extraHeight={140}
          extraScrollHeight={20}
        >
          <FormSectionLabel label="拍立得信息" />
          <FormCard>
            <FormFieldLabel required>艺人</FormFieldLabel>

            <ArtistSearchPicker
              artists={allArtists}
              selectedArtists={selectedArtist ? [selectedArtist] : []}
              selectedIds={artistId ? [artistId] : []}
              oshiArtistId={oshiArtistId}
              isDark={isDark}
              searchValue={artistSearch}
              onSearchChange={setArtistSearch}
              placeholder="搜索艺人..."
              maxHeight={220}
              parentNameMap={artistNameMap}
              onSelectArtist={(artist) => {
                setArtistId(artist.id);
                setArtistSearch('');
              }}
              onRemoveArtist={() => setArtistId(null)}
            />

            <View style={{ marginTop: 14 }}>
            <FormFieldLabel>日期</FormFieldLabel>
            <TextInput
              style={{
                backgroundColor: inputBg,
                borderRadius: 10, borderWidth: 1,
                borderColor: showDateError ? colors.danger : inputBorder,
                paddingHorizontal: 14, height: 44,
                fontSize: 15, color: colors.text,
              }}
              value={date}
              onChangeText={(value) => setDate(formatDateInput(value))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              returnKeyType="done"
            />
            </View>
            {showDateError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                日期格式应为 YYYY-MM-DD
              </Text>
            ) : null}

            <View style={{ marginTop: 14 }}>
            <FormFieldLabel required>数量</FormFieldLabel>
            <View
              style={{
                backgroundColor: inputBg,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: showCountError ? colors.danger : inputBorder,
                height: 44,
                flexDirection: 'row',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <TouchableOpacity
                onPress={handleDecreaseCount}
                activeOpacity={0.75}
                style={{
                  width: 44,
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRightWidth: 1,
                  borderRightColor: inputBorder,
                  opacity: (parseManualEntryCount(count) ?? 1) <= 1 ? 0.45 : 1,
                }}
              >
                <AppIcon name="remove" size={18} color={colors.text} />
              </TouchableOpacity>
              <TextInput
                style={{
                  flex: 1,
                  height: '100%',
                  textAlign: 'center',
                  fontSize: 15,
                  color: colors.text,
                  paddingHorizontal: 12,
                }}
                value={count}
                onChangeText={handleCountChange}
                placeholder="1"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleIncreaseCount}
                activeOpacity={0.75}
                style={{
                  width: 44,
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderLeftWidth: 1,
                  borderLeftColor: inputBorder,
                }}
              >
                <AppIcon name="add" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            </View>
            {showCountError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                数量至少为 1
              </Text>
            ) : null}
          </FormCard>

          <FormSectionLabel label="价格" />
          <FormCard>
            <FormFieldLabel>单价（每张）</FormFieldLabel>
            <Text style={{ marginTop: -4, marginBottom: 10, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
              填写后将根据数量自动计算总价
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: inputBg,
              borderRadius: 10, borderWidth: 1, borderColor: showUnitPriceError ? colors.danger : inputBorder,
              paddingHorizontal: 14, height: 44,
            }}>
              <Text style={{ fontSize: 15, color: colors.textMuted, marginRight: 6 }}>¥</Text>
              <TextInput
                style={{ flex: 1, fontSize: 15, color: colors.text }}
                value={unitPrice}
                onChangeText={handleUnitPriceChange}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            {showUnitPriceError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                {Number.isNaN(parsedUnitPrice) ? '请输入有效的单价' : '单价不能为负数'}
              </Text>
            ) : null}

            <View style={{ marginTop: 14 }}>
            <FormFieldLabel>总价</FormFieldLabel>
            <Text style={{ marginTop: -4, marginBottom: 10, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
              {unitPrice.trim() ? '已按单价和数量自动计算；直接修改可改为手动总价' : '可直接填写总价'}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: inputBg,
              borderRadius: 10, borderWidth: 1, borderColor: showTotalPriceError ? colors.danger : inputBorder,
              paddingHorizontal: 14, height: 44,
            }}>
              <Text style={{ fontSize: 15, color: colors.textMuted, marginRight: 6 }}>¥</Text>
              <TextInput
                style={{ flex: 1, fontSize: 15, color: colors.text }}
                value={totalPrice}
                onChangeText={handleTotalPriceChange}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            </View>
            {showTotalPriceError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                {Number.isNaN(parsedTotalPrice) ? '请输入有效的总价' : '总价不能为负数'}
              </Text>
            ) : null}
          </FormCard>

          <FormSectionLabel label="关联活动" />
          <FormCard>
            <FormFieldLabel>活动</FormFieldLabel>

            {selectedEvent ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: selectedBg, borderRadius: 10, padding: 12,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }} numberOfLines={1}>
                    {selectedEvent.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.accentText, marginTop: 1 }}>
                    {selectedEvent.event_date}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setEventId(null); setEventSearch(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppIcon name="closeCircle" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: inputBg,
                  borderRadius: 10, borderWidth: 1,
                  borderColor: inputBorder,
                  paddingHorizontal: 10, height: 44, marginBottom: 8,
                }}>
                  <AppIcon name="calendar" size={14} color={colors.placeholder} />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, color: colors.text }}
                    placeholder="输入日期搜索关联活动，如 2025-03"
                    placeholderTextColor={colors.placeholder}
                    value={eventSearch}
                    onChangeText={(value) => setEventSearch(formatDateInput(value))}
                    clearButtonMode="while-editing"
                    keyboardType="number-pad"
                    returnKeyType="search"
                  />
                </View>
                {eventSearch.trim() ? (
                  <View style={{
                    maxHeight: 220, borderRadius: 10, overflow: 'hidden',
                    borderWidth: 1, borderColor: inputBorder,
                  }}>
                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>
                      {filteredEvents.length === 0 ? (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: colors.textMuted }}>
                            该日期没有匹配的活动
                          </Text>
                        </View>
                      ) : filteredEvents.map((event, index) => {
                        const isLast = index === filteredEvents.length - 1;
                        return (
                          <TouchableOpacity
                            key={event.id}
                            onPress={() => { setEventId(event.id); setEventSearch(''); }}
                            activeOpacity={0.7}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingHorizontal: 12, paddingVertical: 10,
                              backgroundColor: colors.card,
                              borderBottomWidth: isLast ? 0 : 1,
                              borderBottomColor: listRowBorder,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }} numberOfLines={1}>
                                {event.title}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                                {event.event_date}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </>
            )}
          </FormCard>

          <TouchableOpacity
            onPress={handleDelete}
            style={{
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
              backgroundColor: colors.dangerSoft,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
            }}
          >
            <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>删除记录</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </>
  );
}

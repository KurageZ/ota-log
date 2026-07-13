import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AppIcon } from '../../../src/components/AppIcon';
import { useDB } from '../../../src/context/DBContext';
import { Artist, Cheki, Event } from '../../../src/types/models';
import { getArtistPrimaryName } from '../../../src/utils/artistDisplay';
import { ArtistSearchPicker } from '../../../src/components/ArtistSearchPicker';
import { FormCard, FormFieldLabel, FormSectionLabel } from '../../../src/components/FormPrimitives';
import { showDeleteFailedAlert, showSaveFailedAlert } from '../../../src/utils/failureAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAppTheme } from '../../../src/theme/appTheme';

function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

export default function EditChekiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors, isDark } = useAppTheme();

  const [cheki, setCheki] = useState<Cheki | null>(null);
  const [date, setDate] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [artistId, setArtistId] = useState<string | null>(null);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([db.cheki.findById(id), db.artists.findAll(), db.events.findAll(), db.userConfig.getConfig()]).then(([ck, artists, events, config]) => {
      if (!ck) { router.back(); return; }
      setCheki(ck);
      setDate(ck.date ?? '');
      setPrice(ck.price != null ? String(ck.price) : '');
      setNotes(ck.notes ?? '');
      setArtistId(ck.artist_id);
      setEventId(ck.event_id);
      setAllArtists(artists);
      setAllEvents(events);
      setOshiArtistId(config.oshi_artist_id);
      setLoading(false);
    });
  }, [db, id]);

  const selectedArtist = useMemo(
    () => allArtists.find((a) => a.id === artistId) ?? null,
    [allArtists, artistId],
  );
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );

  const filteredEvents = useMemo(
    () => eventSearch.trim()
      ? allEvents.filter(e => e.event_date.includes(eventSearch.trim()))
      : [],
    [allEvents, eventSearch],
  );

  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.id === eventId) ?? null,
    [allEvents, eventId],
  );

  useEffect(() => {
    if (!eventId) setEventSearch(date);
  }, [date, eventId]);

  const handleSave = async () => {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('日期格式应为 YYYY-MM-DD');
      return;
    }
    setSaving(true);
    try {
      const parsedPrice = price.trim() ? parseFloat(price) : null;
      await db.cheki.update(id, {
        date: date || null,
        artist_id: artistId,
        event_id: eventId,
        price: (parsedPrice != null && !isNaN(parsedPrice)) ? parsedPrice : null,
        notes: notes.trim() || null,
      });
      router.back();
    } catch (e) {
      showSaveFailedAlert(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('删除拍立得', '确认删除这张拍立得？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.cheki.delete(id);
            router.back();
          } catch (error) {
            showDeleteFailedAlert(error);
          }
        },
      },
    ]);
  };

  const bg = colors.screen;
  const inputBg = colors.input;
  const inputBorder = colors.inputBorder;
  const selectedBg = colors.accentSofter;
  const listRowBorder = colors.divider;

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: '编辑拍立得', headerTitleAlign: 'center' }} />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const parsedPriceVal = price.trim() ? Number(price.trim()) : null;
  const showPriceError = price.trim() !== '' && (Number.isNaN(parsedPriceVal) || (parsedPriceVal != null && parsedPriceVal < 0));
  const showDateError = date.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date);
  const canSave = !showPriceError && !showDateError && !saving;

  return (
    <>
      <Stack.Screen
        options={{
          title: '编辑拍立得',
          headerStyle: { backgroundColor: colors.header },
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTitleStyle: { color: colors.heading, fontWeight: '700' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={!canSave} style={{ paddingRight: 4, opacity: canSave ? 1 : 0.4 }}>
              {saving
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Text style={{ color: canSave ? colors.accent : colors.textMuted, fontSize: 16, fontWeight: '700' }}>保存</Text>
              }
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: bg }}>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'android' ? 200 : 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraHeight={140}          // 给输入框下方留出足够的上推安全空间
          extraScrollHeight={20}
        >
          {cheki?.photo_uri && (
            <>
              <FormSectionLabel label="图片" />
              <FormCard style={{ padding: 12, minHeight: 200 }}>
                <Image
                  key={cheki.photo_uri}
                  source={{ uri: cheki.photo_uri }}
                  style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }}
                  resizeMode="cover"
                />
              </FormCard>
            </>
          )}

          <FormSectionLabel label="拍立得信息" />
          <FormCard>
            <FormFieldLabel>艺人</FormFieldLabel>
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

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
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
                  onChangeText={v => setDate(formatDateInput(v))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormFieldLabel>价格</FormFieldLabel>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: inputBg,
                  borderRadius: 10, borderWidth: 1, borderColor: showPriceError ? colors.danger : inputBorder,
                  paddingHorizontal: 14, height: 44,
                }}>
                  <Text style={{ fontSize: 15, color: colors.textMuted, marginRight: 6 }}>¥</Text>
                  <TextInput
                    style={{ flex: 1, fontSize: 15, color: colors.text }}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>
            {showDateError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                日期格式应为 YYYY-MM-DD
              </Text>
            ) : null}
            {showPriceError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                {Number.isNaN(parsedPriceVal) ? '请输入有效的价格' : '价格不能为负数'}
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
                <TouchableOpacity
                  onPress={() => { setEventId(null); setEventSearch(''); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
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
                    onChangeText={v => setEventSearch(formatDateInput(v))}
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
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {filteredEvents.length === 0 ? (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: colors.textMuted }}>
                            该日期没有匹配的活动
                          </Text>
                        </View>
                      ) : filteredEvents.map((e, index) => {
                        const isLast = index === filteredEvents.length - 1;
                        return (
                          <TouchableOpacity
                            key={e.id}
                            onPress={() => { setEventId(e.id); setEventSearch(''); }}
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
                              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}
                                numberOfLines={1}>
                                {e.title}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                                {e.event_date}
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

          <FormSectionLabel label="备注" />
          <FormCard>
            <TextInput
              style={{
                backgroundColor: inputBg,
                borderRadius: 10, borderWidth: 1,
                borderColor: inputBorder,
                paddingHorizontal: 14, paddingVertical: 12,
                fontSize: 15, color: colors.text,
                minHeight: 80, textAlignVertical: 'top',
              }}
              value={notes}
              onChangeText={setNotes}
              placeholder="添加备注..."
              placeholderTextColor={colors.placeholder}
              multiline
              returnKeyType="default"
            />
          </FormCard>

          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.7}
            style={{
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
              backgroundColor: colors.dangerSoft,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
            }}
          >
            <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>删除拍立得</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </>
  );
}

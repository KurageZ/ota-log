import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDB } from '../context/DBContext';
import { useAppTheme } from '../theme/appTheme';
import type { Artist, Event } from '../types/models';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { resolveAvatarSource } from '../utils/avatarSource';
import { sortArtistsByPreference } from '../utils/filter';
import { isValidISODate } from '../utils/date';
import { showSaveFailedAlert } from '../utils/failureAlert';
import { hapticSaveSuccess } from '../utils/haptics';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../utils/safeArea';
import { ReadingContainer } from './adaptive/AppContainers';
import { ArtistSearchPicker } from './ArtistSearchPicker';
import { FormCard, FormFieldLabel, FormSectionLabel } from './FormPrimitives';
import { NativeTextToolbar } from './native-text-toolbar';
import { OshiAvatar } from './Oshi';
import { AppIcon } from './AppIcon';

type DraftRow = { artist: Artist; quantity: string; unitPrice: string };

function parseNonNegativeInteger(raw: string): number | null {
  if (!raw.trim()) return 0;
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export function EventChekiQuickAdd({ eventId }: { eventId: string }) {
  const db = useDB();
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const [event, setEvent] = useState<Event | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [addingArtist, setAddingArtist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const touchedPrices = useRef(new Set<string>());
  const savingRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const initialSnapshotRef = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [selectedEvent, allArtists, eventArtists, config] = await Promise.all([
        db.events.findById(eventId), db.artists.findAll(), db.events.getArtists(eventId), db.userConfig.getConfig(),
      ]);
      if (!selectedEvent) {
        setLoadError('活动不存在，可能已被删除。');
        return;
      }
      const eventCandidates = await Promise.all(eventArtists.map((artist) => (
        artist.artist_type === 'group'
          ? db.artists.findCurrentMembers(artist.id, selectedEvent.event_date)
          : Promise.resolve([artist])
      )));
      const initialArtists = [...new Map(eventCandidates.flat().map((artist) => [artist.id, artist])).values()];
      const priceEntries = await Promise.all(initialArtists.map(async (artist) => [
        artist.id, String(await db.chekiRecords.findLatestUnitPriceByArtistId(artist.id) ?? 0),
      ] as const));
      const latestPrices = Object.fromEntries(priceEntries);
      const initialRows = initialArtists.map((artist) => ({ artist, quantity: '0', unitPrice: latestPrices[artist.id] }));
      setEvent(selectedEvent);
      setArtists(allArtists);
      setOshiArtistId(config.oshi_artist_id);
      setPrices(latestPrices);
      setRows(initialRows);
      setDate(selectedEvent.event_date);
      initialSnapshotRef.current = JSON.stringify([selectedEvent.event_date, initialRows]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [db, eventId]);

  useEffect(() => { void load(); }, [load]);

  const isDirty = initialSnapshotRef.current !== '' && initialSnapshotRef.current !== JSON.stringify([date, rows]);
  useEffect(() => navigation.addListener('beforeRemove', (action) => {
    if (allowNavigationRef.current) return;
    if (savingRef.current) { action.preventDefault(); return; }
    if (!isDirty) return;
    action.preventDefault();
    Alert.alert('放弃本次添加？', '尚未保存的内容将会丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: () => {
        allowNavigationRef.current = true;
        navigation.dispatch(action.data.action);
      } },
    ]);
  }), [isDirty, navigation]);

  const sortedRows = useMemo(() => {
    const rowById = new Map(rows.map((row) => [row.artist.id, row]));
    return sortArtistsByPreference(rows.map((row) => row.artist), oshiArtistId, 'person', artists)
      .map((artist) => rowById.get(artist.id)!);
  }, [rows, oshiArtistId, artists]);
  const parsedRows = sortedRows.map((row) => ({ ...row, count: parseNonNegativeInteger(row.quantity), price: parseNonNegativeInteger(row.unitPrice) }));
  const selectedRows = parsedRows.filter((row) => row.count !== null && row.count > 0);
  const valid = parsedRows.every((row) => row.count !== null && (row.count === 0 || row.price !== null)) && isValidISODate(date);
  const canSave = !loading && !saving && !priceLoading && valid && selectedRows.length > 0;
  const quantity = selectedRows.reduce((sum, row) => sum + row.count!, 0);
  const total = selectedRows.reduce((sum, row) => sum + row.count! * (row.price ?? 0), 0);

  const updateRow = (artistId: string, change: Partial<Pick<DraftRow, 'quantity' | 'unitPrice'>>) => {
    if ('unitPrice' in change) touchedPrices.current.add(artistId);
    setRows((current) => current.map((row) => row.artist.id === artistId ? { ...row, ...change } : row));
  };

  const addArtist = async (artist: Artist) => {
    setAddingArtist(false);
    setSearch('');
    setRows((current) => [...current, { artist, quantity: '0', unitPrice: prices[artist.id] ?? '0' }]);
    if (prices[artist.id] !== undefined) return;
    setPriceLoading(true);
    try {
      const price = String(await db.chekiRecords.findLatestUnitPriceByArtistId(artist.id) ?? 0);
      setPrices((current) => ({ ...current, [artist.id]: price }));
      // Preserve any price entered while the lookup was pending.
      setRows((current) => current.map((row) => row.artist.id === artist.id && !touchedPrices.current.has(artist.id) ? { ...row, unitPrice: price } : row));
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setPriceLoading(false);
    }
  };

  const save = async () => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await db.chekiRecords.createRecords(selectedRows.map((row) => ({
        event_id: eventId, artist_id: row.artist.id, date, quantity: row.count!, unit_price: row.price!,
      })));
      allowNavigationRef.current = true;
      hapticSaveSuccess();
      router.back();
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{
        title: '按活动快速添加', gestureEnabled: !saving,
        headerLeft: Platform.OS === 'ios' ? undefined : () => (
          <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} disabled={saving}><Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text></TouchableOpacity>
        ),
        headerRight: Platform.OS === 'ios' ? undefined : () => (
          <TouchableOpacity accessibilityRole="button" onPress={() => void save()} disabled={!canSave}><Text style={{ color: canSave ? colors.accent : colors.textMuted, fontSize: 16, fontWeight: '700' }}>{saving ? '保存中' : '保存'}</Text></TouchableOpacity>
        ),
      }} />
      <NativeTextToolbar left={{ label: '取消', onPress: () => router.back(), disabled: saving }} right={{ label: saving ? '保存中' : '保存', onPress: () => void save(), disabled: !canSave, variant: 'done' }} />
      {loading ? <ActivityIndicator style={{ flex: 1 }} color={colors.accent} /> : loadError ? (
        <ReadingContainer style={{ paddingVertical: 24, gap: 12 }}>
          <Text style={{ color: colors.text }}>{loadError}</Text>
          <TouchableOpacity onPress={() => void load()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>重新加载</Text></TouchableOpacity>
        </ReadingContainer>
      ) : (
        <KeyboardAwareScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" enableOnAndroid extraHeight={100} contentContainerStyle={{ paddingVertical: 16, paddingBottom: 60 }}>
          <ReadingContainer>
            <FormCard>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 12 }}>{event!.title}</Text>
              <FormFieldLabel>记录日期</FormFieldLabel>
              <TextInput accessibilityLabel="记录日期" editable={!saving} value={date} onChangeText={(raw) => {
                const digits = raw.replace(/\D/g, '').slice(0, 8);
                setDate(digits.length <= 4 ? digits : digits.length <= 6 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`);
              }} keyboardType="number-pad" placeholder="YYYY-MM-DD" placeholderTextColor={colors.placeholder} style={{ minHeight: 44, paddingHorizontal: 12, backgroundColor: colors.input, borderRadius: 10, color: colors.text, borderWidth: 1, borderColor: isValidISODate(date) ? colors.inputBorder : colors.danger }} />
              {!isValidISODate(date) ? <Text style={{ color: colors.danger, marginTop: 6 }}>请填写有效日期（YYYY-MM-DD）</Text> : null}
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 12 }}>填写本次新增的张数，数量为 0 的艺人不会保存。图片可以稍后补充。</Text>
            </FormCard>
            <FormSectionLabel label="艺人与数量" />
            {rows.length === 0 ? <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>暂无可展示的成员或个人艺人，请搜索添加本次拍摄的艺人。</Text> : null}
            {rows.length > 0 ? (
              <FormCard style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8 }}>
                  <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12 }}>艺人</Text>
                  <Text style={{ width: 128, textAlign: 'center', color: colors.textSecondary, fontSize: 12 }}>数量（张）</Text>
                  <Text style={{ width: 64, textAlign: 'center', color: colors.textSecondary, fontSize: 12 }}>单价（元）</Text>
                </View>
                {parsedRows.map((row, index) => {
                  const name = getArtistPrimaryName(row.artist);
                  return (
                    <View key={row.artist.id} style={{ paddingVertical: 8, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.divider }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexGrow: 1, flexShrink: 1, flexBasis: 80, minWidth: 72 }}>
                          <OshiAvatar source={resolveAvatarSource(row.artist.avatar_uri)} size={28} isOshi={row.artist.id === oshiArtistId} name={name} />
                          <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' }}>{name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${name}减少一张`} disabled={saving || !row.count} onPress={() => updateRow(row.artist.id, { quantity: String(row.count! - 1) })} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="remove" size={20} color={saving || !row.count ? colors.textMuted : colors.accent} /></TouchableOpacity>
                              <TextInput accessibilityLabel={`${name}数量`} editable={!saving} keyboardType="number-pad" value={row.quantity} onChangeText={(value) => updateRow(row.artist.id, { quantity: value })} style={{ width: 40, minHeight: 44, textAlign: 'center', backgroundColor: colors.input, color: colors.text, borderRadius: 8, fontSize: 17, fontVariant: ['tabular-nums'] }} />
                              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${name}增加一张`} disabled={saving} onPress={() => updateRow(row.artist.id, { quantity: String((row.count ?? 0) + 1) })} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="add" size={20} color={colors.accent} /></TouchableOpacity>
                            </View>
                          </View>
                          <View style={{ width: 64 }}>
                            <TextInput accessibilityLabel={`${name}单价`} editable={!saving} keyboardType="number-pad" value={row.unitPrice} placeholder="0" placeholderTextColor={colors.placeholder} onChangeText={(value) => updateRow(row.artist.id, { unitPrice: value })} style={{ minHeight: 44, paddingHorizontal: 6, textAlign: 'center', backgroundColor: colors.input, color: colors.text, borderRadius: 8, fontSize: 15 }} />
                          </View>
                      </View>
                      </View>
                      {row.count === null || (row.count > 0 && row.price === null) ? <Text style={{ color: colors.danger, marginTop: 8 }}>数量和单价须为非负整数</Text> : null}
                    </View>
                  );
                })}
              </FormCard>
            ) : null}
            {addingArtist ? (
              <FormCard>
                <ArtistSearchPicker artists={artists.filter((artist) => !rows.some((row) => row.artist.id === artist.id))} lookup={artists} oshiArtistId={oshiArtistId} isDark={isDark} searchValue={search} onSearchChange={setSearch} onSelectArtist={(artist) => void addArtist(artist)} onRemoveArtist={() => {}} typePreference="person" placeholder="搜索要添加的艺人…" />
              </FormCard>
            ) : (
              <TouchableOpacity disabled={saving || priceLoading} accessibilityLabel="添加艺人" accessibilityRole="button" onPress={() => setAddingArtist(true)} style={{ minHeight: 44, justifyContent: 'center', marginBottom: 12 }}><Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{priceLoading ? '正在读取单价…' : '＋ 添加艺人'}</Text></TouchableOpacity>
            )}
            <FormCard>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>共 {quantity} 张 · ¥{total}</Text>
              <TouchableOpacity accessibilityRole="button" disabled={!canSave} onPress={() => void save()} style={{ marginTop: 12, minHeight: 48, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: canSave ? colors.accent : colors.cardMuted }}>
                <Text style={{ color: canSave ? colors.onAccent : colors.textMuted, fontSize: 16, fontWeight: '700' }}>{saving ? '保存中…' : `保存 ${selectedRows.length} 位艺人的记录`}</Text>
              </TouchableOpacity>
            </FormCard>
          </ReadingContainer>
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}

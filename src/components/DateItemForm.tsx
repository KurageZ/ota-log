import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AppIcon, AppIconName } from './AppIcon';
import { ArtistSearchPicker } from './ArtistSearchPicker';
import { FormCard, FormFieldLabel } from './FormPrimitives';
import { OshiAvatar } from './Oshi';
import { SectionLabel } from './SettingsMenu';
import { useDB } from '../context/DBContext';
import { HydratedDateItem } from '../repositories/DateItemRepository';
import { useAppTheme } from '../theme/appTheme';
import type { ThemeColors } from '../theme/appTheme';
import { Artist, DateItemAnniversaryRule, DateItemSourceKind, Event } from '../types/models';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { resolveAvatarSource } from '../utils/avatarSource';
import { getDateItemPresetKind, getPresetDateItemTitle } from '../utils/dateItemDisplay';
import { toISODate } from '../utils/date';
import { showSaveFailedAlert } from '../utils/failureAlert';
import { withAlpha } from '../utils/color';
import { sortArtistsWithOshi } from '../utils/filter';

type AnniversaryDraft = Pick<DateItemAnniversaryRule, 'enabled'>;
type QuickPreset = 'custom' | 'activity' | 'firstCheki' | 'firstLive';
type FirstDateRow = { artist_id: string; first_date: string };

export type DateItemFormHandle = {
  submit: () => void;
};

const PRESET_TITLE: Record<Exclude<QuickPreset, 'custom' | 'activity'>, string> = {
  firstCheki: '纪念日：首次拍立得',
  firstLive: '纪念日：首次观看演出',
};

const QUICK_PRESETS: { key: Exclude<QuickPreset, 'custom'>; icon: AppIconName; title: string; subtitle: string }[] = [
  { key: 'activity', icon: 'calendar', title: '倒数日：关联未来活动', subtitle: '从未来活动创建倒数日' },
  { key: 'firstCheki', icon: 'cheki', title: '纪念日：首次拍立得', subtitle: '搜索艺人，自动创建首次拍立得纪念日' },
  { key: 'firstLive', icon: 'ticket', title: '纪念日：首次观看演出', subtitle: '搜索艺人，自动创建首次演出纪念日' },
];

const CUSTOM_PRESET: { key: 'custom'; icon: AppIconName; title: string; subtitle: string } = {
  key: 'custom',
  icon: 'edit',
  title: '自定义',
  subtitle: '手动填写标题、日期和关联艺人',
};

type PresetOption = { key: QuickPreset; icon: AppIconName; title: string; subtitle: string };

function PresetOptionCard({
  preset,
  selected,
  onPress,
  colors,
}: {
  preset: PresetOption;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={{
        minHeight: 76,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: selected ? colors.accentSofter : colors.card,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.divider,
      }}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: withAlpha(colors.accent, selected ? 0.18 : 0.1),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <AppIcon name={preset.icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', color: colors.text }}>{preset.title}</Text>
        <Text numberOfLines={2} style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary }}>{preset.subtitle}</Text>
      </View>
      {selected ? <AppIcon name="statusCompleted" size={20} color={colors.accent} /> : null}
    </TouchableOpacity>
  );
}

function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const DateItemForm = forwardRef<DateItemFormHandle, {
  initial?: HydratedDateItem | null;
  onSaved: (id: string) => void;
  hideSubmitButton?: boolean;
  onCanSaveChange?: (canSave: boolean) => void;
}>(function DateItemForm({
  initial,
  onSaved,
  hideSubmitButton = false,
  onCanSaveChange,
}, ref) {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [futureEvents, setFutureEvents] = useState<Event[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [firstChekiDateByArtistId, setFirstChekiDateByArtistId] = useState<Record<string, string>>({});
  const [firstLiveDateByArtistId, setFirstLiveDateByArtistId] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(initial?.item.title ?? '');
  const [titleTouched, setTitleTouched] = useState(!!initial);
  const [itemDate, setItemDate] = useState(initial?.item.date ?? toISODate(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initial?.item.linked_event_id ?? null);
  const [eventSearch, setEventSearch] = useState('');
  const [notes, setNotes] = useState(initial?.item.notes ?? '');
  const [showOnCalendar, setShowOnCalendar] = useState((initial?.item.show_on_calendar ?? 1) === 1);
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>(initial?.artists.map((artist) => artist.id) ?? []);
  const [artistSearch, setArtistSearch] = useState('');
  const [quickPreset, setQuickPreset] = useState<QuickPreset | null>(
    initial ? (initial.item.source_kind === 'linked_activity' ? 'activity' : 'custom') : null,
  );
  const [anniversaryDrafts, setAnniversaryDrafts] = useState<Record<string, AnniversaryDraft>>(() => (
    Object.fromEntries((initial?.anniversaries ?? []).map((anniversary) => [
      anniversary.id,
      {
        enabled: anniversary.enabled,
      },
    ]))
  ));
  const [saving, setSaving] = useState(false);
  const today = toISODate(new Date());

  useEffect(() => {
    Promise.all([
      db.artists.findAll(),
      db.events.findUpcoming(),
      initial?.item.linked_event_id ? db.events.findById(initial.item.linked_event_id) : Promise.resolve(null),
      db.userConfig.getConfig(),
      db.rawDb.getAllAsync<FirstDateRow>(
        `SELECT artist_id, MIN(COALESCE(date, created_at)) AS first_date
         FROM cheki_records
         WHERE artist_id IS NOT NULL
         GROUP BY artist_id`
      ),
      db.rawDb.getAllAsync<FirstDateRow>(
      `SELECT ea.artist_id, MIN(e.event_date) AS first_date
       FROM event_artists ea
       JOIN event_first_summaries e ON e.id = ea.event_id
         WHERE e.status = 'completed'
         GROUP BY ea.artist_id`
      ),
    ]).then(([artistRows, eventRows, initialLinkedEvent, config, chekiRows, liveRows]) => {
      const visibleEvents = eventRows.filter((event) => event.event_date >= today);
      if (initialLinkedEvent && !visibleEvents.some((event) => event.id === initialLinkedEvent.id)) {
        visibleEvents.unshift(initialLinkedEvent);
      }
      setArtists(artistRows);
      setFutureEvents(visibleEvents);
      setOshiArtistId(config.oshi_artist_id);
      setFirstChekiDateByArtistId(Object.fromEntries(chekiRows.map((row) => [row.artist_id, row.first_date.slice(0, 10)])));
      setFirstLiveDateByArtistId(Object.fromEntries(liveRows.map((row) => [row.artist_id, row.first_date])));
    }).catch(() => {});
  }, [db, initial?.item.linked_event_id, today]);

  const artistNameMap = useMemo(
    () => Object.fromEntries(artists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [artists],
  );
  const availableArtists = useMemo(() => {
    if (quickPreset === 'firstCheki') {
      return artists.filter((artist) => firstChekiDateByArtistId[artist.id]);
    }
    if (quickPreset === 'firstLive') {
      return artists.filter((artist) => firstLiveDateByArtistId[artist.id]);
    }
    return artists;
  }, [artists, firstChekiDateByArtistId, firstLiveDateByArtistId, quickPreset]);
  const selectedArtistSet = useMemo(() => new Set(selectedArtistIds), [selectedArtistIds]);
  const selectedArtists = useMemo(
    () => sortArtistsWithOshi(artists.filter((artist) => selectedArtistSet.has(artist.id)), oshiArtistId),
    [artists, oshiArtistId, selectedArtistSet],
  );
  const selectedEvent = useMemo(
    () => futureEvents.find((event) => event.id === selectedEventId) ?? null,
    [futureEvents, selectedEventId],
  );
  const isPresetArtistMode = quickPreset === 'firstCheki' || quickPreset === 'firstLive';
  const isSingleArtistMode = isPresetArtistMode || (!!initial && getDateItemPresetKind(initial.item) !== null);
  const filteredEvents = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();
    if (!query) return futureEvents.slice(0, 24);
    return futureEvents.filter((event) => (
      `${event.title} ${event.event_date} ${event.city ?? ''} ${event.venue ?? ''}`.toLowerCase().includes(query)
    )).slice(0, 40);
  }, [eventSearch, futureEvents]);
  const initialAnniversaries = initial?.anniversaries ?? [];

  const applyArtistPreset = (artist: Artist, willSelect: boolean) => {
    if (!willSelect || quickPreset !== 'firstCheki' && quickPreset !== 'firstLive') return;
    setTitle(getPresetDateItemTitle(quickPreset, artist));
    setItemDate(
      quickPreset === 'firstCheki'
        ? firstChekiDateByArtistId[artist.id]
        : firstLiveDateByArtistId[artist.id],
    );
    setTitleTouched(false);
  };

  const toggleArtist = (artist: Artist) => {
    const willSelect = !selectedArtistSet.has(artist.id);
    applyArtistPreset(artist, willSelect);
    if (isSingleArtistMode) {
      setSelectedArtistIds(willSelect ? [artist.id] : []);
      return;
    }
    setSelectedArtistIds((current) => (
      current.includes(artist.id)
        ? current.filter((id) => id !== artist.id)
        : [...current, artist.id]
    ));
  };

  const selectPreset = (preset: QuickPreset) => {
    setQuickPreset(preset);
    if (preset === 'activity') {
      setSelectedArtistIds([]);
      setSelectedEventId(null);
      setTitle('');
      setItemDate(today);
      setEventSearch('');
      setArtistSearch('');
      return;
    }
    setSelectedEventId(null);
    setSelectedArtistIds([]);
    setArtistSearch('');
    setEventSearch('');
    if (preset === 'firstCheki' || preset === 'firstLive') {
      setTitle(PRESET_TITLE[preset]);
      setItemDate(today);
      setTitleTouched(false);
      return;
    }
    setTitle('');
    setItemDate(today);
    setTitleTouched(false);
  };

  const selectEvent = (event: Event) => {
    setSelectedEventId(event.id);
    setItemDate(event.event_date);
    setTitle(event.title);
    setTitleTouched(false);
    setEventSearch(event.title);
    setSelectedArtistIds([]);
  };

  const clearSelectedEvent = () => {
    setSelectedEventId(null);
    setTitle('');
    setTitleTouched(false);
    setItemDate(today);
    setEventSearch('');
  };

  const clearSelectedPresetArtist = () => {
    setSelectedArtistIds([]);
    setItemDate(today);
    setArtistSearch('');
    if (quickPreset === 'firstCheki' || quickPreset === 'firstLive') {
      setTitle(PRESET_TITLE[quickPreset]);
    } else {
      setTitle('');
    }
    setTitleTouched(false);
  };

  const updateAnniversaryDraft = (anniversaryId: string, patch: Partial<AnniversaryDraft>) => {
    setAnniversaryDrafts((current) => ({
      ...current,
      [anniversaryId]: {
        ...current[anniversaryId],
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    if (!initial && !quickPreset) {
      Alert.alert('请选择创建方式');
      return;
    }
    if (!initial && quickPreset === 'activity' && !selectedEventId) {
      Alert.alert('请选择未来活动');
      return;
    }
    if (!initial && (quickPreset === 'firstCheki' || quickPreset === 'firstLive') && selectedArtistIds.length === 0) {
      Alert.alert('请选择艺人');
      return;
    }

    const selectedArtist = selectedArtistIds.length === 1
      ? artists.find((artist) => artist.id === selectedArtistIds[0]) ?? null
      : null;
    const presetTitle = !initial && quickPreset === 'firstCheki' && selectedArtist
      ? getPresetDateItemTitle('firstCheki', selectedArtist)
      : !initial && quickPreset === 'firstLive' && selectedArtist
        ? getPresetDateItemTitle('firstLive', selectedArtist)
        : title;
    const presetDate = !initial && quickPreset === 'firstCheki' && selectedArtist
      ? firstChekiDateByArtistId[selectedArtist.id]
      : !initial && quickPreset === 'firstLive' && selectedArtist
        ? firstLiveDateByArtistId[selectedArtist.id]
        : itemDate;
    const resolvedTitle = quickPreset === 'activity' && selectedEvent ? selectedEvent.title : presetTitle;
    const resolvedDate = quickPreset === 'activity' && selectedEvent ? selectedEvent.event_date : presetDate;
    const resolvedSourceKind: DateItemSourceKind = quickPreset === 'activity'
      ? 'linked_activity'
      : quickPreset === 'firstCheki'
        ? 'first_cheki'
        : quickPreset === 'firstLive'
          ? 'first_live'
          : initial?.item.source_kind ?? 'manual';
    const resolvedLinkedEventId = resolvedSourceKind === 'linked_activity' ? selectedEventId : null;
    const resolvedArtistIds = resolvedLinkedEventId ? [] : selectedArtistIds;
    const trimmedTitle = resolvedTitle.trim();
    if (!trimmedTitle) {
      Alert.alert('请填写标题');
      return;
    }
    if (!isValidDate(resolvedDate)) {
      Alert.alert('日期格式不正确', '请使用 YYYY-MM-DD 格式。');
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await db.dateItems.update(initial.item.id, {
          title: trimmedTitle,
          date: resolvedDate,
          source_kind: resolvedSourceKind,
          linked_event_id: resolvedLinkedEventId,
          notes,
          show_on_calendar: showOnCalendar,
          artistIds: resolvedArtistIds,
        });
        for (const [anniversaryId, draft] of Object.entries(anniversaryDrafts)) {
          await db.dateItems.updateAnniversaryRule(anniversaryId, draft);
        }
        onSaved(initial.item.id);
        return;
      }

      const created = await db.dateItems.create({
        title: trimmedTitle,
        date: resolvedDate,
        source_kind: resolvedSourceKind,
        linked_event_id: resolvedLinkedEventId,
        notes,
        show_on_calendar: showOnCalendar,
        artistIds: resolvedArtistIds,
      });
      onSaved(created.id);
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    submit: () => {
      void handleSave();
    },
  }));

  const inputStyle = {
    backgroundColor: colors.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    minHeight: 46,
    fontSize: 15,
    color: colors.text,
  };
  const showManualForm = !!initial || quickPreset === 'custom';
  const showArtistSearch = !selectedEventId && (showManualForm || quickPreset === 'firstCheki' || quickPreset === 'firstLive');
  const selectedPresetArtist = selectedArtistIds.length === 1
    ? artists.find((artist) => artist.id === selectedArtistIds[0]) ?? null
    : null;
  const selectedPresetDate = quickPreset === 'firstCheki' && selectedPresetArtist
    ? firstChekiDateByArtistId[selectedPresetArtist.id]
    : quickPreset === 'firstLive' && selectedPresetArtist
      ? firstLiveDateByArtistId[selectedPresetArtist.id]
      : null;
  const hasValidRequiredFields = useMemo(() => {
    if (saving) return false;
    if (initial) {
      return title.trim().length > 0
        && isValidDate(itemDate);
    }
    if (!quickPreset) return false;
    if (quickPreset === 'activity') return selectedEvent !== null;
    if (quickPreset === 'firstCheki' || quickPreset === 'firstLive') {
      return selectedPresetArtist !== null
        && selectedPresetDate !== null
        && isValidDate(selectedPresetDate);
    }
    return title.trim().length > 0
      && isValidDate(itemDate);
  }, [
    initial,
    itemDate,
    quickPreset,
    saving,
    selectedEvent,
    selectedPresetArtist,
    selectedPresetDate,
    title,
  ]);

  useEffect(() => {
    onCanSaveChange?.(hasValidRequiredFields);
  }, [hasValidRequiredFields, onCanSaveChange]);

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.screen }}
      contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'android' ? 200 : 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraHeight={140}
      extraScrollHeight={20}
    >
      {!initial ? (
        <View style={{ marginBottom: 22 }}>
          <Text style={{ marginBottom: 10, fontSize: 13, color: colors.textSecondary }}>
            使用模板创建
          </Text>
          <View style={{ gap: 8 }}>
            {QUICK_PRESETS.map((preset) => (
              <PresetOptionCard
                key={preset.key}
                preset={preset}
                selected={quickPreset === preset.key}
                onPress={() => selectPreset(preset.key)}
                colors={colors}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>或</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          </View>
          <PresetOptionCard
            preset={CUSTOM_PRESET}
            selected={quickPreset === 'custom'}
            onPress={() => selectPreset('custom')}
            colors={colors}
          />
        </View>
      ) : null}

      {quickPreset === 'activity' ? (
        <View style={{ marginBottom: 22 }}>
          <SectionLabel label="关联活动" />
          <FormCard style={{ marginBottom: 0 }}>
            {selectedEvent ? (
              <View style={{
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
                backgroundColor: isDark ? colors.accentPress : colors.accentSofter,
                borderWidth: 1,
                borderColor: withAlpha(colors.accent, 0.22),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: colors.accent }}>
                    {selectedEvent.title}
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 12, color: isDark ? colors.accentBorder : colors.accentStrong }}>
                    {selectedEvent.event_date}{selectedEvent.venue ? ` · ${selectedEvent.venue}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={clearSelectedEvent}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="移除已选活动"
                >
                  <AppIcon name="closeCircle" size={18} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: isDark ? colors.input : colors.cardMuted,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              paddingHorizontal: 10,
              height: 44,
              marginBottom: 8,
            }}>
              <AppIcon name="search" size={14} color={colors.placeholder} />
              <TextInput
                style={{ flex: 1, fontSize: 13, color: colors.text }}
                placeholder="搜索未来活动..."
                placeholderTextColor={colors.placeholder}
                value={eventSearch}
                onChangeText={setEventSearch}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
            <View style={{
              maxHeight: 220,
              borderRadius: 10,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}>
              {filteredEvents.length > 0 ? filteredEvents.map((event, index) => {
                const selected = event.id === selectedEventId;
                return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => selected ? clearSelectedEvent() : selectEvent(event)}
                    activeOpacity={0.7}
                    style={{
                      minHeight: 48,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      backgroundColor: selected ? colors.accentPress : colors.card,
                      borderBottomWidth: index === filteredEvents.length - 1 ? 0 : 1,
                      borderBottomColor: isDark ? colors.inputBorder : colors.cardAlt,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: selected ? '700' : '500', color: selected ? colors.accent : colors.text }}>
                          {event.title}
                        </Text>
                        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.textSecondary }}>
                          {event.event_date}{event.city ? ` · ${event.city}` : ''}{event.venue ? ` · ${event.venue}` : ''}
                        </Text>
                      </View>
                      {selected ? <AppIcon name="closeCircle" size={16} color={colors.accent} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              }) : (
                <View style={{ padding: 14, alignItems: 'center', backgroundColor: colors.card }}>
                  <Text style={{ fontSize: 13, color: colors.textMuted }}>
                    没有找到未来活动
                  </Text>
                </View>
              )}
            </View>
          </FormCard>
        </View>
      ) : null}

      {showManualForm ? (
        <>
          <SectionLabel label="基础信息" />
          <FormCard style={{ gap: 12, marginBottom: 22 }}>
            <View>
              <FormFieldLabel required>标题</FormFieldLabel>
              <TextInput
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  setTitleTouched(true);
                }}
                placeholder="例如 初见小春"
                placeholderTextColor={colors.placeholder}
                style={inputStyle}
              />
            </View>
            <View>
              <FormFieldLabel required>日期</FormFieldLabel>
              <TextInput
                value={itemDate}
                onChangeText={(value) => setItemDate(formatDateInput(value))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                style={inputStyle}
              />
            </View>
            <View>
              <FormFieldLabel>备注</FormFieldLabel>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="备注"
                placeholderTextColor={colors.placeholder}
                multiline
                style={[inputStyle, { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' }]}
              />
            </View>
          </FormCard>
        </>
      ) : null}

      {showArtistSearch ? (
        <View style={{ marginBottom: 22 }}>
          <SectionLabel label={quickPreset === 'firstCheki' || quickPreset === 'firstLive' ? '选择艺人' : '关联艺人'} />
          <FormCard style={{ marginBottom: 0 }}>
            {selectedPresetArtist && selectedPresetDate ? (
              <View style={{
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
                backgroundColor: isDark ? colors.accentPress : colors.accentSofter,
                borderWidth: 1,
                borderColor: withAlpha(colors.accent, 0.22),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
                <OshiAvatar
                  source={resolveAvatarSource(selectedPresetArtist.avatar_uri)}
                  size={36}
                  isOshi={selectedPresetArtist.id === oshiArtistId}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: colors.accent }}>
                    {quickPreset === 'firstCheki'
                      ? `与 ${getArtistPrimaryName(selectedPresetArtist)} 首次拍立得`
                      : `首次观看 ${getArtistPrimaryName(selectedPresetArtist)} 的演出`}
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 12, color: isDark ? colors.accentBorder : colors.accentStrong }}>
                    {selectedPresetDate}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={clearSelectedPresetArtist}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="移除已选艺人"
                >
                  <AppIcon name="closeCircle" size={18} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ) : null}
            <ArtistSearchPicker
              artists={availableArtists}
              selectedArtists={isPresetArtistMode ? [] : selectedArtists}
              selectedIds={selectedArtistSet}
              oshiArtistId={oshiArtistId}
              isDark={isDark}
              typePreference={quickPreset === 'firstCheki' ? 'person' : quickPreset === 'firstLive' ? 'group' : undefined}
              searchValue={artistSearch}
              onSearchChange={setArtistSearch}
              placeholder="搜索艺人..."
              maxHeight={220}
              parentNameMap={artistNameMap}
              onSelectArtist={toggleArtist}
              onRemoveArtist={toggleArtist}
            />
          </FormCard>
        </View>
      ) : null}

      {showManualForm ? (
        <>
          <SectionLabel label="日历" />
          <View style={{
            borderRadius: 18,
            backgroundColor: colors.card,
            overflow: 'hidden',
            marginBottom: 22,
          }}>
            <View style={{ minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>展示在日历</Text>
              <Switch
                value={showOnCalendar}
                onValueChange={setShowOnCalendar}
                trackColor={{ false: colors.inputBorder, true: withAlpha(colors.accent, 0.38) }}
                thumbColor={showOnCalendar ? colors.accent : colors.card}
                style={{ alignSelf: 'center' }}
              />
            </View>
          </View>
        </>
      ) : null}

      {initialAnniversaries.length > 0 ? (
        <>
          <SectionLabel label="纪念日设置" />
          <View style={{ borderRadius: 18, backgroundColor: colors.card, overflow: 'hidden', marginBottom: 22 }}>
            {initialAnniversaries.map((anniversary, index) => {
              const draft = anniversaryDrafts[anniversary.id];
              return (
                <View key={anniversary.id} style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderBottomWidth: index === initialAnniversaries.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}>
                  <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                      {anniversary.label}
                    </Text>
                    <Switch
                      value={draft?.enabled === 1}
                      onValueChange={(value) => updateAnniversaryDraft(anniversary.id, { enabled: value ? 1 : 0 })}
                      trackColor={{ false: colors.inputBorder, true: withAlpha(colors.accent, 0.38) }}
                      thumbColor={draft?.enabled === 1 ? colors.accent : colors.card}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {!hideSubmitButton ? (
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={hasValidRequiredFields ? 0.85 : 1}
          disabled={!hasValidRequiredFields}
          style={{
            minHeight: 48,
            borderRadius: 14,
            backgroundColor: hasValidRequiredFields ? colors.accent : colors.inputBorder,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: hasValidRequiredFields ? 1 : 0.65,
          }}
        >
          {saving ? <ActivityIndicator size="small" color={colors.onAccent} /> : <AppIcon name="checkbox" variant="selected" size={18} color={colors.onAccent} />}
          <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '800' }}>
            保存
          </Text>
        </TouchableOpacity>
      ) : null}
    </KeyboardAwareScrollView>
  );
});

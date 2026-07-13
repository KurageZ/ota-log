import { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { copyToDocuments } from '../utils/copyToDocuments';
import { Artist, EventStatus } from '../types/models';
import { useDB } from '../context/DBContext';
import { toISODate } from '../utils/date';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { filterArtistsByQuery, sortArtistsWithOshi } from '../utils/filter';
import { ArtistSearchPicker } from './ArtistSearchPicker';
import { EventStatusChips } from './EventStatusChips';
import { showPhotoLibraryPermissionAlert, showSaveFailedAlert } from '../utils/failureAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { AppIcon } from './AppIcon';
import { FormFieldLabel, FormSectionLabel } from './FormPrimitives';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EventFormValues {
  title: string;
  event_date: string;
  event_time: string;
  city: string;
  venue: string;
  status: EventStatus;
  trip_id: string | null;
  ticket_price: string;
  url: string;
  notes: string;
  details: string;
  artist_ids: string[];
  setlist_text: string;
  review_score: number | null;
}

export const defaultFormValues: EventFormValues = {
  title: '',
  event_date: toISODate(new Date()),
  event_time: '',
  city: '',
  venue: '',
  status: 'planned',
  trip_id: null,
  ticket_price: '',
  url: '',
  notes: '',
  details: '',
  artist_ids: [],
  setlist_text: '',
  review_score: null,
};

interface Props {
  mode?: 'create' | 'edit';
  initialValues?: Partial<EventFormValues>;
  onSubmit: (values: EventFormValues) => Promise<void>;
  submitLabel?: string;
  hideSubmitButton?: boolean;
  photoUris?: string[];
  onPhotoAdd?: (uri: string) => void;
  onPhotoRemove?: (uri: string) => void;
  leadingContent?: React.ReactNode;
}

export interface EventFormHandle {
  submit: () => void;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function formatDateInput(raw: string, previousValue?: string): string {
  let digits = raw.replace(/\D/g, '').slice(0, 8);
  const isDeleting = previousValue != null && raw.length < previousValue.length;

  if (
    isDeleting &&
    previousValue.endsWith('-') &&
    raw === previousValue.slice(0, -1)
  ) {
    digits = digits.slice(0, -1);
  }

  if (digits.length < 4) return digits;
  if (digits.length === 4) return `${digits}-`;
  if (digits.length < 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length === 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function normalizeDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;

  const year = digits.slice(0, 4);
  const monthDigits = digits.slice(4, 6);
  const dayDigits = digits.slice(6, 8);

  if (digits.length === 5) return `${year}-0${monthDigits}`;
  if (digits.length === 6) return `${year}-${monthDigits}`;
  if (digits.length === 7) return `${year}-${monthDigits}-0${dayDigits}`;
  return `${year}-${monthDigits}-${dayDigits}`;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader({
  label,
  actionLabel,
  onActionPress,
}: {
  label: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textSecondary }}>
        {label}
      </Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: withAlpha(colors.accent, 0.1),
          }}
        >
          <AppIcon name="add" size={14} color={colors.accent} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function FieldInput({
  value, onChangeText, placeholder, isDark,
  keyboardType, multiline, numberOfLines, onSubmitEditing, returnKeyType, onBlur, maxLength, hasError,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  isDark: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  numberOfLines?: number;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'go';
  onBlur?: () => void;
  maxLength?: number;
  hasError?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <TextInput
      style={{
        backgroundColor: colors.input,
        borderRadius: 12, borderWidth: 1,
        borderColor: hasError ? colors.danger : colors.inputBorder,
        paddingHorizontal: 14,
        paddingVertical: multiline ? 10 : 0,
        height: multiline ? undefined : 46,
        minHeight: multiline ? 80 : undefined,
        fontSize: 15, color: colors.text,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      keyboardType={keyboardType ?? 'default'}
      multiline={multiline}
      numberOfLines={numberOfLines}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType ?? 'next'}
      blurOnSubmit={!multiline}
      onBlur={onBlur}
      maxLength={maxLength}
    />
  );
}

// ── FormPhotoThumb ────────────────────────────────────────────────────────────

const FORM_PH = 140;

function FormPhotoThumb({ uri, isDark, onRemove }: {
  uri: string; isDark: boolean; onRemove: () => void;
}) {
  const { colors } = useAppTheme();
  const [w, setW] = useState<number>(FORM_PH);
  return (
    <View style={{ marginRight: 4 }}>
      <View style={{
        width: w, height: FORM_PH, borderRadius: 10, overflow: 'hidden',
        backgroundColor: isDark ? colors.cardMuted : colors.cardAlt,
      }}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onLoad={(e) => {
            const { width: iw, height: ih } = e.nativeEvent.source;
            setW(ih > 0 ? Math.max(40, Math.round(FORM_PH * iw / ih)) : FORM_PH);
          }}
        />
      </View>
      <TouchableOpacity
        onPress={onRemove}
        activeOpacity={0.8}
        style={{
          position: 'absolute', top: 6, right: 6,
          backgroundColor: colors.scrim, borderRadius: 12, padding: 5
        }}
      >
        <AppIcon name="trash" size={13} color={colors.onAccent} />
      </TouchableOpacity>
    </View>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 16, padding: 16, marginBottom: 12 }}>
      {children}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const EventForm = forwardRef<EventFormHandle, Props>(function EventForm(
  {
    mode = 'create',
    initialValues,
    onSubmit,
    submitLabel = '保存',
    hideSubmitButton,
    photoUris,
    onPhotoAdd,
    onPhotoRemove,
    leadingContent,
  },
  ref,
) {
  const db = useDB();
  const { colors, isDark } = useAppTheme();

  const merged = { ...defaultFormValues, ...initialValues };

  const [title, setTitle] = useState(merged.title);
  const [eventDate, setEventDate] = useState(merged.event_date);
  const [eventTime, setEventTime] = useState(merged.event_time);
  const [city, setCity] = useState(merged.city);
  const [venue, setVenue] = useState(merged.venue);
  const [status, setStatus] = useState<EventStatus>(merged.status);
  const [tripId, setTripId] = useState<string | null>(merged.trip_id);
  const [ticketPrice, setTicketPrice] = useState(merged.ticket_price);
  const [url, setUrl] = useState(merged.url);
  const [notes, setNotes] = useState(merged.notes);
  const [details, setDetails] = useState(merged.details);
  const [artistIds, setArtistIds] = useState<string[]>(merged.artist_ids);
  const [setlistText, setSetlistText] = useState(merged.setlist_text);
  const [reviewScore, setReviewScore] = useState<number | null>(merged.review_score);

  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [venueSuggestions, setVenueSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [eventDateTouched, setEventDateTouched] = useState(false);
  const [ticketPriceTouched, setTicketPriceTouched] = useState(false);
  const [didTrySubmit, setDidTrySubmit] = useState(false);

  useEffect(() => {
    Promise.all([db.artists.findAll(), db.userConfig.getConfig()]).then(([artists, config]) => {
      setAllArtists(artists);
      setOshiArtistId(config.oshi_artist_id);
    });
  }, [db]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return;
    if (eventDate >= toISODate(new Date())) return;
    if (status === 'cancelled' || status === 'completed') return;
    setStatus('completed');
  }, [eventDate, mode, status]);

  useEffect(() => {
    const query = venue.trim();
    if (query.length < 1) {
      setVenueSuggestions([]);
      return;
    }

    let active = true;
    db.events.findVenueSuggestions(query).then((suggestions) => {
      if (!active) return;
      const normalizedQuery = query.toLowerCase();
      setVenueSuggestions(
        suggestions.filter((item) => item.toLowerCase() !== normalizedQuery)
      );
    });

    return () => {
      active = false;
    };
  }, [db, venue]);

  const toggleArtist = useCallback((id: string) => {
    setArtistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleAddArtistFromSearch = async () => {
    const name = artistSearch.trim();
    if (!name) return;
    const artist = await db.artists.create(name);
    setAllArtists((prev) => [...prev, artist]);
    setArtistIds((prev) => [...prev, artist.id]);
    setArtistSearch('');
  };

  const handleSelectVenueSuggestion = useCallback((suggestion: string) => {
    setVenue(suggestion);
    setVenueSuggestions([]);
  }, []);

  const filteredArtists = useMemo(() => {
    return filterArtistsByQuery(allArtists, artistSearch, oshiArtistId);
  }, [allArtists, artistSearch, oshiArtistId]);

  const artistIdSet = useMemo(() => new Set(artistIds), [artistIds]);

  const selectedArtists = useMemo(
    () => sortArtistsWithOshi(allArtists.filter((a) => artistIdSet.has(a.id)), oshiArtistId),
    [allArtists, artistIdSet, oshiArtistId],
  );
  const titleError = useMemo(() => {
    if (!title.trim()) return '请填写活动标题';
    return null;
  }, [title]);
  const eventDateError = useMemo(() => {
    if (!eventDate.trim()) return '请填写活动日期';
    if (eventDate.length < 10) return '日期格式应为 YYYY-MM-DD';
    if (!isValidISODate(eventDate)) return '请输入有效日期，例如 2026-05-15';
    return null;
  }, [eventDate]);
  const ticketPriceError = useMemo(() => {
    const trimmed = ticketPrice.trim();
    if (!trimmed) return null;
    return Number.isFinite(Number(trimmed)) ? null : '票价请输入有效数字';
  }, [ticketPrice]);
  const showTitleError = (titleTouched || didTrySubmit) && titleError != null;
  const showEventDateError = (eventDateTouched || didTrySubmit) && eventDateError != null;
  const showTicketPriceError = (ticketPriceTouched || didTrySubmit) && ticketPriceError != null;
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const canCreateArtistFromSearch = useMemo(() => {
    const query = artistSearch.trim();
    if (!query) return false;
    return filteredArtists.length === 0;
  }, [artistSearch, filteredArtists]);

  const handlePickInfoPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showPhotoLibraryPermissionAlert(); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const permanentUri = await copyToDocuments(asset.uri);
      onPhotoAdd?.(permanentUri);
    }
  };

  const handleSave = async () => {
    setDidTrySubmit(true);
    if (titleError) { Alert.alert(titleError); return; }
    if (eventDateError) { Alert.alert(eventDateError); return; }
    if (ticketPriceError) { Alert.alert(ticketPriceError); return; }

    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        event_date: eventDate, event_time: eventTime.trim(),
        city: city.trim(), venue: venue.trim(), status,
        trip_id: tripId, ticket_price: ticketPrice,
        url: url.trim(), notes: notes.trim(), details: details.trim(),
        artist_ids: artistIds, setlist_text: setlistText.trim(),
        review_score: status === 'completed' ? reviewScore : null,
      });
    } catch (e) {
      showSaveFailedAlert(e);
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({ submit: handleSave }));

  const cardBg = colors.card;

  return (
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
      {leadingContent}

      {/* 活动信息 */}
      <FormSectionLabel label="活动信息" />
      <Card bg={cardBg}>
        <FormFieldLabel required>活动名称</FormFieldLabel>
        <FieldInput
          value={title}
          onChangeText={setTitle}
          placeholder="活动名称"
          isDark={isDark}
          onBlur={() => setTitleTouched(true)}
          hasError={showTitleError}
        />
        {showTitleError ? (
          <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
            {titleError}
          </Text>
        ) : null}

        <View style={{ marginTop: 14 }}>
          <FormFieldLabel required>状态</FormFieldLabel>
          <EventStatusChips value={status} onChange={setStatus} isDark={isDark} />
        </View>

        {status === 'completed' && (
          <View style={{ marginTop: 14 }}>
            <FormFieldLabel>回顾评分</FormFieldLabel>
            <View style={{ flexDirection: 'row' }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setReviewScore(reviewScore === i ? null : i)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={{ fontSize: 32, color: reviewScore != null && i <= reviewScore ? colors.starActive : colors.inputBorder }}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 2 }}>
            <FormFieldLabel required>日期</FormFieldLabel>
            <FieldInput
              value={eventDate}
              onChangeText={(text) => setEventDate((current) => formatDateInput(text, current))}
              onBlur={() => {
                setEventDateTouched(true);
                setEventDate((current) => normalizeDateInput(current));
              }}
              placeholder="YYYY-MM-DD"
              isDark={isDark}
              keyboardType="numeric"
              maxLength={10}
              hasError={showEventDateError}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormFieldLabel>时间</FormFieldLabel>
            <FieldInput value={eventTime} onChangeText={(t) => setEventTime(formatTimeInput(t))} placeholder="HH:MM" isDark={isDark} keyboardType="numeric" />
          </View>
        </View>
        {showEventDateError ? (
          <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
            {eventDateError}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <FormFieldLabel>城市</FormFieldLabel>
            <FieldInput value={city} onChangeText={setCity} placeholder="城市" isDark={isDark} />
          </View>
          <View style={{ flex: 2 }}>
            <FormFieldLabel>场地</FormFieldLabel>
            <FieldInput value={venue} onChangeText={setVenue} placeholder="场地名称" isDark={isDark} />
          </View>
        </View>
        {venueSuggestions.length > 0 ? (
          <View style={{
            marginTop: 10,
            borderRadius: 10,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}>
            {venueSuggestions.map((suggestion, index) => {
              const isLast = index === venueSuggestions.length - 1;
              return (
                <TouchableOpacity
                  key={suggestion}
                  activeOpacity={0.7}
                  onPress={() => handleSelectVenueSuggestion(suggestion)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: colors.input,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: isDark ? colors.inputBorder : colors.cardAlt,
                  }}
                >
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <FormFieldLabel>票价</FormFieldLabel>
            <FieldInput
              value={ticketPrice}
              onChangeText={setTicketPrice}
              placeholder="票价"
              isDark={isDark}
              keyboardType="decimal-pad"
              onBlur={() => setTicketPriceTouched(true)}
              hasError={showTicketPriceError}
            />
            {showTicketPriceError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                {ticketPriceError}
              </Text>
            ) : null}
          </View>
          <View style={{ flex: 2 }}>
            <FormFieldLabel>演出链接</FormFieldLabel>
            <FieldInput value={url} onChangeText={setUrl} placeholder="https://..." isDark={isDark} returnKeyType="next" />
          </View>
        </View>
      </Card>

      {/* 详细信息 */}
      <FormSectionLabel label="详细信息" />
      <Card bg={cardBg}>
        <CardHeader label="出演者" />
        <ArtistSearchPicker
          artists={allArtists}
          selectedArtists={selectedArtists}
          selectedIds={artistIdSet}
          oshiArtistId={oshiArtistId}
          isDark={isDark}
          searchValue={artistSearch}
          onSearchChange={setArtistSearch}
          parentNameMap={artistNameMap}
          placeholder="搜索或新建艺人..."
          idleEmptyText="搜索艺人或输入名称新建"
          maxVisibleSelected={3}
          selectedOverflowLabel={(_, total) => `展开全部 ${total} 位出演者`}
          onSelectArtist={(artist) => toggleArtist(artist.id)}
          onRemoveArtist={(artist) => toggleArtist(artist.id)}
          extraContentAfterSearch={
            canCreateArtistFromSearch ? (
              <TouchableOpacity
                onPress={handleAddArtistFromSearch}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  marginBottom: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.accent,
                  backgroundColor: isDark ? colors.accentSoft : withAlpha(colors.accent, 0.05),
                }}
              >
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: withAlpha(colors.accent, 0.14),
                }}>
                  <AppIcon name="artist" size={14} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                    新建艺人「{artistSearch.trim()}」
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? colors.accentBorder : colors.accentStrong, marginTop: 2 }}>
                    当前列表中没有匹配的艺人
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
        />
      </Card>

      <Card bg={cardBg}>
        <CardHeader label="演出详情" />
        <FieldInput
          value={details}
          onChangeText={setDetails}
          placeholder="演出公告原文、详细介绍等"
          isDark={isDark}
          multiline
          numberOfLines={5}
          returnKeyType="done"
        />
      </Card>

      <Card bg={cardBg}>
        <CardHeader label="资料图" actionLabel="添加" onActionPress={handlePickInfoPhoto} />

        {photoUris && photoUris.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photoUris.map((uri, idx) => (
              <FormPhotoThumb
                key={uri + idx}
                uri={uri}
                isDark={isDark}
                onRemove={() => onPhotoRemove?.(uri)}
              />
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity onPress={handlePickInfoPhoto} activeOpacity={0.7}
            style={{
              paddingVertical: 22, alignItems: 'center',
              borderWidth: 1.5, borderColor: colors.inputBorder,
              borderStyle: 'dashed', borderRadius: 10
            }}
          >
            <Text style={{ fontSize: 13, color: colors.placeholder }}>
              添加时间表、出演阵容等资料图
            </Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* 我的记录 */}
      <FormSectionLabel label="我的记录" />
      <Card bg={cardBg}>
        <CardHeader label="备注" />
        <FieldInput
          value={notes}
          onChangeText={setNotes}
          placeholder="抢票心得、交通安排、注意事项等"
          isDark={isDark}
          multiline
          numberOfLines={3}
          returnKeyType="done"
        />
      </Card>

      <Card bg={cardBg}>
        <CardHeader label="Setlist" />
        <TextInput
          style={{
            backgroundColor: colors.input,
            borderRadius: 12, borderWidth: 1,
            borderColor: colors.inputBorder,
            paddingHorizontal: 14, paddingVertical: 10,
            minHeight: 100, fontSize: 14,
            color: colors.text,
            textAlignVertical: 'top', lineHeight: 22,
          }}
          value={setlistText}
          onChangeText={setSetlistText}
          placeholder={'每行一首歌，例：\n01. 曲名\n02. 曲名'}
          placeholderTextColor={colors.placeholder}
          multiline
          returnKeyType="done"
          blurOnSubmit={false}
        />
      </Card>

      {/* Save */}
      {!hideSubmitButton && (
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? colors.accentBorder : colors.accent,
            borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', marginTop: 4,
          }}
        >
          {saving
            ? <ActivityIndicator color={colors.onAccent} />
            : <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>{submitLabel}</Text>
          }
        </TouchableOpacity>
      )}
    </KeyboardAwareScrollView>
  );
});

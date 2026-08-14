import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { copyToDocuments } from '../utils/copyToDocuments';
import { Artist, EventStatus } from '../types/models';
import { useDB } from '../context/DBContext';
import {
  formatDateInput,
  formatTimeInput,
  isValidISODate,
  isValidTime,
  normalizeDateInput,
  toISODate,
} from '../utils/date';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { filterArtistsByQuery } from '../utils/filter';
import { ArtistSearchPicker } from './ArtistSearchPicker';
import { EventStatusChips } from './EventStatusChips';
import { showPhotoLibraryPermissionAlert, showSaveFailedAlert } from '../utils/failureAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { AppIcon } from './AppIcon';
import { FormFieldLabel, FormSectionLabel } from './FormPrimitives';
import { generateId } from '../utils/uuid';
import {
  EventRatingStars,
} from './EventPrimitives';
import {
  EventTimetableEditor,
  getTimetableValidationError,
  type EventTimetableEntryDraft,
} from './EventTimetableEditor';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EventFormSessionValues {
  key: string;
  id?: string;
  title: string;
  session_date: string;
  end_date: string;
  open_time: string;
  start_time: string;
  end_time: string;
  city: string;
  venue: string;
  timetable: EventTimetableEntryDraft[];
}

export interface EventFormValues {
  title: string;
  sessions: EventFormSessionValues[];
  status: EventStatus;
  trip_id: string | null;
  actual_expense: string;
  url: string;
  notes: string;
  details: string;
  artist_ids: string[];
  setlist_text: string;
  review_score: number | null;
}

export type EventFormPrefill = Partial<EventFormValues> & {
  event_date?: string;
  event_time?: string;
  city?: string;
  venue?: string;
};

function createEmptySession(overrides: Partial<EventFormSessionValues> = {}): EventFormSessionValues {
  return {
    key: generateId(),
    title: '',
    session_date: toISODate(new Date()),
    end_date: '',
    open_time: '',
    start_time: '',
    end_time: '',
    city: '',
    venue: '',
    timetable: [],
    ...overrides,
  };
}

export const defaultFormValues: EventFormValues = {
  title: '',
  sessions: [createEmptySession()],
  status: 'planned',
  trip_id: null,
  actual_expense: '',
  url: '',
  notes: '',
  details: '',
  artist_ids: [],
  setlist_text: '',
  review_score: null,
};

interface Props {
  mode?: 'create' | 'edit';
  initialValues?: EventFormPrefill;
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

function normalizeInitialValues(initialValues?: EventFormPrefill): EventFormValues {
  const sessions = initialValues?.sessions?.length
    ? initialValues.sessions.map((session) => createEmptySession({ ...session, key: session.key || session.id || generateId() }))
    : [createEmptySession({
        session_date: initialValues?.event_date ?? toISODate(new Date()),
        open_time: initialValues?.event_time ?? '',
        city: initialValues?.city ?? '',
        venue: initialValues?.venue ?? '',
      })];
  return {
    ...defaultFormValues,
    ...initialValues,
    sessions,
  };
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

  const merged = normalizeInitialValues(initialValues);

  const [title, setTitle] = useState(merged.title);
  const [sessions, setSessions] = useState(merged.sessions);
  const [status, setStatus] = useState<EventStatus>(merged.status);
  const [tripId, setTripId] = useState<string | null>(merged.trip_id);
  const [actualExpense, setActualExpense] = useState(merged.actual_expense);
  const [url, setUrl] = useState(merged.url);
  const [notes, setNotes] = useState(merged.notes);
  const [details, setDetails] = useState(merged.details);
  const [artistIds, setArtistIds] = useState<string[]>(merged.artist_ids);
  const [setlistText, setSetlistText] = useState(merged.setlist_text);
  const [reviewScore, setReviewScore] = useState<number | null>(merged.review_score);

  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [activeVenueKey, setActiveVenueKey] = useState<string | null>(null);
  const [venueSuggestions, setVenueSuggestions] = useState<string[]>([]);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [sessionDateTouched, setSessionDateTouched] = useState<Set<string>>(new Set());
  const [actualExpenseTouched, setActualExpenseTouched] = useState(false);
  const [didTrySubmit, setDidTrySubmit] = useState(false);

  useEffect(() => {
    Promise.all([db.artists.findAll(), db.userConfig.getConfig()]).then(([artists, config]) => {
      setAllArtists(artists);
      setOshiArtistId(config.oshi_artist_id);
    });
  }, [db]);

  useEffect(() => {
    if (mode !== 'create') return;
    const lastDate = sessions.reduce((latest, session) => (
      (session.end_date || session.session_date) > latest
        ? (session.end_date || session.session_date)
        : latest
    ), '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return;
    if (lastDate >= toISODate(new Date())) return;
    if (status === 'cancelled' || status === 'completed') return;
    setStatus('completed');
  }, [sessions, mode, status]);

  useEffect(() => {
    const query = sessions.find((session) => session.key === activeVenueKey)?.venue.trim() ?? '';
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
  }, [activeVenueKey, db, sessions]);

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

  const updateSession = useCallback((key: string, patch: Partial<EventFormSessionValues>) => {
    setSessions((current) => current.map((session) => (
      session.key === key ? { ...session, ...patch } : session
    )));
  }, []);

  const handleSelectVenueSuggestion = useCallback((key: string, suggestion: string) => {
    updateSession(key, { venue: suggestion });
    setVenueSuggestions([]);
    setActiveVenueKey(null);
  }, [updateSession]);

  const moveSession = useCallback((index: number, direction: -1 | 1) => {
    setSessions((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }, []);

  const removeSession = useCallback((session: EventFormSessionValues) => {
    const remove = () => setSessions((current) => current.filter((item) => item.key !== session.key));
    if (!session.id) {
      remove();
      return;
    }
    Alert.alert(
      '删除这个场次？',
      '保存活动后，这个场次及其时间表会一并删除。',
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: remove },
      ],
    );
  }, []);

  const filteredArtists = useMemo(() => {
    return filterArtistsByQuery(allArtists, artistSearch, oshiArtistId);
  }, [allArtists, artistSearch, oshiArtistId]);

  const artistIdSet = useMemo(() => new Set(artistIds), [artistIds]);

  const selectedArtists = useMemo(() => {
    const artistMap = new Map(allArtists.map((artist) => [artist.id, artist]));
    return artistIds.flatMap((id) => {
      const artist = artistMap.get(id);
      return artist ? [artist] : [];
    });
  }, [allArtists, artistIds]);
  const titleError = useMemo(() => {
    if (!title.trim()) return '请填写活动标题';
    return null;
  }, [title]);
  const sessionErrors = useMemo(() => sessions.map((session) => {
    if (!session.session_date.trim()) return '请填写场次日期';
    if (!isValidISODate(session.session_date)) return '日期格式应为 YYYY-MM-DD';
    if (session.end_date && !isValidISODate(session.end_date)) return '结束日期格式应为 YYYY-MM-DD';
    if (session.end_date && session.end_date < session.session_date) return '结束日期不能早于开始日期';
    for (const value of [session.open_time, session.start_time, session.end_time]) {
      if (value && !isValidTime(value)) return '时间格式应为 HH:MM';
    }
    return null;
  }), [sessions]);
  const timetableErrors = useMemo(() => sessions.map((session, index) => {
    const error = getTimetableValidationError(session.timetable);
    if (!error || sessions.length === 1) return error;
    return `${session.title.trim() || `场次 ${index + 1}`}：${error}`;
  }), [sessions]);
  const actualExpenseError = useMemo(() => {
    const trimmed = actualExpense.trim();
    if (!trimmed) return null;
    const amount = Number(trimmed);
    return Number.isFinite(amount) && amount >= 0 ? null : '实际支出请输入不小于 0 的数字';
  }, [actualExpense]);
  const showTitleError = (titleTouched || didTrySubmit) && titleError != null;
  const showActualExpenseError = (actualExpenseTouched || didTrySubmit) && actualExpenseError != null;
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const canCreateArtistFromSearch = useMemo(() => {
    const query = artistSearch.trim();
    if (!query) return false;
    return filteredArtists.length === 0;
  }, [artistSearch, filteredArtists]);
  const advancedItemCount = useMemo(() => (
    sessions.reduce((count, session) => count + [
      session.title,
      session.end_time,
      session.end_date,
    ].filter(Boolean).length, 0)
    + [url, details].filter(Boolean).length
    + Math.max(0, sessions.length - 1)
  ), [details, sessions, url]);

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
    const firstSessionError = sessionErrors.find(Boolean);
    if (firstSessionError) {
      setAdvancedExpanded(true);
      Alert.alert(firstSessionError);
      return;
    }
    const firstTimetableError = timetableErrors.find(Boolean);
    if (firstTimetableError) { Alert.alert(firstTimetableError); return; }
    if (actualExpenseError) { Alert.alert(actualExpenseError); return; }

    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        sessions: sessions.map((session) => ({
          ...session,
          title: session.title.trim(),
          session_date: session.session_date,
          end_date: session.end_date.trim(),
          open_time: session.open_time.trim(),
          start_time: session.start_time.trim(),
          end_time: session.end_time.trim(),
          city: session.city.trim(),
          venue: session.venue.trim(),
          timetable: session.timetable.map((entry) => ({
            ...entry,
            title: entry.title.trim(),
            artist_id: artistIds.includes(entry.artist_id) ? entry.artist_id : '',
            start_time: entry.start_time.trim(),
            end_time: entry.end_time.trim(),
            notes: entry.notes.trim(),
          })),
        })),
        status, trip_id: tripId, actual_expense: actualExpense,
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

      </Card>

      <FormSectionLabel label="时间与地点" />
      {sessions.map((session, sessionIndex) => {
        const sessionError = sessionErrors[sessionIndex];
        const showSessionError = (sessionDateTouched.has(session.key) || didTrySubmit) && sessionError != null;
        return (
          <Card bg={cardBg} key={session.key}>
            {sessions.length > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>
                  场次 {sessionIndex + 1}
                </Text>
                <TouchableOpacity
                  accessibilityLabel="上移场次"
                  disabled={sessionIndex === 0}
                  onPress={() => moveSession(sessionIndex, -1)}
                  style={{ padding: 10, opacity: sessionIndex === 0 ? 0.3 : 1 }}
                >
                  <AppIcon name="chevron" variant="up" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="下移场次"
                  disabled={sessionIndex === sessions.length - 1}
                  onPress={() => moveSession(sessionIndex, 1)}
                  style={{ padding: 10, opacity: sessionIndex === sessions.length - 1 ? 0.3 : 1 }}
                >
                  <AppIcon name="chevron" variant="down" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="删除场次"
                  onPress={() => removeSession(session)}
                  style={{ padding: 10 }}
                >
                  <AppIcon name="trash" size={17} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 2 }}>
                <FormFieldLabel required>日期</FormFieldLabel>
                <FieldInput
                  value={session.session_date}
                  onChangeText={(text) => updateSession(session.key, {
                    session_date: formatDateInput(text, session.session_date),
                  })}
                  onBlur={() => {
                    setSessionDateTouched((current) => new Set(current).add(session.key));
                    updateSession(session.key, { session_date: normalizeDateInput(session.session_date) });
                  }}
                  placeholder="YYYY-MM-DD"
                  isDark={isDark}
                  keyboardType="numeric"
                  maxLength={10}
                  hasError={showSessionError}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormFieldLabel>开场</FormFieldLabel>
                <FieldInput
                  value={session.open_time}
                  onChangeText={(value) => updateSession(session.key, { open_time: formatTimeInput(value) })}
                  placeholder="HH:MM"
                  isDark={isDark}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormFieldLabel>开演</FormFieldLabel>
                <FieldInput
                  value={session.start_time}
                  onChangeText={(value) => updateSession(session.key, { start_time: formatTimeInput(value) })}
                  placeholder="HH:MM"
                  isDark={isDark}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>
            {showSessionError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>{sessionError}</Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <FormFieldLabel>城市</FormFieldLabel>
                <FieldInput
                  value={session.city}
                  onChangeText={(value) => updateSession(session.key, { city: value })}
                  placeholder="城市"
                  isDark={isDark}
                />
              </View>
              <View style={{ flex: 2 }}>
                <FormFieldLabel>场地</FormFieldLabel>
                <FieldInput
                  value={session.venue}
                  onChangeText={(value) => {
                    setActiveVenueKey(session.key);
                    updateSession(session.key, { venue: value });
                  }}
                  onBlur={() => setTimeout(() => setActiveVenueKey(null), 150)}
                  placeholder="输入部分名称即可匹配历史场地"
                  isDark={isDark}
                />
              </View>
            </View>
            {activeVenueKey === session.key && venueSuggestions.length > 0 ? (
              <View style={{
                marginTop: 10, borderRadius: 10, overflow: 'hidden',
                borderWidth: 1, borderColor: colors.inputBorder,
              }}>
                {venueSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={suggestion}
                    activeOpacity={0.7}
                    onPress={() => handleSelectVenueSuggestion(session.key, suggestion)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.input,
                      borderBottomWidth: index === venueSuggestions.length - 1 ? 0 : 1,
                      borderBottomColor: isDark ? colors.inputBorder : colors.cardAlt,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

          </Card>
        );
      })}

      {/* 资料图 */}
      <FormSectionLabel label="资料图" />
      <Card bg={cardBg}>
        <CardHeader label="活动资料图" actionLabel="添加" onActionPress={handlePickInfoPhoto} />

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
              添加海报、出演阵容等资料图
            </Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* 出演者 */}
      <FormSectionLabel label="出演者" />
      <Card bg={cardBg}>
        <ArtistSearchPicker
          artists={allArtists}
          selectedArtists={selectedArtists}
          selectedIds={artistIdSet}
          oshiArtistId={oshiArtistId}
          isDark={isDark}
          typePreference="group"
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

      {/* 时间表 */}
      <FormSectionLabel label="时间表" />
      {sessions.map((session, sessionIndex) => (
        <Card bg={cardBg} key={`timetable-${session.key}`}>
          {sessions.length > 1 ? (
            <CardHeader label={session.title.trim() || `场次 ${sessionIndex + 1}`} />
          ) : null}
          <EventTimetableEditor
            entries={session.timetable}
            artists={selectedArtists}
            onChange={(timetable) => updateSession(session.key, { timetable })}
          />
        </Card>
      ))}

      {/* 我的记录 */}
      <FormSectionLabel label="我的记录" />
      <Card bg={cardBg}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormFieldLabel>实际支出</FormFieldLabel>
            <FieldInput
              value={actualExpense}
              onChangeText={setActualExpense}
              placeholder="0"
              isDark={isDark}
              keyboardType="decimal-pad"
              onBlur={() => setActualExpenseTouched(true)}
              hasError={showActualExpenseError}
            />
          </View>
          {status === 'completed' ? (
            <View style={{ flex: 2 }}>
              <FormFieldLabel>回顾评分</FormFieldLabel>
              <View style={{ height: 46, flexDirection: 'row', alignItems: 'center' }}>
                <EventRatingStars
                  score={reviewScore}
                  size="lg"
                  onChange={(nextScore) => setReviewScore(reviewScore === nextScore ? null : nextScore)}
                />
              </View>
            </View>
          ) : null}
        </View>
        {showActualExpenseError ? (
          <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
            {actualExpenseError}
          </Text>
        ) : null}
        <View style={{ marginTop: 14 }}>
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
        </View>
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

      {/* 高级信息 */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="高级信息"
        accessibilityState={{ expanded: advancedExpanded }}
        activeOpacity={0.7}
        onPress={() => setAdvancedExpanded((current) => !current)}
        style={{
          minHeight: 52,
          marginTop: 4,
          marginBottom: advancedExpanded ? 8 : 12,
          paddingHorizontal: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ width: 3, height: 16, borderRadius: 999, backgroundColor: colors.accent }} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '500', color: colors.heading }}>
          高级信息
        </Text>
        {advancedItemCount > 0 ? (
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{advancedItemCount} 项已填写</Text>
        ) : null}
        <AppIcon name="chevron" variant={advancedExpanded ? 'up' : 'down'} size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      {advancedExpanded ? (
        <>
          {sessions.map((session, sessionIndex) => (
            <Card bg={cardBg} key={`advanced-${session.key}`}>
              <CardHeader label={sessions.length > 1 ? `场次 ${sessionIndex + 1}` : '补充时间信息'} />
              <FormFieldLabel>{sessions.length === 1 ? '补充名称' : '场次名称'}</FormFieldLabel>
              <FieldInput
                value={session.title}
                onChangeText={(titleValue) => updateSession(session.key, { title: titleValue })}
                placeholder="如：昼场、夜场、DAY 1"
                isDark={isDark}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <FormFieldLabel>结束时间</FormFieldLabel>
                  <FieldInput
                    value={session.end_time}
                    onChangeText={(value) => updateSession(session.key, { end_time: formatTimeInput(value) })}
                    placeholder="HH:MM"
                    isDark={isDark}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <FormFieldLabel>结束日期</FormFieldLabel>
                  <FieldInput
                    value={session.end_date}
                    onChangeText={(text) => updateSession(session.key, {
                      end_date: formatDateInput(text, session.end_date),
                    })}
                    onBlur={() => updateSession(session.key, { end_date: normalizeDateInput(session.end_date) })}
                    placeholder="跨日时填写 YYYY-MM-DD"
                    isDark={isDark}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
            </Card>
          ))}

          <TouchableOpacity
            onPress={() => setSessions((current) => [...current, createEmptySession()])}
            activeOpacity={0.7}
            style={{
              minHeight: 48, marginBottom: 12, borderRadius: 14, borderWidth: 1,
              borderStyle: 'dashed', borderColor: colors.accent,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: withAlpha(colors.accent, isDark ? 0.1 : 0.05),
            }}
          >
            <AppIcon name="add" size={18} color={colors.accent} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>
              {sessions.length === 1 ? '添加其他场次' : '添加场次'}
            </Text>
          </TouchableOpacity>

          <Card bg={cardBg}>
            <FormFieldLabel>演出链接</FormFieldLabel>
            <FieldInput value={url} onChangeText={setUrl} placeholder="https://..." isDark={isDark} returnKeyType="next" />
            <View style={{ marginTop: 14 }}>
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
            </View>
          </Card>
        </>
      ) : null}

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

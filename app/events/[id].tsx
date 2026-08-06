import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Alert,
  Image, Modal, Linking, useWindowDimensions, Platform, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Calendar from 'expo-calendar/legacy';
import Clipboard from '@react-native-clipboard/clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useDB } from '../../src/context/DBContext';
import {
  Event, Artist, Cheki, ChekiManualEntry, Photo, EventStatus,
  EventSession, EventTimetableEntry,
} from '../../src/types/models';
import { formatDate, daysUntil } from '../../src/utils/date';
import { STATUS_LABELS, STATUS_VALUES } from '../../src/utils/labels';
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { copyToDocuments } from '../../src/utils/copyToDocuments';
import { buildChekiViewerItems, getChekiManualCount } from '../../src/utils/cheki';
import { ChekiViewerModal } from '../../src/components/ChekiViewerModal';
import type { ChekiViewerItem } from '../../src/types/chekiViewer';
import {
  FullscreenImageItem,
  FullscreenImageViewer,
} from '../../src/components/FullscreenImageViewer';
import { OshiAvatar, OshiBadge, OshiMatchBadge } from '../../src/components/Oshi';
import { EventRatingStars } from '../../src/components/EventPrimitives';
import { showDeleteFailedAlert, showOperationFailedAlert, showPhotoLibraryPermissionAlert } from '../../src/utils/failureAlert';
import { getOshiMatchSource } from '../../src/utils/oshiMatch';
import { useAppTheme } from '../../src/theme/appTheme';
import { ChekiManualEntryList } from '../../src/components/ChekiManualEntryList';
import { withAlpha } from '../../src/utils/color';
import { AppIcon, type AppIconName } from '../../src/components/AppIcon';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import { addEventToSystemCalendar } from '../../src/utils/systemCalendar';

const INFO_PH = 160;
const CHEKI_PREVIEW_LIMIT = 9;
const TOAST_DURATION_MS = 1600;

const STATUS_ACTION_META: Record<EventStatus, { icon: AppIconName }> = {
  planned: { icon: 'statusPlanned' },
  wishlist: { icon: 'statusWishlist' },
  completed: { icon: 'statusCompleted' },
  cancelled: { icon: 'statusCancelled' },
};

function InfoPhotoThumb({ photo, isDark, onPress }: {
  photo: Photo; isDark: boolean; onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const [w, setW] = useState<number | null>(null);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ marginRight: 4 }}>
      <View style={{
        width: w ?? INFO_PH, height: INFO_PH, borderRadius: 10, overflow: 'hidden',
        backgroundColor: isDark ? colors.cardMuted : colors.cardAlt,
        opacity: w !== null ? 1 : 0,
      }}>
        <Image
          source={{ uri: photo.local_uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onLoad={(e) => {
            const { width: iw, height: ih } = e.nativeEvent.source;
            setW(ih > 0 ? Math.max(40, Math.round(INFO_PH * iw / ih)) : INFO_PH);
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

function InfoRow({ icon, text, isDark }: { icon: AppIconName; text: string; isDark: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <AppIcon name={icon} size={15} color={colors.textSecondary} style={{ marginRight: 8 }} />
      <Text style={{ fontSize: 14, color: colors.textSecondary, flex: 1 }}>{text}</Text>
    </View>
  );
}

function formatSessionTime(session: EventSession): string | null {
  const parts = [
    session.open_time ? `开场 ${session.open_time}` : null,
    session.start_time ? `开始 ${session.start_time}` : null,
    session.end_time ? `结束 ${session.end_time}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function SessionSummaryRow({
  session,
  index,
  isLast,
  embedded = false,
  eventStatus,
  addingSessionId,
  onAddToCalendar,
}: {
  session: EventSession;
  index: number;
  isLast: boolean;
  embedded?: boolean;
  eventStatus: EventStatus;
  addingSessionId: string | null;
  onAddToCalendar: (session: EventSession) => void;
}) {
  const { colors } = useAppTheme();
  const sessionTime = formatSessionTime(session);
  const location = [session.venue, session.city].filter(Boolean).join(' · ');
  const displayTitle = session.title || (embedded ? null : `场次 ${index + 1}`);
  const calendarSubject = session.title || (embedded ? '活动' : `场次 ${index + 1}`);

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingTop: embedded ? 15 : 11,
        paddingBottom: 11,
        marginTop: embedded ? 10 : 0,
        borderTopWidth: embedded ? 1 : 0,
        borderTopColor: colors.divider,
        borderBottomWidth: !embedded && !isLast ? 1 : 0,
        borderBottomColor: colors.divider,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {displayTitle ? (
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
            {displayTitle}
          </Text>
        ) : null}
        <Text style={{
          marginTop: displayTitle ? 4 : 0,
          fontSize: displayTitle ? 13 : 15,
          fontWeight: displayTitle ? '400' : '700',
          color: displayTitle ? colors.textSecondary : colors.text,
        }}>
          {formatDate(session.session_date)}
          {session.end_date ? ` – ${formatDate(session.end_date)}` : ''}
        </Text>
        {sessionTime ? (
          <Text style={{ marginTop: 3, fontSize: 12.5, color: colors.textMuted }}>
            {sessionTime}
          </Text>
        ) : null}
        {location ? (
          <Text style={{ marginTop: 3, fontSize: 12.5, color: colors.textMuted }}>
            {location}
          </Text>
        ) : null}
      </View>
      {eventStatus !== 'cancelled' ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`将${calendarSubject}添加到日历`}
          activeOpacity={0.7}
          disabled={addingSessionId != null}
          onPress={() => onAddToCalendar(session)}
          style={{
            width: 44, height: 44, borderRadius: 22,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: withAlpha(colors.accent, 0.1),
            opacity: addingSessionId && addingSessionId !== session.id ? 0.4 : 1,
          }}
        >
          <AppIcon name="calendar" size={18} color={colors.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function formatTimetableTime(start: string | null, end: string | null): string {
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? '—';
}

// M10: module-level to avoid re-mounting subtrees on every render
function Card({ children, cardBg, style }: { children: React.ReactNode; cardBg: string; style?: object }) {
  return (
    <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 16, marginBottom: 12, ...style }}>
      {children}
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    }}>
      <View style={{
        width: 3,
        height: 16,
        borderRadius: 999,
        backgroundColor: colors.accent,
      }}
      />
      <Text style={{
        fontSize: 17,
        lineHeight: 35,
        fontWeight: '500',
        color: colors.heading,
      }}>
        {label}
      </Text>
    </View>
  );
}

function CardHeader({
  label,
  count,
  actionLabel,
  onActionPress,
}: {
  label: string;
  count?: number;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textSecondary }}>
        {count != null ? `${label} (${count})` : label}
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

function InlineAction({
  icon,
  label,
  onPress,
  onLongPress,
  isDark,
  disabled = false,
  tint,
  backgroundColor,
  borderColor,
  trailingIcon,
  buttonRef,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  isDark: boolean;
  disabled?: boolean;
  tint?: string;
  backgroundColor?: string;
  borderColor?: string;
  trailingIcon?: AppIconName;
  buttonRef?: React.RefObject<View | null>;
}) {
  const { colors } = useAppTheme();
  const resolvedTint = tint ?? colors.accent;
  return (
    <TouchableOpacity
      ref={buttonRef}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: backgroundColor ?? (isDark ? colors.input : colors.cardAlt),
        borderWidth: 1,
        borderColor: borderColor ?? colors.inputBorder,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <AppIcon name={icon} size={14} color={resolvedTint} />
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: resolvedTint }}>
        {label}
      </Text>
      {trailingIcon ? <AppIcon name={trailingIcon} variant="down" size={13} color={resolvedTint} /> : null}
    </TouchableOpacity>
  );
}

function parseLocalDate(date: string, time?: string | null) {
  const [year, month, day] = date.split('-').map(Number);
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }
  return new Date(year, month - 1, day);
}

function buildCalendarEventPayload(event: Event, session: EventSession) {
  const hasTime = typeof session.start_time === 'string' && /^\d{2}:\d{2}$/.test(session.start_time);
  const location = [session.venue, session.city].filter(Boolean).join(' · ') || undefined;
  const notes = [
    event.notes ? `备注：${event.notes}` : null,
    event.url ? `链接：${event.url}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  if (!hasTime) {
    const startDate = parseLocalDate(session.session_date);
    const endDate = parseLocalDate(session.end_date ?? session.session_date);
    endDate.setDate(endDate.getDate() + 1);
    return {
      title: session.title ? `${event.title} · ${session.title}` : event.title,
      startDate,
      endDate,
      allDay: true,
      location,
      notes,
      url: event.url ?? undefined,
    };
  }

  const startDate = parseLocalDate(session.session_date, session.start_time);
  let endDate = session.end_time
    ? parseLocalDate(session.end_date ?? session.session_date, session.end_time)
    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  if (session.end_time && !session.end_date && endDate <= startDate) {
    endDate = new Date(endDate);
    endDate.setDate(endDate.getDate() + 1);
  }

  return {
    title: session.title ? `${event.title} · ${session.title}` : event.title,
    startDate,
    endDate,
    allDay: false,
    location,
    notes,
    url: event.url ?? undefined,
  };
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const chekiW = Math.floor((screenWidth - 80) / 3);
  const chekiH = Math.round(chekiW * 86 / 54);

  const [event, setEvent] = useState<Event | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [chekiList, setChekiList] = useState<Cheki[]>([]);
  const [manualEntries, setManualEntries] = useState<ChekiManualEntry[]>([]);
  const [viewerSelectedId, setViewerSelectedId] = useState<string | null>(null);
  const [infoPhotos, setInfoPhotos] = useState<Photo[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [timetables, setTimetables] = useState<Record<string, EventTimetableEntry[]>>({});
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);
  const [addingSessionId, setAddingSessionId] = useState<string | null>(null);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const statusPillRef = useRef<View | null>(null);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextLinkPressRef = useRef(false);
  const allArtistsMap = useMemo(() => new Map(allArtists.map(a => [a.id, a])), [allArtists]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
      }
    };
  }, []);


  const load = useCallback(async () => {
    if (!id) return;
    const [ev, ar, ck, manual, photos, allArs, config, loadedSessions] = await Promise.all([
      db.events.findById(id),
      db.events.getArtists(id),
      db.cheki.findByEventId(id),
      db.chekiManualEntries.findByEventId(id),
      db.photos.findByEventId(id),
      db.artists.findAll(),
      db.userConfig.getConfig(),
      db.eventSchedules.findSessions(id),
    ]);
    const loadedTimetables = await Promise.all(
      loadedSessions.map((session) => db.eventSchedules.findTimetable(session.id)),
    );
    setEvent(ev);
    setArtists(ar);
    setChekiList(ck);
    setManualEntries(manual);
    setInfoPhotos(photos);
    setAllArtists(allArs);
    setOshiArtistId(config.oshi_artist_id);
    setSessions(loadedSessions);
    setTimetables(Object.fromEntries(
      loadedSessions.map((session, index) => [session.id, loadedTimetables[index]]),
    ));
  }, [db, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleStatusChange = async (newStatus: EventStatus) => {
    if (!event || newStatus === event.status) return;
    await db.events.update(id!, { status: newStatus });
    setEvent(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleScoreChange = async (score: number) => {
    if (!event) return;
    const next = event.review_score === score ? null : score;
    await db.events.update(id!, { review_score: next });
    setEvent(prev => prev ? { ...prev, review_score: next } : prev);
  };

  const handleDelete = () => {
    Alert.alert('删除活动', `确认删除「${event?.title}」？此操作不可撤销。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          await db.events.delete(id!);
          router.back();
        },
      },
    ]);
  };

  const handleAddToSystemCalendar = async (session: EventSession) => {
    if (!event || addingSessionId) return;
    if (Platform.OS === 'web') {
      showOperationFailedAlert(
        'Web 端暂不支持直接写入系统日历。',
        '请在 iPhone 或 Android 设备上打开这个活动后再试一次。',
      );
      return;
    }

    try {
      setAddingSessionId(session.id);
      await addEventToSystemCalendar(buildCalendarEventPayload(event, session), Calendar);
    } catch (error) {
      showOperationFailedAlert(
        '无法打开系统日历。',
        '请确认设备已安装系统日历，并稍后再试一次。',
        error,
      );
    } finally {
      setAddingSessionId(null);
    }
  };

  const handleSelectStatus = async (status: EventStatus) => {
    setStatusMenuVisible(false);
    if (status !== event?.status) {
      await handleStatusChange(status);
    }
  };

  const handleOpenStatusPicker = () => {
    if (!statusPillRef.current) return;
    statusPillRef.current.measureInWindow((x, y, width, height) => {
      setStatusMenuAnchor({ x, y, width, height });
      setStatusMenuVisible(true);
    });
  };

  const handleOpenChekiCreate = () => {
    router.push({ pathname: '/cheki/new', params: { event_id: id, date: event?.event_date } });
  };

  const handleCopyEventUrl = useCallback(() => {
    if (!event?.url) return;
    suppressNextLinkPressRef.current = true;
    Clipboard.setString(event.url);
    if (Platform.OS !== 'web') {
      Vibration.vibrate(10);
    }
    setCopyToastVisible(true);
    if (copyToastTimerRef.current) {
      clearTimeout(copyToastTimerRef.current);
    }
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToastVisible(false);
      copyToastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, [event?.url]);

  const handleOpenEventUrl = useCallback(() => {
    if (!event?.url) return;
    if (suppressNextLinkPressRef.current) {
      suppressNextLinkPressRef.current = false;
      return;
    }
    Linking.openURL(event.url);
  }, [event?.url]);

  const handleAddInfoPhoto = async () => {
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
      await db.photos.create(permanentUri, id!);
    }
    load();
  };

  const handleDeleteInfoPhoto = (photo: Photo) => {
    Alert.alert('删除资料图', '确认删除这张资料图？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await db.photos.delete(photo.id);
            const deletedIndex = infoPhotos.findIndex((item) => item.id === photo.id);
            const remainingPhotos = infoPhotos.filter((item) => item.id !== photo.id);
            setInfoPhotos(remainingPhotos);
            setViewingPhotoId(
              remainingPhotos.length > 0
                ? remainingPhotos[Math.min(Math.max(deletedIndex, 0), remainingPhotos.length - 1)].id
                : null,
            );
          } catch {
            showDeleteFailedAlert();
          }
        },
      },
    ]);
  };

  const handleDeleteCheki = useCallback((chekiId: string) => {
    Alert.alert('删除拍立得', '确认删除这张拍立得？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await db.cheki.delete(chekiId);
            setViewerSelectedId(null);
            load();
          } catch {
            showDeleteFailedAlert();
          }
        },
      },
    ]);
  }, [db, load]);

  const handleToggleChekiFavorite = useCallback(async (item: ChekiViewerItem) => {
    const nextFavorite = item.isFavorite !== true;
    const itemId = item.itemId ?? item.id;
    setChekiList((current) => current.map((cheki) => (
      cheki.id === itemId ? { ...cheki, is_favorite: nextFavorite ? 1 : 0 } : cheki
    )));
    try {
      await db.cheki.setFavorite(itemId, nextFavorite);
    } catch {
      setChekiList((current) => current.map((cheki) => (
        cheki.id === itemId ? { ...cheki, is_favorite: nextFavorite ? 0 : 1 } : cheki
      )));
      Alert.alert('收藏失败', '暂时无法更新收藏状态，请稍后重试。');
    }
  }, [db]);

  const viewerItems = useMemo(
    () => buildChekiViewerItems(chekiList, allArtistsMap, new Map(event ? [[event.id, event]] : [])),
    [allArtistsMap, chekiList, event],
  );
  const infoPhotoViewerItems = useMemo<FullscreenImageItem[]>(
    () => infoPhotos.map((photo) => ({
      id: photo.id,
      photoUri: photo.local_uri,
    })),
    [infoPhotos],
  );
  const previewChekiList = useMemo(() => chekiList.slice(0, CHEKI_PREVIEW_LIMIT), [chekiList]);
  const hasMoreCheki = chekiList.length > CHEKI_PREVIEW_LIMIT;
  const totalChekiCount = chekiList.length + getChekiManualCount(manualEntries);

  if (!event) {
    return (
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: isDark ? colors.textMuted : colors.chevron }}>活动不存在</Text>
      </SafeAreaView>
    );
  }

  const bg = colors.screen;
  const cardBg = colors.card;
  const oshiArtist = oshiArtistId ? (allArtistsMap.get(oshiArtistId) ?? null) : null;
  const oshiMatchSource = oshiArtistId ? getOshiMatchSource(artists, oshiArtistId, oshiArtist) : null;
  const oshiArtistName = oshiArtist?.short_name || oshiArtist?.name || null;
  const currentStatusColors = colors.status[event.status];

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => router.push(`/events/${id}/edit`)} style={{ paddingRight: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>编辑</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        right={{
          label: '编辑',
          onPress: () => router.push(`/events/${id}/edit`),
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <Card cardBg={cardBg}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.heading,
            letterSpacing: -0.5, lineHeight: 29, marginBottom: 14 }}>
            {event.title}
          </Text>

          {oshiMatchSource && oshiArtistName ? (
            <OshiMatchBadge oshiArtistName={oshiArtistName} style={{ marginBottom: 12 }} />
          ) : null}

          {event.actual_expense != null && (
            <InfoRow icon="ticket" text={`实际支出 ¥${event.actual_expense.toFixed(2).replace(/\.00$/, '')}`} isDark={isDark} />
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 4 }}>
            <InlineAction
              icon={STATUS_ACTION_META[event.status].icon}
              label={STATUS_LABELS[event.status]}
              onPress={handleOpenStatusPicker}
              isDark={isDark}
              tint={currentStatusColors.accent}
              backgroundColor={currentStatusColors.bg}
              borderColor={withAlpha(currentStatusColors.accent, isDark ? 0.4 : 0.2)}
              trailingIcon="disclosure"
              buttonRef={statusPillRef}
            />
            {event.url ? (
              <InlineAction
                icon="link"
                label="链接"
                onPress={handleOpenEventUrl}
                onLongPress={handleCopyEventUrl}
                isDark={isDark}
              />
            ) : null}
          </View>
          {event.status === 'completed' ? (
            <View style={{ marginTop: 14 }}>
              <CardHeader label="回顾评分" />
              <EventRatingStars score={event.review_score} size="lg" onChange={handleScoreChange} />
              {event.review_score == null && (
                <Text style={{ fontSize: 12, color: colors.placeholder, marginTop: 6 }}>
                  点击星星评分
                </Text>
              )}
            </View>
          ) : null}
          {sessions.length === 1 ? (
            <SessionSummaryRow
              session={sessions[0]}
              index={0}
              isLast
              embedded
              eventStatus={event.status}
              addingSessionId={addingSessionId}
              onAddToCalendar={handleAddToSystemCalendar}
            />
          ) : null}
        </Card>

        {sessions.length > 1 ? (
          <>
            <SectionTitle label="场次" />
            <Card cardBg={cardBg}>
              {sessions.map((session, index) => (
                <SessionSummaryRow
                  key={session.id}
                  session={session}
                  index={index}
                  isLast={index === sessions.length - 1}
                  eventStatus={event.status}
                  addingSessionId={addingSessionId}
                  onAddToCalendar={handleAddToSystemCalendar}
                />
              ))}
            </Card>
          </>
        ) : null}

        {/* Mini countdown banner */}
        {event.status !== 'completed' && event.status !== 'cancelled' && (() => {
          const d = daysUntil(event.event_date);
          if (d < 0) return null;
          return (
            <View style={{
              backgroundColor: colors.heroBg, borderRadius: 20, padding: 18,
              marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              overflow: 'hidden',
            }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: colors.heroEyebrow }}>
                  距演出
                </Text>
                <Text style={{ fontSize: 13, color: colors.heroEyebrow, marginTop: 6 }}>还有</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                {d === 0 ? (
                  <Text style={{ color: colors.heroText, fontSize: 32, fontWeight: '900', lineHeight: 32 }}>就是今天！</Text>
                ) : (
                  <>
                    <Text style={{ color: colors.heroText, fontSize: 56, fontWeight: '900', lineHeight: 56 }}>{d}</Text>
                    <Text style={{ color: colors.heroSubtext, fontSize: 16, fontWeight: '600', marginLeft: 6, marginBottom: 6 }}>天</Text>
                  </>
                )}
              </View>
            </View>
          );
        })()}

        {sessions.some((session) => (timetables[session.id]?.length ?? 0) > 0) ? (
          <>
            <SectionTitle label="时间表" />
            {sessions.flatMap((session, sessionIndex) => {
              const entries = timetables[session.id] ?? [];
              if (entries.length === 0) return [];
              return [(
                <Card cardBg={cardBg} key={session.id}>
                  {sessions.length > 1 ? (
                    <Text style={{ marginBottom: 10, fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {session.title || `场次 ${sessionIndex + 1}`} · {formatDate(session.session_date)}
                    </Text>
                  ) : null}
                  {entries.map((entry, entryIndex) => {
                    const artist = entry.artist_id ? allArtistsMap.get(entry.artist_id) : null;
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        disabled={!artist}
                        onPress={() => artist && router.push(`/artists/${artist.id}`)}
                        activeOpacity={0.72}
                        style={{
                          flexDirection: 'row', gap: 12, paddingVertical: 9,
                          borderBottomWidth: entryIndex === entries.length - 1 ? 0 : 1,
                          borderBottomColor: colors.divider,
                        }}
                      >
                        <Text style={{ width: 82, fontSize: 12.5, fontWeight: '600', color: colors.accent }}>
                          {formatTimetableTime(entry.start_time, entry.end_time)}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                            {entry.title}
                          </Text>
                          {artist ? (
                            <Text style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }}>
                              {getArtistPrimaryName(artist)}
                            </Text>
                          ) : null}
                          {entry.notes ? (
                            <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: colors.textMuted }}>
                              {entry.notes}
                            </Text>
                          ) : null}
                        </View>
                        {artist ? <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </Card>
              )];
            })}
          </>
        ) : null}

        {/* 详细信息 */}
        <SectionTitle label="详细信息" />
        {artists.length > 0 && (
          <Card cardBg={cardBg}>
            <CardHeader label="出演者" count={artists.length} />
            {(() => {
              const artistBorder = colors.divider;
              const artistText = colors.text;
              return artists.map((a, index) => {
              const isLast = index === artists.length - 1;
              const isOshi = a.id === oshiArtistId;
              return (
                <TouchableOpacity
                  key={a.id}
                  activeOpacity={0.72}
                  onPress={() => router.push(`/artists/${a.id}`)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: artistBorder,
                  }}
                >
                  <View style={{ marginRight: 12 }}>
                    <OshiAvatar source={resolveAvatarSource(a.avatar_uri)} size={36} isOshi={isOshi} />
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        fontSize: 14,
                        fontWeight: isOshi ? '700' : '600',
                        color: isOshi ? colors.accent : artistText,
                      }}
                    >
                      {getArtistPrimaryName(a)}
                    </Text>
                    {isOshi ? <OshiBadge /> : null}
                  </View>
                  <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} />
                </TouchableOpacity>
              );
            });}
            )()}
          </Card>
        )}

        {event.details ? (
          <Card cardBg={cardBg}>
            <CardHeader label="演出详情" />
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>
              {event.details}
            </Text>
          </Card>
        ) : null}

        <Card cardBg={cardBg}>
          <CardHeader
            label="资料图"
            count={infoPhotos.length > 0 ? infoPhotos.length : undefined}
            actionLabel="添加"
            onActionPress={handleAddInfoPhoto}
          />

          {infoPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {infoPhotos.map((photo) => (
                <InfoPhotoThumb
                  key={photo.id}
                  photo={photo}
                  isDark={isDark}
                  onPress={() => setViewingPhotoId(photo.id)}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              onPress={handleAddInfoPhoto}
              activeOpacity={0.7}
              style={{ paddingVertical: 22, alignItems: 'center',
                borderWidth: 1.5, borderColor: colors.inputBorder,
                borderStyle: 'dashed', borderRadius: 10 }}
            >
              <Text style={{ fontSize: 13, color: colors.placeholder }}>
                添加海报、出演阵容等资料图
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* 我的记录 */}
        <SectionTitle label="我的记录" />
        <Card cardBg={cardBg}>
          <CardHeader
            label="拍立得"
            count={totalChekiCount}
            actionLabel="添加"
            onActionPress={handleOpenChekiCreate}
          />

          {chekiList.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {previewChekiList.map((ck) => (
                  <TouchableOpacity key={ck.id} onPress={() => setViewerSelectedId(ck.id)} activeOpacity={0.8}>
                    <Image
                      source={{ uri: ck.photo_uri }}
                      resizeMethod="resize"
                      style={{ width: chekiW, height: chekiH, borderRadius: 10,
                        backgroundColor: isDark ? colors.inputBorder : colors.cardAlt }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {hasMoreCheki ? (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/cheki', params: { event_id: id } })}
                  activeOpacity={0.7}
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    backgroundColor: withAlpha(colors.accent, 0.1),
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                    查看全部 {totalChekiCount} 张
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : manualEntries.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 13, color: colors.placeholder, textAlign: 'center' }}>
                还没有拍立得记录
              </Text>
              <TouchableOpacity
                onPress={handleOpenChekiCreate}
                activeOpacity={0.7}
                style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: withAlpha(colors.accent, 0.1) }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>去添加</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <ChekiManualEntryList
            entries={manualEntries}
            eventMap={new Map(event ? [[event.id, event]] : [])}
            isDark={isDark}
            artistMap={allArtistsMap}
            oshiArtistId={oshiArtistId}
            showArtistMeta
            onPressEntry={(entry) => router.push(`/cheki/records/${entry.id}`)}
          />
          {!hasMoreCheki && chekiList.length === 0 && manualEntries.length > 0 ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/cheki', params: { event_id: id } })}
              activeOpacity={0.7}
              style={{
                marginTop: 12,
                borderRadius: 12,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: withAlpha(colors.accent, 0.1),
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                查看全部 {totalChekiCount} 张
              </Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {event.notes ? (
          <Card cardBg={cardBg}>
            <CardHeader label="备注" />
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>
              {event.notes}
            </Text>
          </Card>
        ) : null}

        {event.setlist_text ? (
          <Card cardBg={cardBg}>
            <CardHeader label="Setlist" />
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 24, fontFamily: 'monospace' }}>
              {event.setlist_text}
            </Text>
          </Card>
        ) : null}

        {/* Delete */}
        <TouchableOpacity
          onPress={handleDelete}
          style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center',
            backgroundColor: withAlpha(colors.danger, 0.08), borderWidth: 1, borderColor: withAlpha(colors.danger, 0.2) }}
        >
          <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>删除活动</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cheki Viewer Modal */}
      <Modal
        visible={statusMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: withAlpha(colors.shadow, 0.1) }}
          onPress={() => setStatusMenuVisible(false)}
        >
          <View
            style={{
              position: 'absolute',
              top: statusMenuAnchor.y + statusMenuAnchor.height + 8,
              left: Math.min(
                Math.max(16, statusMenuAnchor.x + statusMenuAnchor.width - 180),
                Math.max(16, screenWidth - 196),
              ),
              width: 180,
              borderRadius: 16,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: isDark ? withAlpha(colors.white, 0.08) : withAlpha(colors.shadow, 0.06),
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: isDark ? 0.28 : 0.12,
              shadowRadius: 24,
              elevation: 8,
              overflow: 'hidden',
            }}
          >
            {STATUS_VALUES.map((status, index) => {
              const active = status === event.status;
              const statusColors = colors.status[status];
              return (
                <TouchableOpacity
                  key={status}
                  onPress={() => handleSelectStatus(status)}
                  activeOpacity={0.72}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: active ? statusColors.bg : 'transparent',
                    borderBottomWidth: index === STATUS_VALUES.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? statusColors.accent : colors.text }}>
                    {STATUS_LABELS[status]}
                  </Text>
                  {active ? <AppIcon name="statusCompleted" size={16} color={statusColors.accent} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <ChekiViewerModal
        visible={viewerSelectedId !== null}
        items={viewerItems}
        selectedId={viewerSelectedId}
        onClose={() => setViewerSelectedId(null)}
        onEdit={(item) => router.push(`/cheki/items/${item.itemId ?? item.id}/edit`)}
        onDelete={(item) => handleDeleteCheki(item.itemId ?? item.id)}
        onToggleFavorite={(item) => void handleToggleChekiFavorite(item)}
      />

      <FullscreenImageViewer
        visible={viewingPhotoId !== null}
        items={infoPhotoViewerItems}
        selectedId={viewingPhotoId}
        onClose={() => setViewingPhotoId(null)}
        onDelete={(item) => {
          const photo = infoPhotos.find((candidate) => candidate.id === item.id);
          if (photo) {
            handleDeleteInfoPhoto(photo);
          }
        }}
      />

      {copyToastVisible ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 26,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              maxWidth: '100%',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 9,
              backgroundColor: isDark ? withAlpha(colors.heading, 0.92) : withAlpha(colors.text, 0.82),
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.white }}>
              链接已复制
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Alert,
  Image, Modal, Linking, useWindowDimensions, Platform, ActivityIndicator, TextStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Calendar from 'expo-calendar/legacy';
import { File } from 'expo-file-system';
import Clipboard from '@react-native-clipboard/clipboard';
import { useDB } from '../../src/context/DBContext';
import {
  Event, Artist, Cheki, ChekiManualEntry, Photo, EventStatus,
  EventSession, EventTimetableEntry, UserConfig,
} from '../../src/types/models';
import { formatDateWithWeekday, formatDate, daysUntil } from '../../src/utils/date';
import { STATUS_LABELS, STATUS_VALUES } from '../../src/utils/labels';
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { buildChekiViewerItems, getChekiManualCount } from '../../src/utils/cheki';
import { ChekiViewerModal } from '../../src/components/ChekiViewerModal';
import type { ChekiViewerItem } from '../../src/types/chekiViewer';
import {
  FullscreenImageItem,
  FullscreenImageViewer,
} from '../../src/components/FullscreenImageViewer';
import { OshiAvatar, OshiBadge, OshiMatchBadge } from '../../src/components/Oshi';
import {
  EventRatingStars,
  EventStatusChip,
  formatEventTimes,
} from '../../src/components/EventPrimitives';
import {
  showDeleteFailedAlert,
  showFailureAlert,
  showOperationFailedAlert,
} from '../../src/utils/failureAlert';
import { hapticCopySuccess } from '../../src/utils/haptics';
import { getOshiMatchSource } from '../../src/utils/oshiMatch';
import { useAppTheme } from '../../src/theme/appTheme';
import { ChekiManualEntryList } from '../../src/components/ChekiManualEntryList';
import {
  CHEKI_SQUARE_GRID_GAP,
  ChekiGridThumbnail,
} from '../../src/components/ChekiAlbumThumbnail';
import { withAlpha } from '../../src/utils/color';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { BottomSheetDialog } from '../../src/components/BottomSheetDialog';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import {
  addEventToSystemCalendar,
  buildEventSessionCalendarPayload,
} from '../../src/utils/systemCalendar';
import {
  buildEventShareAction,
  resolveEventShareSessions,
} from '../../src/utils/eventShare';
import { createEventSharePoster } from '../../src/features/event-share/create-event-share-poster';
import { ImageResultPreview } from '../../src/components/ImageResultPreview';
import { saveImageToAlbum, shareImageFile } from '../../src/utils/imageShare';

const INFO_PH = 160;
const CHEKI_PREVIEW_LIMIT = 9;
const TOAST_DURATION_MS = 1600;
const TIMETABLE_TIME_COLUMN_WIDTH = 102;
const DETAIL_LIST_ITEM_MIN_HEIGHT = 56;
const DETAILS_PREVIEW_LINES = 3;
const ARTIST_LIST_ITEM_VERTICAL_PADDING = 10;
const TIMETABLE_ENTRY_VERTICAL_PADDING = 6;

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

function SessionSummaryRow({
  session,
  index,
  isLast,
  embedded = false,
  countdownDays = null,
}: {
  session: EventSession;
  index: number;
  isLast: boolean;
  embedded?: boolean;
  countdownDays?: number | null;
}) {
  const { colors } = useAppTheme();
  const location = [session.city, session.venue].filter(Boolean).join(' · ');
  const timeSummary = formatEventTimes(session.open_time, session.start_time) || '时间待定';
  const dateSummary = formatDateWithWeekday(session.session_date);
  const displayTitle = session.title || (embedded ? null : `场次 ${index + 1}`);

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingTop: embedded ? 0 : 11,
        paddingBottom: embedded ? 0 : 11,
        marginTop: 0,
        borderTopWidth: 0,
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
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.88}
          style={{
            marginTop: displayTitle ? 8 : 0,
            fontSize: 16,
            lineHeight: 23,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            color: colors.text,
          }}
        >
          {dateSummary}
        </Text>
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppIcon name="time" size={14} color={colors.textSecondary} />
          <Text
            style={{
              flex: 1,
              fontSize: 14.5,
              lineHeight: 20,
              fontWeight: '500',
              fontVariant: ['tabular-nums'],
              color: colors.textSecondary,
            }}
            numberOfLines={1}
          >
            {timeSummary}
          </Text>
        </View>
        {location ? (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="eventLocation" size={14} color={colors.textSecondary} />
            <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}>
              {location}
            </Text>
          </View>
        ) : null}
      </View>
      {countdownDays != null ? (
        <View style={{ alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 20,
              lineHeight: 24,
              fontWeight: '900',
              fontVariant: ['tabular-nums'],
              color: colors.accent,
            }}
          >
            {countdownDays === 0 ? '今天' : `${countdownDays} 天`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * 场次紧凑行：参考 EventRow 的设计（标题 + 单行元信息 + 分隔线），
 * 仅展示在场次间存在差异的日期 / 时间 / 地点字段。
 */
function SessionCompactRow({
  session,
  index,
  isLast,
  showDate,
  showTime,
  showLocation,
}: {
  session: EventSession;
  index: number;
  isLast: boolean;
  showDate: boolean;
  showTime: boolean;
  showLocation: boolean;
}) {
  const { colors } = useAppTheme();
  const sessionTime = formatEventTimes(session.open_time, session.start_time) || '时间待定';
  const sessionLocation = [session.city, session.venue].filter(Boolean).join(' · ');
  const metaPieces: Array<{ key: string; node: React.ReactNode }> = [];
  if (showDate && session.session_date) {
    metaPieces.push({
      key: 'date',
      node: (
        <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
          {formatDateWithWeekday(session.session_date)}
        </Text>
      ),
    });
  }
  if (showTime && sessionTime) {
    metaPieces.push({
      key: 'time',
      node: (
        <>
          <AppIcon name="time" size={12} color={colors.textMuted} />
          <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            {sessionTime}
          </Text>
        </>
      ),
    });
  }
  if (showLocation && sessionLocation) {
    metaPieces.push({
      key: 'location',
      node: (
        <>
          <AppIcon name="eventLocation" size={12} color={colors.textMuted} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            {sessionLocation}
          </Text>
        </>
      ),
    });
  }

  return (
    <View style={{
      minHeight: 52,
      paddingVertical: 8,
      justifyContent: 'center',
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: colors.divider,
    }}>
      <Text numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 18, fontWeight: '700', color: colors.text }}>
        {session.title?.trim() || `场次 ${index + 1}`}
      </Text>
      {metaPieces.length > 0 ? (
        <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 }}>
          {metaPieces.map((piece, index) => (
            <Fragment key={piece.key}>
              {index > 0 ? (
                <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>·</Text>
              ) : null}
              {piece.node}
            </Fragment>
          ))}
        </View>
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

function ExpansionToggle({
  expanded,
  collapsedLabel,
  expandedLabel,
  accessibilityLabel,
  onPress,
  style,
}: {
  expanded: boolean;
  collapsedLabel: string;
  expandedLabel: string;
  accessibilityLabel: string;
  onPress: () => void;
  style?: object;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded }}
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        minHeight: 44,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        ...style,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
        {expanded ? expandedLabel : collapsedLabel}
      </Text>
      <AppIcon name="chevron" variant={expanded ? 'up' : 'down'} size={15} color={colors.accent} />
    </TouchableOpacity>
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

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors, isDark, chekiDisplayMode } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const chekiW = Math.floor((screenWidth - 80) / 3);
  const chekiH = chekiDisplayMode === 'original'
    ? chekiW
    : Math.round(chekiW * 86 / 54);

  const [event, setEvent] = useState<Event | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [chekiList, setChekiList] = useState<Cheki[]>([]);
  const [manualEntries, setManualEntries] = useState<ChekiManualEntry[]>([]);
  const [viewerSelectedId, setViewerSelectedId] = useState<string | null>(null);
  const [infoPhotos, setInfoPhotos] = useState<Photo[]>([]);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [timetables, setTimetables] = useState<Record<string, EventTimetableEntry[]>>({});
  const [collapsedTimetableSessionIds, setCollapsedTimetableSessionIds] = useState<Set<string>>(() => new Set());
  const [artistsExpanded, setArtistsExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [detailsOverflows, setDetailsOverflows] = useState(false);
  const [oshiIsAttributed, setOshiIsAttributed] = useState(false);
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);
  const [addingSessionId, setAddingSessionId] = useState<string | null>(null);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);
  const [shareMenuVisible, setShareMenuVisible] = useState(false);
  const [calendarSessionPickerVisible, setCalendarSessionPickerVisible] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [sharePosterUri, setSharePosterUri] = useState<string | null>(null);
  const [sharePreviewBusy, setSharePreviewBusy] = useState<'saving' | 'sharing' | null>(null);
  const [sharePosterSaved, setSharePosterSaved] = useState(false);
  const statusPillRef = useRef<View | null>(null);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharePosterUriRef = useRef<string | null>(null);
  const suppressNextLinkPressRef = useRef(false);
  const allArtistsMap = useMemo(() => new Map(allArtists.map(a => [a.id, a])), [allArtists]);
  const overviewCountdownDays = useMemo(() => {
    if (!event) return null;
    if (event.status !== 'planned' && event.status !== 'wishlist') return null;
    const d = daysUntil(event.event_date);
    return d >= 0 ? d : null;
  }, [event]);
  const multiSessionOverview = useMemo(() => {
    if (sessions.length <= 1) return null;
    const dates = sessions.map((session) => session.session_date).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const dateSummary = startDate === endDate
      ? formatDateWithWeekday(startDate)
      : `${formatDateWithWeekday(startDate)} – ${formatDateWithWeekday(endDate)}`;
    const locations = sessions
      .map((session) => [session.city, session.venue].filter(Boolean).join(' · '))
      .filter(Boolean);
    const locationSummary = locations.length === 0
      ? null
      : locations.every((location) => location === locations[0])
        ? locations[0]
        : `${locations[0]} 等多地`;
    return { startDate, dateSummary, locationSummary };
  }, [sessions]);
  const multiOverviewCountdownDays = useMemo(() => {
    if (!event || !multiSessionOverview) return null;
    if (event.status !== 'planned' && event.status !== 'wishlist') return null;
    const d = daysUntil(multiSessionOverview.startDate);
    return d >= 0 ? d : null;
  }, [event, multiSessionOverview]);
  const sessionMetaDiffs = useMemo(() => {
    if (sessions.length <= 1) return { dates: false, times: false, locations: false };
    return {
      dates: new Set(sessions.map((session) => session.session_date)).size > 1,
      times: new Set(sessions.map((session) => (
        formatEventTimes(session.open_time, session.start_time) || '时间待定'
      ))).size > 1,
      locations: new Set(sessions.map((session) => (
        [session.city, session.venue].filter(Boolean).join(' · ')
      ))).size > 1,
    };
  }, [sessions]);
  const prioritizedArtists = useMemo(() => {
    const oshiArtist = oshiArtistId ? allArtistsMap.get(oshiArtistId) : null;
    const oshiParentId = oshiArtist?.parent_id ?? null;
    const favoriteIds = new Set(
      allArtists.filter((artist) => artist.is_favorite === 1).map((artist) => artist.id),
    );
    const favoriteParentIds = new Set(
      allArtists.flatMap((artist) => (
        artist.is_favorite === 1 && artist.parent_id ? [artist.parent_id] : []
      )),
    );
    const priority = (artist: Artist) => {
      if (artist.id === oshiArtistId) return 0;
      if (artist.id === oshiParentId) return 1;
      if (favoriteIds.has(artist.id)) return 2;
      if (favoriteParentIds.has(artist.id)) return 3;
      return 4;
    };
    return artists
      .map((artist, index) => ({ artist, index }))
      .sort((a, b) => priority(a.artist) - priority(b.artist) || a.index - b.index)
      .map(({ artist }) => artist);
  }, [allArtists, allArtistsMap, artists, oshiArtistId]);
  const timetableSessions = useMemo(
    () => sessions.filter((session) => (timetables[session.id]?.length ?? 0) > 0),
    [sessions, timetables],
  );
  const hasMultipleTimetables = timetableSessions.length > 1;
  const simpleShareAction = useMemo(
    () => event ? buildEventShareAction(event, sessions) : null,
    [event, sessions],
  );

  const toggleTimetableSession = useCallback((sessionId: string) => {
    setCollapsedTimetableSessionIds((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
      }
      if (sharePosterUriRef.current) {
        try {
          new File(sharePosterUriRef.current).delete();
        } catch {
          // 离开页面时清理临时海报，缓存清理失败不影响页面退出。
        }
        sharePosterUriRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setDetailsExpanded(false);
    setDetailsOverflows(false);
  }, [event?.id, event?.details]);


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
    const isAttributed = config.oshi_artist_id
      ? await db.events.isArtistAttributedToEvent(id, config.oshi_artist_id)
      : false;
    setEvent(ev);
    setArtists(ar);
    setChekiList(ck);
    setManualEntries(manual);
    setInfoPhotos(photos);
    setAllArtists(allArs);
    setOshiArtistId(config.oshi_artist_id);
    setOshiIsAttributed(isAttributed);
    setUserConfig(config);
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
      await addEventToSystemCalendar(buildEventSessionCalendarPayload(event, session), Calendar);
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

  const handleRequestAddToCalendar = () => {
    if (!event || shareBusy) return;
    setShareMenuVisible(false);
    if (sessions.length === 1) {
      void handleAddToSystemCalendar(sessions[0]);
    } else if (sessions.length > 1) {
      setCalendarSessionPickerVisible(true);
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

  const showCopyToast = useCallback((message: string) => {
    setCopyToastMessage(message);
    if (copyToastTimerRef.current) {
      clearTimeout(copyToastTimerRef.current);
    }
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToastMessage(null);
      copyToastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  const handleCopyEventUrl = useCallback(() => {
    if (!event?.url) return;
    suppressNextLinkPressRef.current = true;
    Clipboard.setString(event.url);
    hapticCopySuccess();
    showCopyToast('活动链接已复制');
  }, [event?.url, showCopyToast]);

  const handleCopyEventShare = useCallback(() => {
    if (!simpleShareAction || shareBusy) return;
    Clipboard.setString(simpleShareAction.text);
    hapticCopySuccess();
    setShareMenuVisible(false);
    showCopyToast(simpleShareAction.toastLabel);
  }, [shareBusy, showCopyToast, simpleShareAction]);

  const handleGenerateSharePoster = useCallback(async () => {
    if (!event || shareBusy) return;
    if (Platform.OS === 'web') {
      showOperationFailedAlert(
        'Web 端暂不支持生成活动分享图片。',
        '请在 iPhone 或 Android 设备上打开这个活动后再试一次。',
      );
      return;
    }

    setShareBusy(true);
    try {
      console.info('[DEBUG-event-share] share flow started', {
        platform: Platform.OS,
        sessionCount: sessions.length,
        photoCount: infoPhotos.length,
      });
      const poster = await createEventSharePoster({
        title: event.title,
        sessions: resolveEventShareSessions(event, sessions),
        photoUris: infoPhotos.map((photo) => photo.local_uri),
        artists: prioritizedArtists.map((artist) => ({
          name: getArtistPrimaryName(artist),
          avatarUri: artist.avatar_uri,
        })),
        profile: {
          name: userConfig?.name.trim() || 'Otaku',
          avatarUri: userConfig?.avatar_uri ?? null,
          avatarEmoji: userConfig?.avatar_emoji || '🎤',
        },
      });
      sharePosterUriRef.current = poster.uri;
      setSharePosterUri(poster.uri);
      setSharePosterSaved(false);
      setShareMenuVisible(false);
      console.info('[DEBUG-event-share] poster ready, showing preview', {
        width: poster.width,
        height: poster.height,
      });
    } catch (error) {
      console.error('[DEBUG-event-share] share flow failed', error);
      showFailureAlert({
        title: '分享失败',
        reason: '无法生成活动图片。',
        nextStep: '请稍后重新尝试。',
        details: error,
      });
    } finally {
      setShareBusy(false);
    }
  }, [event, infoPhotos, prioritizedArtists, sessions, shareBusy, userConfig]);

  const closeSharePosterPreview = useCallback(() => {
    if (sharePreviewBusy) return;
    if (sharePosterUriRef.current) {
      try {
        new File(sharePosterUriRef.current).delete();
        console.info('[DEBUG-event-share] temporary poster deleted');
      } catch {
        console.warn('[DEBUG-event-share] temporary poster cleanup failed');
        // 缓存清理尽力而为，不应阻塞关闭预览。
      }
      sharePosterUriRef.current = null;
    }
    setSharePosterUri(null);
    setSharePosterSaved(false);
  }, [sharePreviewBusy]);

  const saveSharePoster = useCallback(async () => {
    if (!sharePosterUri || sharePreviewBusy || sharePosterSaved) return;
    setSharePreviewBusy('saving');
    try {
      if (await saveImageToAlbum(sharePosterUri)) setSharePosterSaved(true);
    } finally {
      setSharePreviewBusy(null);
    }
  }, [sharePosterUri, sharePosterSaved, sharePreviewBusy]);

  const shareSharePoster = useCallback(async () => {
    if (!sharePosterUri || sharePreviewBusy) return;
    setSharePreviewBusy('sharing');
    try {
      await shareImageFile(sharePosterUri, event ? `分享${event.title}` : '分享活动图片');
    } finally {
      setSharePreviewBusy(null);
    }
  }, [event, sharePosterUri, sharePreviewBusy]);

  const handleOpenEventUrl = useCallback(() => {
    if (!event?.url) return;
    if (suppressNextLinkPressRef.current) {
      suppressNextLinkPressRef.current = false;
      return;
    }
    Linking.openURL(event.url);
  }, [event?.url]);

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
  const visibleArtists = artistsExpanded ? prioritizedArtists : prioritizedArtists.slice(0, 8);
  const hiddenArtistCount = Math.max(0, prioritizedArtists.length - 8);
  const chekiExpense = useMemo(() => (
    chekiList.reduce((total, cheki) => total + (cheki.price ?? 0), 0)
    + manualEntries.reduce((total, entry) => total + (entry.total_price ?? 0), 0)
  ), [chekiList, manualEntries]);
  const ticketExpense = event?.actual_expense ?? 0;
  const totalEventExpense = ticketExpense + chekiExpense;
  const advancedItemCount = sessions.reduce((count, session) => (
    count + [session.end_time, session.end_date].filter(Boolean).length
  ), 0) + [event?.url].filter(Boolean).length;

  if (!event) {
    return (
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: isDark ? colors.textMuted : colors.chevron }}>活动不存在</Text>
      </SafeAreaView>
    );
  }

  const bg = colors.screen;
  const cardBg = colors.card;
  const detailsTextStyle: TextStyle = { marginBottom: 10, fontSize: 14, color: colors.textSecondary, lineHeight: 22 };
  const oshiArtist = oshiArtistId ? (allArtistsMap.get(oshiArtistId) ?? null) : null;
  const oshiMatchSource = oshiArtistId
    ? getOshiMatchSource(artists, oshiArtistId, oshiArtist, oshiIsAttributed)
    : null;
  const oshiArtistName = oshiArtist?.short_name || oshiArtist?.name || null;
  const myRecordsSection = (
    <>
      <SectionTitle label="我的记录" />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[
          { label: '票价', value: ticketExpense },
          { label: '拍立得支出', value: chekiExpense },
          { label: '总支出', value: totalEventExpense },
        ].map((item) => (
          <View key={item.label} style={{
            flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 11,
            borderRadius: 14, backgroundColor: cardBg,
          }}>
            <Text numberOfLines={1} style={{ fontSize: 10.5, color: colors.textMuted }}>{item.label}</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ marginTop: 3, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], color: colors.text }}
            >
              ¥{item.value.toFixed(2).replace(/\.00$/, '')}
            </Text>
          </View>
        ))}
      </View>
      <Card cardBg={cardBg}>
        <CardHeader
          label="拍立得"
          count={totalChekiCount}
          actionLabel="添加"
          onActionPress={handleOpenChekiCreate}
        />

        {chekiList.length > 0 ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: chekiDisplayMode === 'original' ? CHEKI_SQUARE_GRID_GAP : 8,
              }}
            >
              {previewChekiList.map((ck) => (
                <TouchableOpacity key={ck.id} onPress={() => setViewerSelectedId(ck.id)} activeOpacity={0.8}>
                  {chekiDisplayMode === 'original' ? (
                    <ChekiGridThumbnail
                      uri={ck.photo_uri}
                      width={chekiW}
                      height={chekiH}
                      colors={colors}
                      variant="original"
                    />
                  ) : (
                    <Image
                      source={{ uri: ck.photo_uri }}
                      resizeMethod="resize"
                      resizeMode="contain"
                      style={{ width: chekiW, height: chekiH, borderRadius: 10,
                        backgroundColor: isDark ? colors.inputBorder : colors.cardAlt }}
                    />
                  )}
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
          </View>
        ) : null}
        <ChekiManualEntryList
          entries={manualEntries}
          eventMap={new Map([[event.id, event]])}
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
    </>
  );

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="分享活动"
                disabled={shareBusy}
                onPress={() => setShareMenuVisible(true)}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: shareBusy ? 0.5 : 1 }}
              >
                {shareBusy
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <AppIcon name="share" size={21} color={colors.accent} />}
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="编辑活动"
                onPress={() => router.push(`/events/${id}/edit`)}
                style={{ minWidth: 44, height: 44, paddingRight: 4, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>编辑</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <NativeTextToolbar
        right={[
          {
            label: '分享',
            accessibilityLabel: '分享活动',
            icon: 'share',
            disabled: shareBusy,
            separateBackground: true,
            onPress: () => setShareMenuVisible(true),
          },
          {
            label: '编辑',
            accessibilityLabel: '编辑活动',
            onPress: () => router.push(`/events/${id}/edit`),
          },
        ]}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 活动概览 */}
        <Card cardBg={cardBg} style={{ paddingTop: 20, paddingBottom: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.heading,
            letterSpacing: -0.5, lineHeight: 29, marginBottom: 14 }}>
            {event.title}
          </Text>
          {oshiMatchSource && oshiArtistName ? (
            <View style={{ alignItems: 'flex-start', marginBottom: 12 }}>
              <OshiMatchBadge oshiArtistName={oshiArtistName} outerHeight={32} />
            </View>
          ) : null}
          <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <EventStatusChip
              status={event.status}
              size="detail"
              onPress={handleOpenStatusPicker}
              trailingIcon="disclosure"
              trailingIconVariant="down"
              buttonRef={statusPillRef}
            />
            {event.status === 'completed' ? (
              <EventRatingStars score={event.review_score} size="detail" onChange={handleScoreChange} />
            ) : null}
          </View>
          {sessions.length === 1 ? (
            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <SessionSummaryRow
                session={sessions[0]}
                index={0}
                isLast
                embedded
                countdownDays={overviewCountdownDays}
              />
            </View>
          ) : multiSessionOverview ? (
            <View style={{
              marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.88}
                  style={{
                    fontSize: 16,
                    lineHeight: 23,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                    color: colors.text,
                  }}
                >
                  {multiSessionOverview.dateSummary}
                </Text>
                {multiSessionOverview.locationSummary ? (
                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppIcon name="eventLocation" size={14} color={colors.textSecondary} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}>
                      {multiSessionOverview.locationSummary}
                    </Text>
                  </View>
                ) : null}
              </View>
              {multiOverviewCountdownDays != null ? (
                <View style={{ alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, lineHeight: 24, fontWeight: '900', fontVariant: ['tabular-nums'], color: colors.accent }}>
                    {multiOverviewCountdownDays === 0 ? '今天' : `${multiOverviewCountdownDays} 天`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Card>

        {/* 多场活动的时间与地点 */}
        {sessions.length > 1 ? (
          <>
            <SectionTitle label="场次" />
            <Card cardBg={cardBg} style={{ paddingTop: 8, paddingBottom: 8 }}>
              {sessions.map((session, index) => (
                <SessionCompactRow
                  key={session.id}
                  session={session}
                  index={index}
                  isLast={index === sessions.length - 1}
                  showDate={sessionMetaDiffs.dates}
                  showTime={sessionMetaDiffs.times}
                  showLocation={sessionMetaDiffs.locations}
                />
              ))}
            </Card>
          </>
        ) : null}

        {event.status === 'completed' ? myRecordsSection : null}

        {/* 详情 */}
        {(infoPhotos.length > 0 || event.details) ? (
          <>
            <SectionTitle label="详情" />
            <Card cardBg={cardBg} style={event.details ? { paddingBottom: 0 } : undefined}>
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
              ) : null}
              {event.details ? (
                <View style={{ marginTop: infoPhotos.length > 0 ? 12 : 0 }}>
                  <View
                    pointerEvents="none"
                    aria-hidden
                    accessible={false}
                    style={{ position: 'absolute', left: 0, right: 0, opacity: 0 }}
                  >
                    <Text
                      onTextLayout={(e) => (
                        setDetailsOverflows(e.nativeEvent.lines.length > DETAILS_PREVIEW_LINES)
                      )}
                      style={detailsTextStyle}
                    >
                      {event.details}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={detailsExpanded ? undefined : DETAILS_PREVIEW_LINES}
                    style={detailsTextStyle}
                  >
                    {event.details}
                  </Text>
                  {detailsOverflows ? (
                    <ExpansionToggle
                      accessibilityLabel="演出详情"
                      expanded={detailsExpanded}
                      collapsedLabel="展开详情"
                      expandedLabel="收起详情"
                      onPress={() => setDetailsExpanded((current) => !current)}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        {/* 时间表 */}
        {timetableSessions.length > 0 ? (
          <>
            <SectionTitle label="时间表" />
            {timetableSessions.map((session) => {
              const entries = timetables[session.id] ?? [];
              const isCollapsed = collapsedTimetableSessionIds.has(session.id);
              const sessionTitle = session.title?.trim() || '';
              const collapsibleLabel = sessionTitle
                ? `${sessionTitle} · ${formatDate(session.session_date)}`
                : formatDate(session.session_date);
              return (
                <Card
                  cardBg={cardBg}
                  key={session.id}
                  style={{
                    paddingTop: TIMETABLE_ENTRY_VERTICAL_PADDING,
                    paddingBottom: TIMETABLE_ENTRY_VERTICAL_PADDING,
                  }}
                >
                  {hasMultipleTimetables ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={collapsibleLabel}
                      accessibilityState={{ expanded: !isCollapsed }}
                      activeOpacity={0.7}
                      onPress={() => toggleTimetableSession(session.id)}
                      style={{
                        minHeight: 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: isCollapsed ? 0 : 4,
                        borderBottomWidth: isCollapsed ? 0 : 1,
                        borderBottomColor: colors.divider,
                      }}
                    >
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {collapsibleLabel}
                      </Text>
                      <AppIcon name="chevron" variant={isCollapsed ? 'down' : 'up'} size={15} color={colors.chevron} />
                    </TouchableOpacity>
                  ) : sessionTitle ? (
                    <Text style={{ marginBottom: 10, fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {sessionTitle}
                    </Text>
                  ) : null}
                  {!isCollapsed ? entries.map((entry, entryIndex) => {
                    const artist = entry.artist_id ? allArtistsMap.get(entry.artist_id) : null;
                    const displayName = (artist ? getArtistPrimaryName(artist) : entry.title).trim();
                    const notes = entry.notes?.trim() || '';
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        disabled={!artist}
                        onPress={() => artist && router.push(`/artists/${artist.id}`)}
                        activeOpacity={0.72}
                        style={{
                          minHeight: DETAIL_LIST_ITEM_MIN_HEIGHT,
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          paddingVertical: TIMETABLE_ENTRY_VERTICAL_PADDING,
                          borderBottomWidth: entryIndex === entries.length - 1 ? 0 : 1,
                          borderBottomColor: colors.divider,
                        }}
                      >
                        <View style={{ width: TIMETABLE_TIME_COLUMN_WIDTH, flexShrink: 0 }}>
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{
                            fontSize: 14, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'], color: colors.accent,
                          }}>
                            {formatTimetableTime(entry.start_time, entry.end_time)}
                          </Text>
                        </View>
                        {artist ? (
                          <View style={{ width: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
                            <OshiAvatar source={resolveAvatarSource(artist.avatar_uri)} size={28} isOshi={artist.id === oshiArtistId} />
                          </View>
                        ) : displayName ? (
                          <View style={{ width: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: colors.oshiAvatarBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Text style={{ fontSize: 12.5, lineHeight: 17, fontWeight: '700', color: colors.textSecondary }}>
                                {displayName.charAt(0)}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                          {displayName ? (
                            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                              {displayName}
                            </Text>
                          ) : null}
                          {notes ? (
                            <Text numberOfLines={1} style={{ marginTop: displayName ? 3 : 0, fontSize: 12, lineHeight: 17, color: colors.textMuted }}>
                              {notes}
                            </Text>
                          ) : null}
                        </View>
                        {artist ? <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} /> : null}
                      </TouchableOpacity>
                    );
                  }) : null}
                </Card>
              );
            })}
          </>
        ) : null}

        {/* 出演者 */}
        {artists.length > 0 ? (
          <>
            <SectionTitle label="出演者" />
            <Card
              cardBg={cardBg}
              style={hiddenArtistCount > 0
                ? { paddingTop: ARTIST_LIST_ITEM_VERTICAL_PADDING, paddingBottom: 0 }
                : { paddingTop: ARTIST_LIST_ITEM_VERTICAL_PADDING, paddingBottom: ARTIST_LIST_ITEM_VERTICAL_PADDING }}
            >
              {visibleArtists.map((artist, index) => {
                const isLast = index === visibleArtists.length - 1;
                const isOshi = artist.id === oshiArtistId;
                return (
                  <TouchableOpacity
                    key={artist.id}
                    activeOpacity={0.72}
                    onPress={() => router.push(`/artists/${artist.id}`)}
                    style={{
                      minHeight: DETAIL_LIST_ITEM_MIN_HEIGHT,
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: ARTIST_LIST_ITEM_VERTICAL_PADDING,
                      borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.divider,
                    }}
                  >
                    <View style={{ marginRight: 12 }}>
                      <OshiAvatar source={resolveAvatarSource(artist.avatar_uri)} size={36} isOshi={isOshi} />
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{
                        flexShrink: 1, fontSize: 14, fontWeight: isOshi ? '700' : '600',
                        color: isOshi ? colors.accent : colors.text,
                      }}>
                        {getArtistPrimaryName(artist)}
                      </Text>
                      {isOshi ? <OshiBadge /> : null}
                    </View>
                    <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} />
                  </TouchableOpacity>
                );
              })}
              {hiddenArtistCount > 0 ? (
                <ExpansionToggle
                  accessibilityLabel="出演者"
                  expanded={artistsExpanded}
                  collapsedLabel={`展开其余 ${hiddenArtistCount} 位`}
                  expandedLabel="收起出演者"
                  onPress={() => setArtistsExpanded((current) => !current)}
                />
              ) : null}
            </Card>
          </>
        ) : null}

        {event.status !== 'completed' ? myRecordsSection : null}

        {/* 更多 */}
        <SectionTitle label="更多" />
        {sessions.some((session) => session.end_time || session.end_date) ? (
          <Card cardBg={cardBg}>
            <CardHeader label="结束信息" />
            {sessions.map((session, index) => {
              if (!session.end_time && !session.end_date) return null;
              const endParts = [
                session.end_date ? formatDate(session.end_date) : null,
                session.end_time,
              ].filter(Boolean).join(' ');
              return (
                <View
                  key={session.id}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: index === sessions.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  {sessions.length > 1 ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {session.title || `场次 ${index + 1}`}
                    </Text>
                  ) : null}
                  <Text style={{ marginTop: sessions.length > 1 ? 3 : 0, fontSize: 14, fontWeight: '600', color: colors.text }}>
                    结束 {endParts}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : null}
        {event.url ? (
          <Card cardBg={cardBg}>
            <CardHeader label="演出链接" />
            <TouchableOpacity onPress={handleOpenEventUrl} onLongPress={handleCopyEventUrl} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, lineHeight: 21, color: colors.accent }}>{event.url}</Text>
            </TouchableOpacity>
          </Card>
        ) : null}
        {advancedItemCount === 0 ? (
          <Card cardBg={cardBg}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>还没有更多信息</Text>
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

      {sharePosterUri ? (
        <Modal
          visible
          animationType="fade"
          onRequestClose={() => {
            if (!sharePreviewBusy) closeSharePosterPreview();
          }}
        >
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <ImageResultPreview
              uri={sharePosterUri}
              title="已生成"
              busyAction={sharePreviewBusy}
              saved={sharePosterSaved}
              onClose={closeSharePosterPreview}
              onSave={() => void saveSharePoster()}
              onShare={() => void shareSharePoster()}
              imageBorderRadius={0}
            />
          </SafeAreaProvider>
        </Modal>
      ) : null}

      <BottomSheetDialog
        visible={shareMenuVisible}
        title="分享活动"
        onClose={() => {
          if (!shareBusy) setShareMenuVisible(false);
        }}
        enablePanDownToClose={!shareBusy}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={simpleShareAction?.menuLabel}
          disabled={shareBusy || !simpleShareAction}
          activeOpacity={0.6}
          onPress={handleCopyEventShare}
          style={{
            minHeight: 60,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
            opacity: shareBusy ? 0.5 : 1,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
            <AppIcon name={event.url?.trim() ? 'link' : 'document'} size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.text }}>
              {simpleShareAction?.menuLabel}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="生成分享图片"
          accessibilityState={{ busy: shareBusy, disabled: shareBusy }}
          disabled={shareBusy}
          activeOpacity={0.6}
          onPress={() => void handleGenerateSharePoster()}
          style={{
            minHeight: 66,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: shareBusy ? 0.72 : 1,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
            {shareBusy
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <AppIcon name="image" size={18} color={colors.accent} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.text }}>
              {shareBusy ? '正在生成分享图片' : '生成分享图片'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="添加到日历"
          disabled={shareBusy}
          activeOpacity={0.6}
          onPress={handleRequestAddToCalendar}
          style={{
            minHeight: 60,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            opacity: shareBusy ? 0.5 : 1,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
            <AppIcon name="calendar" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.text }}>
              添加到日历
            </Text>
          </View>
        </TouchableOpacity>
      </BottomSheetDialog>

      <BottomSheetDialog
        visible={calendarSessionPickerVisible}
        title="添加到日历"
        onClose={() => setCalendarSessionPickerVisible(false)}
        scrollable
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}
      >
        {sessions.map((session, index) => {
          const sessionTitle = session.title?.trim() || `场次 ${index + 1}`;
          const sessionTime = formatEventTimes(session.open_time, session.start_time) || '时间待定';
          const sessionLocation = [session.city, session.venue].filter(Boolean).join(' · ');
          const meta = [formatDateWithWeekday(session.session_date), sessionTime, sessionLocation]
            .filter(Boolean)
            .join('  ');
          return (
            <TouchableOpacity
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={`将${sessionTitle}添加到日历`}
              disabled={addingSessionId != null}
              activeOpacity={0.6}
              onPress={() => {
                setCalendarSessionPickerVisible(false);
                void handleAddToSystemCalendar(session);
              }}
              style={{
                minHeight: 60,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderBottomWidth: index === sessions.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
                opacity: addingSessionId != null ? 0.5 : 1,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
                <AppIcon name="calendar" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.text }}>
                  {sessionTitle}
                </Text>
                <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                  {meta}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </BottomSheetDialog>

      {copyToastMessage ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
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
              {copyToastMessage}
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

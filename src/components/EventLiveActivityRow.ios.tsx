import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, AppState, Text, TouchableOpacity, View } from 'react-native';
import type { Artist, Event, EventSession, EventTimetableEntry } from '../types/models';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';
import { withAlpha } from '../utils/color';
import { hapticError, hapticToggle } from '../utils/haptics';
import {
  closeEventLiveActivity,
  ensureEventLiveActivity,
} from '../features/event-live-activity/manager';
import { createEventLiveActivityPalettes } from '../features/event-live-activity/palette';
import { projectEventLiveActivity } from '../features/event-live-activity/projection';
import type {
  EventLiveActivityControlState,
  EventLiveActivityInput,
} from '../features/event-live-activity/types';

const MAX_TIMER_DELAY_MS = 2_147_000_000;

export function EventLiveActivityRow({
  event,
  sessions,
  timetables,
  artists,
  eventImageUri,
}: {
  event: Event;
  sessions: EventSession[];
  timetables: Record<string, EventTimetableEntry[]>;
  artists: Artist[];
  eventImageUri?: string;
}) {
  const { colors, themeId } = useAppTheme();
  const palettes = useMemo(() => createEventLiveActivityPalettes(themeId), [themeId]);
  const input = useMemo<EventLiveActivityInput>(() => ({
    event,
    sessions,
    timetables,
    artistAvatarUris: Object.fromEntries(artists.flatMap((artist) => (
      artist.avatar_uri ? [[artist.id, artist.avatar_uri]] : []
    ))),
    eventImageUri,
    ...palettes,
  }), [artists, event, eventImageUri, palettes, sessions, timetables]);
  const [snapshot, setSnapshot] = useState<{
    eventId: string;
    state: EventLiveActivityControlState;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = refreshVersion.current + 1;
    refreshVersion.current = version;
    setSnapshot(null);
    const next = await ensureEventLiveActivity(input);
    if (refreshVersion.current !== version) return;
    setSnapshot({ eventId: event.id, state: next });
  }, [event.id, input]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => {
      refreshVersion.current += 1;
      setSnapshot(null);
    };
  }, [refresh]));

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNextBoundary = () => {
      const now = new Date();
      const projection = projectEventLiveActivity(event, sessions, timetables, now);
      const boundary = projection.availability === 'available'
        ? projection.nextBoundaryAt
        : projection.reason === 'too-early' ? projection.nextEligibleAt ?? null : null;
      if (boundary != null) {
        const delay = Math.min(MAX_TIMER_DELAY_MS, Math.max(250, boundary - now.getTime() + 250));
        timer = setTimeout(() => {
          void refresh().finally(() => {
            if (!disposed) scheduleNextBoundary();
          });
        }, delay);
      }
    };
    scheduleNextBoundary();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [event, refresh, sessions, timetables]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const state = snapshot?.eventId === event.id ? snapshot.state : null;

  if (event.status !== 'planned' || state?.status !== 'active') return null;

  const handleClose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await closeEventLiveActivity(input);
      setSnapshot({ eventId: event.id, state: next });
      if (next.status === 'closed') hapticToggle(false);
      else hapticError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="实时活动，正在锁屏与灵动岛显示"
      style={{
        minHeight: 62,
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
      }}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 11,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accentSoft,
      }}>
        <AppIcon name="liveActivity" size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, lineHeight: 19, fontWeight: '700', color: colors.text }}>
          实时活动
        </Text>
        <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
          正在锁屏与灵动岛显示
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="关闭实时活动"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          activeOpacity={0.7}
          onPress={() => void handleClose()}
          style={{
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 10,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: withAlpha(colors.danger, 0.08),
          }}
        >
          <Text style={{
            fontSize: 12.5,
            fontWeight: '700',
            color: colors.danger,
          }}>
            关闭
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

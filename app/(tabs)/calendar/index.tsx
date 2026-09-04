import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  ScrollView,
  Text,
  type TextStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../../../src/components/AndroidCollapsibleTabHeader';
import { AppIcon, getAppIconSFSymbol } from '../../../src/components/AppIcon';
import { CalendarMonthPicker } from '../../../src/components/CalendarMonthPicker';
import {
  DashboardContainer,
  getAdaptiveContentWidth,
} from '../../../src/components/adaptive/AppContainers';
import { EventCard } from '../../../src/components/EventCard';
import { EventSectionHeader } from '../../../src/components/EventSectionHeader';
import { ArtistRankingList } from '../../../src/components/ArtistRankingList';
import { ExpandableList } from '../../../src/components/ExpandableList';
import { ChekiManualEntryList } from '../../../src/components/ChekiManualEntryList';
import { ChekiStackPreviewCard } from '../../../src/components/ChekiStackPreviewCard';
import { FormFieldLabel } from '../../../src/components/FormPrimitives';
import { useDB } from '../../../src/context/DBContext';
import { useFloatingTabBarSpacing } from '../../../src/navigation/floatingTabBar';
import { useFloatingTabBarScroll } from '../../../src/navigation/FloatingTabBarVisibility';
import { DateItemCalendarOccurrence } from '../../../src/repositories/DateItemRepository';
import { useAppTheme } from '../../../src/theme/appTheme';
import { Artist, Cheki, ChekiCalendarDaySummary, ChekiManualEntry, Event } from '../../../src/types/models';
import { getArtistPrimaryName } from '../../../src/utils/artistDisplay';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import {
  monthGridLeadingBlankCount,
  reorderWeekdayLabels,
  type CalendarGridWeekStart,
} from '../../../src/utils/calendarWeeks';
import { calculateChekiGridLayout, getChekiManualCount } from '../../../src/utils/cheki';
import { withAlpha } from '../../../src/utils/color';
import {
  CALENDAR_MONTH_PANE_MAX_WIDTH,
  CALENDAR_SPLIT_GAP,
  shouldUseCalendarSplitLayout,
} from '../../../src/utils/calendarLayout';
import { toISODate } from '../../../src/utils/date';
import { getLocalDayDifference } from '../../../src/utils/dateItems';
import { getEventCardOshiBadge } from '../../../src/utils/oshiMatch';
import { useWindowMode } from '../../../src/utils/windowMode';

type ChekiMonthCell = {
  date: string;
  day: number;
  inMonth: boolean;
  summary: ChekiCalendarDaySummary | null;
};

type DayArtistSummary = {
  artist: Artist;
  count: number;
};

type MonthCellSignalCard = {
  key: string;
  kind: 'event' | 'dateItem' | 'overflow';
  text: string;
};

const CALENDAR_CHEKI_GRID_GAP = 8;
const CALENDAR_CHEKI_ASPECT_RATIO = 86 / 54;
const CALENDAR_MONTH_CELL_SIGNAL_CARD_LIMIT = 3;
const CALENDAR_RANKING_PREVIEW_LIMIT = 10;
const CALENDAR_WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;
const CALENDAR_MONTH_CELL_HEIGHT = 92;
const CALENDAR_MONTH_CELL_COMPACT_HEIGHT = 89;
const CALENDAR_MONTH_CELL_WIDE_HEIGHT = 104;
const CALENDAR_MONTH_CELL_WIDE_COMPACT_HEIGHT = 100;
function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function sortDayEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => (a.event_time ?? '').localeCompare(b.event_time ?? ''));
}

function formatSelectedDateLabel(date: string): string {
  return date;
}

function formatDateDistanceLabel(date: string, today: string): string {
  const diff = getLocalDayDifference(date, today);
  if (diff === 0) return '今天';
  return diff > 0 ? `${diff} 天后` : `${Math.abs(diff)} 天前`;
}

function parseISODate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function formatISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function CalendarDetailCard({
  title,
  children,
  paddingBottom = 14,
  paddingTop = 12,
  paddingHorizontal = 14,
  titleStyle,
}: {
  title: string;
  children: ReactNode;
  paddingBottom?: number;
  paddingTop?: number;
  paddingHorizontal?: number;
  titleStyle?: TextStyle;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <View
      style={{
        borderRadius: 18,
        paddingHorizontal,
        paddingTop,
        paddingBottom,
        marginBottom: 12,
        backgroundColor: colors.card,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.18 : 0.08,
        shadowRadius: 14,
        elevation: 3,
      }}
    >
      {titleStyle ? (
        <Text style={titleStyle}>{title}</Text>
      ) : (
        <FormFieldLabel>{title}</FormFieldLabel>
      )}
      {children}
    </View>
  );
}

function addMonths(date: string, delta: number): string {
  const { year, month, day } = parseISODate(date);
  const next = new Date(year, month - 1 + delta, 1);
  const nextYear = next.getFullYear();
  const nextMonth = next.getMonth() + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return formatISODate(nextYear, nextMonth, nextDay);
}

function dateInMonth(date: string, year: number, month: number): string {
  const { day } = parseISODate(date);
  return formatISODate(year, month, Math.min(day, daysInMonth(year, month)));
}

function buildChekiMonthCells(
  date: string,
  summaries: Map<string, ChekiCalendarDaySummary>,
  weekStart: CalendarGridWeekStart,
): ChekiMonthCell[] {
  const { year, month } = parseISODate(date);
  const leadingBlankCount = monthGridLeadingBlankCount(year, month, weekStart);
  const currentDays = daysInMonth(year, month);
  const previousMonthDate = addMonths(formatISODate(year, month, 1), -1);
  const previous = parseISODate(previousMonthDate);
  const previousDays = daysInMonth(previous.year, previous.month);
  const cells: ChekiMonthCell[] = [];

  for (let index = leadingBlankCount - 1; index >= 0; index -= 1) {
    const day = previousDays - index;
    const cellDate = formatISODate(previous.year, previous.month, day);
    cells.push({ date: cellDate, day, inMonth: false, summary: summaries.get(cellDate) ?? null });
  }

  for (let day = 1; day <= currentDays; day += 1) {
    const cellDate = formatISODate(year, month, day);
    cells.push({ date: cellDate, day, inMonth: true, summary: summaries.get(cellDate) ?? null });
  }

  const nextMonthDate = addMonths(formatISODate(year, month, 1), 1);
  const next = parseISODate(nextMonthDate);
  const remainder = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let day = 1; day <= remainder; day += 1) {
    const cellDate = formatISODate(next.year, next.month, day);
    cells.push({ date: cellDate, day, inMonth: false, summary: summaries.get(cellDate) ?? null });
  }

  return cells;
}

function buildMonthCellSignalCards(
  events: Event[],
  occurrences: DateItemCalendarOccurrence[],
  showEvents: boolean,
  showDateItems: boolean,
): MonthCellSignalCard[] {
  const cards: MonthCellSignalCard[] = [
    ...(showEvents ? sortDayEvents(events) : []).map((event) => ({
      key: `event-${event.id}`,
      kind: 'event' as const,
      text: event.title,
    })),
    ...(showDateItems ? occurrences : []).map((occurrence) => ({
      key: `date-item-${occurrence.id}`,
      kind: 'dateItem' as const,
      text: occurrence.anniversaryLabel ?? occurrence.relativeText,
    })),
  ];

  if (cards.length <= CALENDAR_MONTH_CELL_SIGNAL_CARD_LIMIT) {
    return cards;
  }

  return [
    ...cards.slice(0, CALENDAR_MONTH_CELL_SIGNAL_CARD_LIMIT - 1),
    {
      key: `overflow-${cards.length}`,
      kind: 'overflow',
      text: `+${cards.length - (CALENDAR_MONTH_CELL_SIGNAL_CARD_LIMIT - 1)} 项`,
    },
  ];
}

export default function CalendarScreen() {
  const db = useDB();
  const {
    isDark,
    colors,
    calendarWeekStart,
    calendarDisplay,
  } = useAppTheme();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const { width: screenWidth } = useWindowDimensions();
  const { mode } = useWindowMode();
  const isIOS = Platform.OS === 'ios';
  const useSplitLayout = shouldUseCalendarSplitLayout(mode, isIOS);
  const androidHeader = useAndroidCollapsibleTabHeader();
  const monthViewTabBarScroll = useFloatingTabBarScroll();
  const monthViewScrollProps = isIOS ? monthViewTabBarScroll : androidHeader.scrollProps;

  const today = toISODate(new Date());
  const calendarGridWeekStart: CalendarGridWeekStart = calendarWeekStart === 'monday' ? 1 : 0;
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [chekiSummaries, setChekiSummaries] = useState<ChekiCalendarDaySummary[]>([]);
  const [dayChekis, setDayChekis] = useState<Cheki[]>([]);
  const [dayNoPhotoEntries, setDayNoPhotoEntries] = useState<ChekiManualEntry[]>([]);
  const [dateItemOccurrences, setDateItemOccurrences] = useState<DateItemCalendarOccurrence[]>([]);
  const [dayDateItemOccurrences, setDayDateItemOccurrences] = useState<DateItemCalendarOccurrence[]>([]);
  const [artistMap, setArtistMap] = useState<Map<string, Artist>>(new Map());
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [detailPaneWidth, setDetailPaneWidth] = useState(0);
  const detailPaneScrollRef = useRef<ScrollView>(null);
  const monthLoadRequestRef = useRef(0);
  const selectedDayLoadRequestRef = useRef(0);

  const selectedMonth = useMemo(() => parseISODate(selectedDate), [selectedDate]);

  const loadSharedData = useCallback(async () => {
    const [events, artists, config] = await Promise.all([
      db.events.findCalendarEvents(),
      db.artists.findAll(),
      db.userConfig.getConfig(),
    ]);
    setAllEvents(events);
    setArtistMap(new Map(artists.map((artist) => [artist.id, artist])));
    setOshiArtistId(config.oshi_artist_id);
  }, [db]);

  const loadMonthData = useCallback(async () => {
    const requestId = monthLoadRequestRef.current + 1;
    monthLoadRequestRef.current = requestId;
    const [summaries, monthDateItems] = await Promise.all([
      db.cheki.findCalendarSummariesByMonth(selectedMonth.year, selectedMonth.month),
      db.dateItems.findCalendarOccurrencesByMonth(selectedMonth.year, selectedMonth.month, today),
    ]);
    if (requestId !== monthLoadRequestRef.current) return;
    setChekiSummaries(summaries);
    setDateItemOccurrences(monthDateItems);
  }, [db, selectedMonth.month, selectedMonth.year, today]);

  const loadSelectedDayData = useCallback(async () => {
    const requestId = selectedDayLoadRequestRef.current + 1;
    selectedDayLoadRequestRef.current = requestId;
    const [chekis, noPhotoEntries, selectedDateItems] = await Promise.all([
      db.cheki.findByDate(selectedDate),
      db.chekiManualEntries.findByDate(selectedDate),
      db.dateItems.findCalendarOccurrencesByDate(selectedDate, today),
    ]);
    if (requestId !== selectedDayLoadRequestRef.current) return;
    setDayChekis(chekis);
    setDayNoPhotoEntries(noPhotoEntries);
    setDayDateItemOccurrences(selectedDateItems);
  }, [db, selectedDate, today]);

  useFocusEffect(useCallback(() => { loadSharedData(); }, [loadSharedData]));
  useFocusEffect(useCallback(() => { loadMonthData(); }, [loadMonthData]));
  useFocusEffect(useCallback(() => { loadSelectedDayData(); }, [loadSelectedDayData]));

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setDayDateItemOccurrences(dateItemOccurrences.filter((occurrence) => occurrence.date === date));
  }, [dateItemOccurrences]);

  const handleChangeChekiMonth = useCallback((delta: number) => {
    handleSelectDate(addMonths(selectedDate, delta));
  }, [handleSelectDate, selectedDate]);

  const handleSelectMonth = useCallback((year: number, month: number) => {
    setMonthPickerVisible(false);
    handleSelectDate(dateInMonth(selectedDate, year, month));
  }, [handleSelectDate, selectedDate]);

  const eventsByDate = useMemo(() => {
    const byDate = new Map<string, Event[]>();
    for (const event of allEvents) {
      const bucket = byDate.get(event.event_date);
      if (bucket) {
        bucket.push(event);
      } else {
        byDate.set(event.event_date, [event]);
      }
    }
    for (const [date, events] of byDate.entries()) {
      byDate.set(date, sortDayEvents(events));
    }
    return byDate;
  }, [allEvents]);
  const dayEvents = useMemo(
    () => eventsByDate.get(selectedDate) ?? [],
    [eventsByDate, selectedDate],
  );
  const dateItemOccurrencesByDate = useMemo(() => {
    const byDate = new Map<string, DateItemCalendarOccurrence[]>();
    for (const occurrence of dateItemOccurrences) {
      const bucket = byDate.get(occurrence.date);
      if (bucket) {
        bucket.push(occurrence);
      } else {
        byDate.set(occurrence.date, [occurrence]);
      }
    }
    return byDate;
  }, [dateItemOccurrences]);
  const eventDateSet = useMemo(
    () => new Set(eventsByDate.keys()),
    [eventsByDate],
  );
  const dateItemDateSet = useMemo(
    () => new Set(dateItemOccurrencesByDate.keys()),
    [dateItemOccurrencesByDate],
  );

  const summaryMap = useMemo(
    () => new Map(chekiSummaries.map((summary) => [summary.date, summary])),
    [chekiSummaries],
  );
  const chekiMonthCells = useMemo(
    () => buildChekiMonthCells(selectedDate, summaryMap, calendarGridWeekStart),
    [calendarGridWeekStart, selectedDate, summaryMap],
  );
  const selectedChekiSummary = summaryMap.get(selectedDate) ?? null;
  const noPhotoCount = useMemo(() => getChekiManualCount(dayNoPhotoEntries), [dayNoPhotoEntries]);
  const totalChekiCount = selectedChekiSummary?.totalCount ?? (dayChekis.length + noPhotoCount);
  const estimatedDetailPaneWidth = Math.max(
    1,
    (getAdaptiveContentWidth(screenWidth, mode, 'dashboard') - CALENDAR_SPLIT_GAP) * 0.4,
  );
  const chekiPreviewAreaWidth = Math.max(
    1,
    useSplitLayout
      ? (detailPaneWidth || estimatedDetailPaneWidth) - 28
      : screenWidth - 62,
  );
  const calendarChekiLayout = useMemo(
    () => calculateChekiGridLayout({
      density: 'large',
      availableWidth: chekiPreviewAreaWidth,
      availableHeight: 640,
      gap: CALENDAR_CHEKI_GRID_GAP,
      aspectRatio: CALENDAR_CHEKI_ASPECT_RATIO,
    }),
    [chekiPreviewAreaWidth],
  );
  const calendarChekiColumns = calendarChekiLayout.columns;
  const calendarPreviewChekiW = Math.max(
    54,
    Math.floor((chekiPreviewAreaWidth - CALENDAR_CHEKI_GRID_GAP * (calendarChekiColumns - 1)) / calendarChekiColumns),
  );
  const calendarPreviewChekiH = Math.round(calendarPreviewChekiW * CALENDAR_CHEKI_ASPECT_RATIO);
  const dayArtistSummaries = useMemo<DayArtistSummary[]>(() => {
    const counts = new Map<string, number>();
    for (const cheki of dayChekis) {
      if (cheki.artist_id) counts.set(cheki.artist_id, (counts.get(cheki.artist_id) ?? 0) + 1);
    }
    for (const entry of dayNoPhotoEntries) {
      counts.set(entry.artist_id, (counts.get(entry.artist_id) ?? 0) + entry.count);
    }
    return Array.from(counts.entries())
      .map(([artistId, count]) => {
        const artist = artistMap.get(artistId);
        return artist ? { artist, count } : null;
      })
      .filter((item): item is DayArtistSummary => item !== null)
      .sort((a, b) => b.count - a.count || getArtistPrimaryName(a.artist).localeCompare(getArtistPrimaryName(b.artist)));
  }, [artistMap, dayChekis, dayNoPhotoEntries]);
  const hasPhotoChekiCard = dayChekis.length > 0;
  const hasManualRecordCard = dayNoPhotoEntries.length > 0;
  const hasRankingCard = dayArtistSummaries.length > 0;
  const hasChekiSectionContent = hasPhotoChekiCard || hasManualRecordCard || hasRankingCard;
  const formattedDate = formatSelectedDateLabel(selectedDate);
  const selectedDateDistance = formatDateDistanceLabel(selectedDate, today);
  const monthTitle = `${selectedMonth.year}年${selectedMonth.month}月`;
  const showsCalendarTextSignals = calendarDisplay.showEvents || calendarDisplay.showDateItems;
  const regularMonthCellHeight = showsCalendarTextSignals
    ? CALENDAR_MONTH_CELL_HEIGHT
    : CALENDAR_MONTH_CELL_COMPACT_HEIGHT;
  const wideMonthCellHeight = showsCalendarTextSignals
    ? CALENDAR_MONTH_CELL_WIDE_HEIGHT
    : CALENDAR_MONTH_CELL_WIDE_COMPACT_HEIGHT;
  const calendarMonthCellHeight = useSplitLayout ? wideMonthCellHeight : regularMonthCellHeight;

  useEffect(() => {
    if (!useSplitLayout) return;
    detailPaneScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedDate, useSplitLayout]);

  const openChekiLibraryForSelectedDate = useCallback(() => {
    router.push({
      pathname: '/cheki',
      params: {
        date: selectedDate,
      },
    });
  }, [selectedDate]);

  const renderCalendarSettingsButton = useCallback(() => (
    <TouchableOpacity
      onPress={() => router.push('/settings/calendar')}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel="日历设置"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <AppIcon name="viewSettings" size={22} color={colors.accent} />
    </TouchableOpacity>
  ), [colors.accent, router]);

  const renderChekiStack = useCallback((summary: ChekiCalendarDaySummary) => {
    const imageSource: ImageSourcePropType | null = summary.latestPhotoUri
      ? { uri: summary.latestPhotoUri }
      : resolveAvatarSource(summary.fallbackArtistAvatarUri);
    const secondImageSource: ImageSourcePropType | null = summary.secondPhotoUri
      ? { uri: summary.secondPhotoUri }
      : null;
    const thirdImageSource: ImageSourcePropType | null = summary.thirdPhotoUri
      ? { uri: summary.thirdPhotoUri }
      : null;
    const isNoPhotoOnly = !summary.latestPhotoUri;
    const visualPhotoCount = Math.min(summary.photoCount, 4);
    const backplateCount = isNoPhotoOnly ? 0 : Math.min(Math.max(visualPhotoCount - 1, 0), 2);
    const hasSecondPhoto = secondImageSource !== null;
    const hasThirdPhoto = thirdImageSource !== null;

    return (
      <View style={{
        width: 38,
        height: 50,
        marginTop: calendarDisplay.showEvents || calendarDisplay.showDateItems ? 8 : 5,
      }}>
        {backplateCount >= 2 ? (
          hasThirdPhoto ? (
            <View style={{
              position: 'absolute',
              top: 6,
              left: 2,
              width: 28,
              height: 39,
              borderRadius: 5,
              transform: [{ rotate: '-12deg' }],
            }}>
              <Image
                source={thirdImageSource}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: colors.accentSofter,
                }}
              />
            </View>
          ) : (
            <View style={{
              position: 'absolute',
              top: 6,
              left: 2,
              width: 28,
              height: 39,
              borderRadius: 5,
              backgroundColor: colors.card,
              transform: [{ rotate: '-12deg' }],
            }} />
          )
        ) : null}
        {backplateCount >= 1 ? (
          hasSecondPhoto ? (
            <View style={{
              position: 'absolute',
              top: 5,
              right: 2,
              width: 28,
              height: 39,
              borderRadius: 5,
              transform: [{ rotate: backplateCount >= 2 ? '9deg' : '8deg' }],
            }}>
              <Image
                source={secondImageSource}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: colors.accentSofter,
                }}
              />
            </View>
          ) : (
            <View style={{
              position: 'absolute',
              top: 5,
              right: 2,
              width: 28,
              height: 39,
              borderRadius: 5,
              backgroundColor: colors.card,
              transform: [{ rotate: backplateCount >= 2 ? '9deg' : '8deg' }],
            }} />
          )
        ) : null}
        <View style={{
          position: 'absolute',
          left: 4,
          top: 0,
          width: 31,
          height: 43,
          borderRadius: 5,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 3,
          transform: [{ rotate: isNoPhotoOnly ? '5deg' : '-6deg' }],
        }}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 5,
                backgroundColor: colors.accentSofter,
              }}
            />
          ) : (
            <View style={{
              flex: 1,
              borderRadius: 5,
              backgroundColor: colors.accentSofter,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AppIcon name="artist" size={13} color={colors.accent} />
            </View>
          )}
        </View>
        <View style={{
          position: 'absolute',
          right: -2,
          bottom: 0,
          minWidth: 18,
          height: 18,
          paddingHorizontal: 5,
          borderRadius: 999,
          backgroundColor: isDark ? colors.heading : colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: colors.card }}>
            {summary.totalCount}
          </Text>
        </View>
      </View>
    );
  }, [calendarDisplay, colors, isDark]);

  const renderMonthCalendar = () => (
    <>
      {!isIOS ? (
        <AndroidLargeTabTitle
          title="日历"
          right={renderCalendarSettingsButton()}
          largeTitleStyle={androidHeader.largeTitleStyle}
        />
      ) : null}

      <View style={{ marginBottom: 14 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <TouchableOpacity
            onPress={() => handleChangeChekiMonth(-1)}
            activeOpacity={0.7}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.accentSofter,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="disclosure" variant="back" size={22} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMonthPickerVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`选择月份，当前${monthTitle}`}
            hitSlop={{ left: 12, right: 26, top: 10, bottom: 10 }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
          >
            <Text style={{ color: colors.heading, fontSize: 20, lineHeight: 26, fontWeight: '900' }}>
              {monthTitle}
            </Text>
            <AppIcon
              name="disclosure"
              variant="down"
              size={16}
              color={colors.heading}
              style={{ position: 'absolute', left: '100%', marginLeft: 5 }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleChangeChekiMonth(1)}
            activeOpacity={0.7}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.accentSofter,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="disclosure" variant="forward" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <View style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          paddingBottom: 7,
          marginHorizontal: 2,
        }}>
          {reorderWeekdayLabels(CALENDAR_WEEKDAY_LABELS, calendarGridWeekStart).map((weekday) => (
            <Text key={weekday} style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>
              {weekday}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {chekiMonthCells.map((cell, index) => {
            const selected = cell.date === selectedDate;
            const hasEvent = eventDateSet.has(cell.date);
            const hasDateItem = dateItemDateSet.has(cell.date);
            const showChekiStack = cell.summary !== null && calendarDisplay.showChekiPhotos;
            const signalCards = !showChekiStack
              ? buildMonthCellSignalCards(
                eventsByDate.get(cell.date) ?? [],
                dateItemOccurrencesByDate.get(cell.date) ?? [],
                calendarDisplay.showEvents,
                calendarDisplay.showDateItems,
              )
              : [];
            const showCornerSignals = cell.summary !== null && (
              (hasEvent && calendarDisplay.showEvents) || (hasDateItem && calendarDisplay.showDateItems)
            );
            return (
              <TouchableOpacity
                key={cell.date}
                activeOpacity={0.72}
                onPress={() => handleSelectDate(cell.date)}
                style={{
                  width: `${100 / 7}%`,
                  height: calendarMonthCellHeight,
                  paddingTop: 7,
                  paddingHorizontal: 2,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <View style={{
                  position: 'relative',
                  alignSelf: 'stretch',
                  alignItems: 'center',
                  minHeight: useSplitLayout ? 82 : 70,
                  marginHorizontal: 0,
                  marginBottom: 1,
                  paddingTop: 3,
                  paddingHorizontal: 2,
                  paddingBottom: 2,
                }}>
                  <View style={{
                    minWidth: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <View style={{
                      minWidth: 20,
                      height: 20,
                      paddingHorizontal: 6,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      backgroundColor: selected ? withAlpha(colors.accent, isDark ? 0.22 : 0.12) : 'transparent',
                      borderWidth: selected ? 1 : 0,
                      borderColor: selected ? withAlpha(colors.accent, isDark ? 0.68 : 0.34) : 'transparent',
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: selected
                          ? colors.accent
                          : cell.inMonth ? colors.textSecondary : colors.inputBorder,
                      }}>
                        {cell.day}
                      </Text>
                    </View>
                  </View>
                  {showCornerSignals ? (
                    <View style={{
                      position: 'absolute',
                      top: 24,
                      left: 0,
                      right: 0,
                      flexDirection: 'row',
                      gap: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}>
                      {hasEvent && calendarDisplay.showEvents ? (
                        <View style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: colors.accent,
                          opacity: cell.inMonth ? 1 : 0.35,
                          borderWidth: 1,
                          borderColor: colors.screen,
                        }} />
                      ) : null}
                      {hasDateItem && calendarDisplay.showDateItems ? (
                        <View style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: colors.warning,
                          opacity: cell.inMonth ? 1 : 0.35,
                          borderWidth: 1,
                          borderColor: colors.screen,
                        }} />
                      ) : null}
                    </View>
                  ) : null}
                  {showChekiStack && cell.summary ? renderChekiStack(cell.summary) : signalCards.length > 0 ? (
                    <View style={{
                      alignSelf: 'stretch',
                      marginTop: 7,
                      gap: 3,
                    }}>
                      {signalCards.map((card) => {
                        const isEventCard = card.kind === 'event';
                        const isDateItemCard = card.kind === 'dateItem';
                        const cardBackgroundColor = isEventCard
                          ? withAlpha(colors.accent, isDark ? 0.18 : 0.1)
                          : isDateItemCard
                            ? withAlpha(colors.warning, isDark ? 0.18 : 0.12)
                            : isDark ? colors.input : colors.divider;
                        const cardBorderColor = isEventCard
                          ? withAlpha(colors.accent, isDark ? 0.34 : 0.18)
                          : isDateItemCard
                            ? withAlpha(colors.warning, isDark ? 0.34 : 0.18)
                            : withAlpha(colors.textMuted, isDark ? 0.3 : 0.14);
                        const cardTextColor = isEventCard
                          ? isDark ? colors.accentBorder : colors.accent
                          : isDateItemCard
                            ? colors.warning
                            : colors.textMuted;
                        return (
                          <View
                            key={card.key}
                            style={{
                              height: useSplitLayout ? 14 : 12,
                              paddingHorizontal: 4,
                              borderRadius: 4,
                              borderWidth: 1,
                              borderColor: cardBorderColor,
                              backgroundColor: cardBackgroundColor,
                              flexDirection: 'row',
                              alignItems: 'center',
                              opacity: cell.inMonth ? 1 : 0.55,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="clip"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: useSplitLayout ? 9 : 8,
                                lineHeight: useSplitLayout ? 11 : 9,
                                fontWeight: '700',
                                color: cardTextColor,
                              }}
                            >
                              {card.text}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );

  const renderSelectedDayDetails = () => (
    <>
      <View style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 99,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginBottom: 12,
        backgroundColor: selectedDate === today ? colors.accent : isDark ? colors.input : withAlpha(colors.accent, 0.08),
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: '700',
          color: selectedDate === today ? colors.onAccent : isDark ? colors.accentBorder : colors.accent,
        }}>
          {formattedDate}
        </Text>
        <View style={{ width: 1, height: 12, backgroundColor: selectedDate === today ? withAlpha(colors.onAccent, 0.38) : withAlpha(colors.accent, 0.24) }} />
        <Text style={{
          fontSize: 12,
          fontWeight: '800',
          color: selectedDate === today ? withAlpha(colors.onAccent, 0.82) : isDark ? colors.accentBorder : colors.accent,
        }}>
          {selectedDateDistance}
        </Text>
      </View>

      <EventSectionHeader
        title="拍立得"
        count={totalChekiCount}
        countSuffix=" 张"
        colors={colors}
        trailing={
          <>
            <View style={{ flex: 1 }} />
            {totalChekiCount > 0 ? (
              <TouchableOpacity onPress={openChekiLibraryForSelectedDate} activeOpacity={0.7}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>查看全部</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
      />

      {hasPhotoChekiCard ? (
        <CalendarDetailCard title="拍立得" paddingBottom={0}>
          <ChekiStackPreviewCard
            chekis={dayChekis}
            manualCount={0}
            areaWidth={chekiPreviewAreaWidth}
            thumbnailWidth={calendarPreviewChekiW}
            thumbnailHeight={calendarPreviewChekiH}
            columns={calendarChekiColumns}
            chrome="bare"
          />
        </CalendarDetailCard>
      ) : null}

      {hasManualRecordCard ? (
        <CalendarDetailCard title="记录">
          <ChekiManualEntryList
            entries={dayNoPhotoEntries}
            eventMap={new Map()}
            isDark={isDark}
            artistMap={artistMap}
            oshiArtistId={oshiArtistId}
            showArtistMeta
            title={null}
            onPressEntry={(entry) => router.push(`/cheki/records/${entry.id}`)}
          />
        </CalendarDetailCard>
      ) : null}

      {hasRankingCard ? (
        <CalendarDetailCard
          title="排行"
          paddingBottom={0}
          paddingTop={16}
          paddingHorizontal={16}
          titleStyle={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 }}
        >
          <ExpandableList
            items={dayArtistSummaries.map(({ artist, count }) => ({
              id: artist.id,
              name: getArtistPrimaryName(artist),
              avatarUri: artist.avatar_uri,
              value: count,
            }))}
            initialVisibleCount={CALENDAR_RANKING_PREVIEW_LIMIT}
            resetKey={selectedDate}
            expandLabel={(hiddenCount) => `展开其余 ${hiddenCount} 位`}
            collapseLabel={() => '收起排行'}
            renderItems={(items) => (
              <ArtistRankingList
                items={items}
                colors={colors}
                suffix="张"
                onPressItem={(item) => {
                  if (!item.id) return;
                  router.push({
                    pathname: '/cheki',
                    params: {
                      artist_id: item.id,
                      date: selectedDate,
                    },
                  });
                }}
                getAccessibilityLabel={(item) => `查看${selectedDate} ${item.name}的拍立得记录`}
              />
            )}
          />
        </CalendarDetailCard>
      ) : null}

      {!hasChekiSectionContent ? (
        <View style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 12 }}>
          <AppIcon name="cheki" size={24} color={colors.textMuted} />
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textMuted }}>
            这一天还没有拍立得
          </Text>
        </View>
      ) : null}

      <EventSectionHeader title="当天活动" count={dayEvents.length} countSuffix=" 个" colors={colors} />

      {dayEvents.length > 0 ? (
        dayEvents.map((event) => (
          <EventCard key={event.id} event={event} oshiBadge={getEventCardOshiBadge(event.status, null)} />
        ))
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 12 }}>
          <AppIcon name="calendar" size={24} color={colors.textMuted} />
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textMuted }}>
            这一天还没有活动
          </Text>
        </View>
      )}

      <EventSectionHeader title="重要日期" count={dayDateItemOccurrences.length} countSuffix=" 个" colors={colors} />

      {dayDateItemOccurrences.length > 0 ? (
        <View style={{ gap: 8, marginBottom: 14 }}>
          {dayDateItemOccurrences.map((occurrence) => (
            <TouchableOpacity
              key={occurrence.id}
              activeOpacity={0.72}
              onPress={() => router.push(`/date-items/${occurrence.dateItemId}`)}
              style={{
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.divider,
              }}
              accessibilityRole="button"
              accessibilityLabel={`查看${occurrence.title}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: occurrence.kind === 'important_date_anniversary' ? withAlpha(colors.warning, 0.16) : colors.accentSofter,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <AppIcon name="dateItem" size={17} color={occurrence.kind === 'important_date_anniversary' ? colors.warning : colors.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    {occurrence.title}
                  </Text>
                  <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, color: colors.textSecondary }}>
                    {occurrence.relativeText}
                  </Text>
                </View>
                <AppIcon name="disclosure" variant="forward" size={16} color={colors.chevron} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 12 }}>
          <AppIcon name="dateItem" size={24} color={colors.textMuted} />
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textMuted }}>
            这一天还没有重要日期
          </Text>
        </View>
      )}
    </>
  );

  const renderChekiMonthView = () => {
    if (useSplitLayout) {
      return (
        <DashboardContainer
          style={{
            flex: 1,
            flexDirection: 'row',
            gap: CALENDAR_SPLIT_GAP,
          }}
        >
          <ScrollView
            style={{ flex: 3, minWidth: 0, maxWidth: CALENDAR_MONTH_PANE_MAX_WIDTH }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: contentBottomPadding }}
            contentInsetAdjustmentBehavior="automatic"
          >
            {renderMonthCalendar()}
          </ScrollView>

          <ScrollView
            ref={detailPaneScrollRef}
            style={{ flex: 2, minWidth: 0 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: contentBottomPadding }}
            contentInsetAdjustmentBehavior="automatic"
            onLayout={(event) => {
              const nextWidth = event.nativeEvent.layout.width;
              setDetailPaneWidth((currentWidth) => (
                Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth
              ));
            }}
          >
            {renderSelectedDayDetails()}
          </ScrollView>
        </DashboardContainer>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: isIOS ? 0 : androidHeader.contentTopPadding,
          paddingBottom: contentBottomPadding,
        }}
        contentInsetAdjustmentBehavior="automatic"
        scrollIndicatorInsets={isIOS ? undefined : { bottom: contentBottomPadding }}
        {...monthViewScrollProps}
      >
        {renderMonthCalendar()}
        {renderSelectedDayDetails()}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      {isIOS ? (
        <>
          <Stack.Screen options={{ headerRight: undefined }} />
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              accessibilityLabel="日历设置"
              icon={getAppIconSFSymbol('viewSettings')}
              onPress={() => router.push('/settings/calendar')}
            />
          </Stack.Toolbar>
        </>
      ) : (
        <AndroidCompactTabHeader
          title="日历"
          right={renderCalendarSettingsButton()}
          compactHeaderStyle={androidHeader.compactHeaderStyle}
          overlayHeight={androidHeader.overlayHeight}
          overlayPaddingTop={androidHeader.overlayPaddingTop}
        />
      )}

      {renderChekiMonthView()}

      <CalendarMonthPicker
        visible={monthPickerVisible}
        selectedMonth={monthKey(selectedDate)}
        onClose={() => setMonthPickerVisible(false)}
        onSelect={handleSelectMonth}
      />
    </View>
  );
}

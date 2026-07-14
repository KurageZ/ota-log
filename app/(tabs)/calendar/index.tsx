import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  SectionList,
  ScrollView,
  Text,
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
import { EventCard } from '../../../src/components/EventCard';
import { ArtistRankingList } from '../../../src/components/ArtistRankingList';
import { ChekiManualEntryList } from '../../../src/components/ChekiManualEntryList';
import { ChekiStackPreviewCard } from '../../../src/components/ChekiStackPreviewCard';
import { FormFieldLabel } from '../../../src/components/FormPrimitives';
import { useDB } from '../../../src/context/DBContext';
import { useFloatingTabBarSpacing } from '../../../src/navigation/floatingTabBar';
import { useFloatingTabBarScroll } from '../../../src/navigation/FloatingTabBarVisibility';
import { DateItemCalendarOccurrence } from '../../../src/repositories/DateItemRepository';
import { useAppTheme } from '../../../src/theme/appTheme';
import { AppCalendarDefaultView, APP_CALENDAR_DEFAULT_VIEW_LABELS } from '../../../src/theme/config';
import { Artist, Cheki, ChekiCalendarDaySummary, ChekiManualEntry, Event } from '../../../src/types/models';
import { getArtistPrimaryName } from '../../../src/utils/artistDisplay';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { calculateChekiGridLayout, getChekiManualCount } from '../../../src/utils/cheki';
import { withAlpha } from '../../../src/utils/color';
import { toISODate } from '../../../src/utils/date';
import { getLocalDayDifference } from '../../../src/utils/dateItems';
import { getEventCardOshiBadge } from '../../../src/utils/oshiMatch';

type TimelineItem = { type: 'event'; data: Event };

type Section = {
  title: string;
  key: string;
  data: TimelineItem[];
};

type ViewMode = AppCalendarDefaultView;

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

const VIEW_MODES: ViewMode[] = ['month', 'timeline'];
const CALENDAR_CHEKI_GRID_GAP = 8;
const CALENDAR_CHEKI_ASPECT_RATIO = 86 / 54;
const CALENDAR_MONTH_CELL_SIGNAL_CARD_LIMIT = 3;
function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string): string {
  return key;
}

function buildTimeline(events: Event[]): Section[] {
  const buckets: Record<string, TimelineItem[]> = {};

  for (const event of events) {
    if (!event.event_date) continue;
    const key = monthKey(event.event_date);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push({ type: 'event', data: event });
  }

  return Object.keys(buckets)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      key,
      title: monthLabel(key),
      data: buckets[key].sort((a, b) => {
        const dateA = a.data.event_date;
        const dateB = b.data.event_date;
        const dateCompare = dateB.localeCompare(dateA);
        if (dateCompare !== 0) return dateCompare;
        return (b.data.event_time ?? '').localeCompare(a.data.event_time ?? '');
      }),
    }));
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

function CalendarDetailCard({ title, children }: { title: string; children: ReactNode }) {
  const { colors, isDark } = useAppTheme();

  return (
    <View
      style={{
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 14,
        marginBottom: 12,
        backgroundColor: colors.card,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.18 : 0.08,
        shadowRadius: 14,
        elevation: 3,
      }}
    >
      <FormFieldLabel>{title}</FormFieldLabel>
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

function buildChekiMonthCells(
  date: string,
  summaries: Map<string, ChekiCalendarDaySummary>,
): ChekiMonthCell[] {
  const { year, month } = parseISODate(date);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const currentDays = daysInMonth(year, month);
  const previousMonthDate = addMonths(formatISODate(year, month, 1), -1);
  const previous = parseISODate(previousMonthDate);
  const previousDays = daysInMonth(previous.year, previous.month);
  const cells: ChekiMonthCell[] = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
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
): MonthCellSignalCard[] {
  const cards: MonthCellSignalCard[] = [
    ...sortDayEvents(events).map((event) => ({
      key: `event-${event.id}`,
      kind: 'event' as const,
      text: event.event_time ? `${event.event_time} ${event.title}` : event.title,
    })),
    ...occurrences.map((occurrence) => ({
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
  const { isDark, colors, calendarDefaultView } = useAppTheme();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const { width: screenWidth } = useWindowDimensions();
  const isIOS = Platform.OS === 'ios';
  const androidHeader = useAndroidCollapsibleTabHeader();
  const monthViewTabBarScroll = useFloatingTabBarScroll();
  const timelineViewTabBarScroll = useFloatingTabBarScroll();
  const monthViewScrollProps = isIOS ? monthViewTabBarScroll : androidHeader.scrollProps;
  const timelineViewScrollProps = isIOS ? timelineViewTabBarScroll : androidHeader.scrollProps;

  const today = toISODate(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(calendarDefaultView);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dayEvents, setDayEvents] = useState<Event[]>([]);
  const [chekiSummaries, setChekiSummaries] = useState<ChekiCalendarDaySummary[]>([]);
  const [dayChekis, setDayChekis] = useState<Cheki[]>([]);
  const [dayNoPhotoEntries, setDayNoPhotoEntries] = useState<ChekiManualEntry[]>([]);
  const [dateItemOccurrences, setDateItemOccurrences] = useState<DateItemCalendarOccurrence[]>([]);
  const [dayDateItemOccurrences, setDayDateItemOccurrences] = useState<DateItemCalendarOccurrence[]>([]);
  const [artistMap, setArtistMap] = useState<Map<string, Artist>>(new Map());
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);

  useEffect(() => {
    setViewMode(calendarDefaultView);
  }, [calendarDefaultView]);

  const selectedMonth = useMemo(() => parseISODate(selectedDate), [selectedDate]);

  const loadData = useCallback(async () => {
    const [events, summaries, chekis, noPhotoEntries, artists, monthDateItems, selectedDateItems, config] = await Promise.all([
      db.events.findAll(),
      db.cheki.findCalendarSummariesByMonth(selectedMonth.year, selectedMonth.month),
      db.cheki.findByDate(selectedDate),
      db.chekiManualEntries.findByDate(selectedDate),
      db.artists.findAll(),
      db.dateItems.findCalendarOccurrencesByMonth(selectedMonth.year, selectedMonth.month, today),
      db.dateItems.findCalendarOccurrencesByDate(selectedDate, today),
      db.userConfig.getConfig(),
    ]);
    setAllEvents(events);
    setDayEvents(sortDayEvents(events.filter((event) => event.event_date === selectedDate)));
    setChekiSummaries(summaries);
    setDayChekis(chekis);
    setDayNoPhotoEntries(noPhotoEntries);
    setDateItemOccurrences(monthDateItems);
    setDayDateItemOccurrences(selectedDateItems);
    setArtistMap(new Map(artists.map((artist) => [artist.id, artist])));
    setOshiArtistId(config.oshi_artist_id);
  }, [db, selectedDate, selectedMonth.month, selectedMonth.year, today]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setDayEvents(sortDayEvents(allEvents.filter((event) => event.event_date === date)));
    setDayDateItemOccurrences(dateItemOccurrences.filter((occurrence) => occurrence.date === date));
    db.dateItems.findCalendarOccurrencesByDate(date, today)
      .then(setDayDateItemOccurrences)
      .catch(() => {});
  }, [allEvents, dateItemOccurrences, db, today]);

  const handleChangeChekiMonth = useCallback((delta: number) => {
    handleSelectDate(addMonths(selectedDate, delta));
  }, [handleSelectDate, selectedDate]);

  const handleSelectViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const timelineSections = useMemo(() => buildTimeline(allEvents), [allEvents]);
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
    () => buildChekiMonthCells(selectedDate, summaryMap),
    [selectedDate, summaryMap],
  );
  const selectedChekiSummary = summaryMap.get(selectedDate) ?? null;
  const noPhotoCount = useMemo(() => getChekiManualCount(dayNoPhotoEntries), [dayNoPhotoEntries]);
  const totalChekiCount = selectedChekiSummary?.totalCount ?? (dayChekis.length + noPhotoCount);
  const chekiPreviewAreaWidth = Math.max(1, screenWidth - 62);
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

  const openChekiLibraryForSelectedDate = useCallback(() => {
    router.push({
      pathname: '/cheki',
      params: {
        date: selectedDate,
      },
    });
  }, [selectedDate]);

  const renderSegmentedControl = useCallback(() => (
    <View style={{
      flexDirection: 'row',
      backgroundColor: isDark ? colors.input : colors.inputBorder,
      borderRadius: 10,
      padding: 3,
    }}>
      {VIEW_MODES.map((mode) => (
        <TouchableOpacity
          key={mode}
          onPress={() => { handleSelectViewMode(mode); }}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: viewMode === mode ? (isDark ? colors.inputBorder : colors.card) : 'transparent',
          }}
        >
          <Text style={{
            fontSize: 12,
            fontWeight: '700',
            color: viewMode === mode
              ? colors.text
              : colors.textMuted,
          }}>
            {APP_CALENDAR_DEFAULT_VIEW_LABELS[mode]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [colors.card, colors.input, colors.inputBorder, colors.text, colors.textMuted, handleSelectViewMode, isDark, viewMode]);

  const renderChekiStack = useCallback((summary: ChekiCalendarDaySummary) => {
    const imageSource: ImageSourcePropType | null = summary.latestPhotoUri
      ? { uri: summary.latestPhotoUri }
      : resolveAvatarSource(summary.fallbackArtistAvatarUri);
    const isNoPhotoOnly = !summary.latestPhotoUri;
    const visualPhotoCount = Math.min(summary.photoCount, 4);
    const backplateCount = isNoPhotoOnly ? 0 : Math.min(Math.max(visualPhotoCount - 1, 0), 2);

    return (
      <View style={{
        width: 38,
        height: 50,
        marginTop: 5,
      }}>
        {backplateCount >= 2 ? (
          <View style={{
            position: 'absolute',
            top: 6,
            left: 2,
            width: 28,
            height: 39,
            borderRadius: 5,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            transform: [{ rotate: '-12deg' }],
          }} />
        ) : null}
        {backplateCount >= 1 ? (
          <View style={{
            position: 'absolute',
            top: 5,
            right: 2,
            width: 28,
            height: 39,
            borderRadius: 5,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            transform: [{ rotate: backplateCount >= 2 ? '9deg' : '8deg' }],
          }} />
        ) : null}
        <View style={{
          position: 'absolute',
          left: 4,
          top: 0,
          width: 31,
          height: 43,
          paddingTop: 2,
          paddingHorizontal: 2,
          paddingBottom: 5,
          borderRadius: 6,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.inputBorder,
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
                borderRadius: 3,
                backgroundColor: colors.accentSofter,
              }}
            />
          ) : (
            <View style={{
              flex: 1,
              borderRadius: 3,
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
          borderWidth: 1.5,
          borderColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: colors.card }}>
            {summary.totalCount}
          </Text>
        </View>
      </View>
    );
  }, [colors, isDark]);

  const renderChekiMonthView = () => (
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
      {!isIOS ? (
        <AndroidLargeTabTitle
          title="日历"
          right={renderSegmentedControl()}
          largeTitleStyle={androidHeader.largeTitleStyle}
        />
      ) : null}

      <View style={{
        backgroundColor: colors.card,
        borderRadius: 22,
        paddingHorizontal: 12,
        paddingTop: 14,
        paddingBottom: 12,
        marginBottom: 14,
        shadowColor: colors.calendarShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 13,
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
          <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '900' }}>
            {monthTitle}
          </Text>
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
          {['日', '一', '二', '三', '四', '五', '六'].map((weekday) => (
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
            const signalCards = cell.summary
              ? []
              : buildMonthCellSignalCards(
                eventsByDate.get(cell.date) ?? [],
                dateItemOccurrencesByDate.get(cell.date) ?? [],
              );
            const showCornerSignals = cell.summary !== null && (hasEvent || hasDateItem);
            const isLastWeek = index >= chekiMonthCells.length - 7;
            return (
              <TouchableOpacity
                key={cell.date}
                activeOpacity={0.72}
                onPress={() => handleSelectDate(cell.date)}
                style={{
                  width: `${100 / 7}%`,
                  minHeight: 82,
                  paddingTop: 7,
                  paddingHorizontal: 2,
                  borderBottomWidth: isLastWeek ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <View style={{
                  position: 'relative',
                  alignSelf: 'stretch',
                  alignItems: 'center',
                  minHeight: 70,
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
                      {hasEvent ? (
                        <View style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: colors.accent,
                          opacity: cell.inMonth ? 1 : 0.35,
                          borderWidth: 1,
                          borderColor: colors.card,
                        }} />
                      ) : null}
                      {hasDateItem ? (
                        <View style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: colors.warning,
                          opacity: cell.inMonth ? 1 : 0.35,
                          borderWidth: 1,
                          borderColor: colors.card,
                        }} />
                      ) : null}
                    </View>
                  ) : null}
                  {cell.summary ? renderChekiStack(cell.summary) : signalCards.length > 0 ? (
                    <View style={{
                      alignSelf: 'stretch',
                      marginTop: 4,
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
                              height: 12,
                              paddingHorizontal: 4,
                              borderRadius: 4,
                              borderWidth: 1,
                              borderColor: cardBorderColor,
                              backgroundColor: cardBackgroundColor,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 3,
                              opacity: cell.inMonth ? 1 : 0.55,
                            }}
                          >
                            {card.kind !== 'overflow' ? (
                              <View
                                style={{
                                  width: 3,
                                  height: 3,
                                  borderRadius: 999,
                                  backgroundColor: cardTextColor,
                                }}
                              />
                            ) : null}
                            <Text
                              numberOfLines={1}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 8,
                                lineHeight: 9,
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

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
        <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '800', color: colors.heading }}>
          拍立得
        </Text>
        <View style={{ marginLeft: 7, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: colors.accentSofter }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: colors.accent }}>
            {totalChekiCount}张
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {totalChekiCount > 0 ? (
          <TouchableOpacity onPress={openChekiLibraryForSelectedDate} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>查看全部</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {hasPhotoChekiCard ? (
        <CalendarDetailCard title="拍立得">
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
            onPressEntry={(entry) => router.push(`/cheki/manual/${entry.id}/edit`)}
          />
        </CalendarDetailCard>
      ) : null}

      {hasRankingCard ? (
        <CalendarDetailCard title="排行">
          <ArtistRankingList
            items={dayArtistSummaries.map(({ artist, count }) => ({
              id: artist.id,
              name: getArtistPrimaryName(artist),
              avatarUri: artist.avatar_uri,
              value: count,
            }))}
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
        </CalendarDetailCard>
      ) : null}

      {!hasChekiSectionContent ? (
        <View style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 12 }}>
          <AppIcon name="cheki" size={24} color={colors.textMuted} />
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textMuted }}>
            这一天暂无拍立得
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
        <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '800', color: colors.heading }}>
          当天活动
        </Text>
        <View style={{ marginLeft: 7, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: colors.accentSofter }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: colors.accent }}>
            {dayEvents.length}场
          </Text>
        </View>
      </View>

      {dayEvents.length > 0 ? (
        dayEvents.map((event) => (
          <EventCard key={event.id} event={event} oshiBadge={getEventCardOshiBadge(event.status, null)} />
        ))
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 12 }}>
          <AppIcon name="calendar" size={24} color={colors.textMuted} />
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.textMuted }}>
            这一天暂无活动
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
        <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '800', color: colors.heading }}>
          重要日期
        </Text>
        <View style={{ marginLeft: 7, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: colors.accentSofter }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color: colors.accent }}>
            {dayDateItemOccurrences.length}个
          </Text>
        </View>
      </View>

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
            这一天暂无重要日期
          </Text>
        </View>
      )}

    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      {isIOS ? (
        <>
          <Stack.Screen options={{ headerRight: undefined }} />
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Menu
              icon={getAppIconSFSymbol('viewSettings')}
              accessibilityLabel={`切换日历视图，当前${APP_CALENDAR_DEFAULT_VIEW_LABELS[viewMode]}`}
            >
              <Stack.Toolbar.Menu inline>
                {VIEW_MODES.map((mode) => (
                  <Stack.Toolbar.MenuAction
                    key={mode}
                    isOn={viewMode === mode}
                    onPress={() => { handleSelectViewMode(mode); }}
                  >
                    {APP_CALENDAR_DEFAULT_VIEW_LABELS[mode]}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            </Stack.Toolbar.Menu>
          </Stack.Toolbar>
        </>
      ) : (
        <AndroidCompactTabHeader
          title="日历"
          right={renderSegmentedControl()}
          compactHeaderStyle={androidHeader.compactHeaderStyle}
          overlayHeight={androidHeader.overlayHeight}
          overlayPaddingTop={androidHeader.overlayPaddingTop}
        />
      )}

      {viewMode === 'month' ? (
        renderChekiMonthView()
      ) : (
        <SectionList
          sections={timelineSections}
          keyExtractor={(item) => item.data.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: isIOS ? 0 : androidHeader.contentTopPadding,
            paddingBottom: contentBottomPadding,
          }}
          contentInsetAdjustmentBehavior="automatic"
          scrollIndicatorInsets={isIOS ? undefined : { bottom: contentBottomPadding }}
          showsVerticalScrollIndicator={false}
          {...timelineViewScrollProps}
          ListHeaderComponent={!isIOS ? (
            <AndroidLargeTabTitle
              title="日历"
              right={renderSegmentedControl()}
              largeTitleStyle={androidHeader.largeTitleStyle}
            />
          ) : undefined}
          renderSectionHeader={({ section }) => (
            <View style={{
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.accent, marginRight: 8 }} />
              <Text style={{ fontSize: 17, lineHeight: 35, fontWeight: '800', color: isDark ? colors.accentBorder : colors.accent }}>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View>
              <EventCard event={item.data} oshiBadge={getEventCardOshiBadge(item.data.status, null)} />
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <AppIcon name="calendar" size={24} color={colors.textMuted} />
              <Text style={{ marginTop: 10, fontSize: 14, color: colors.textMuted }}>
                暂无活动记录
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

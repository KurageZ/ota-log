import type { ChekiCalendarDaySummary } from '../../types/models';
import {
  CALENDAR_WIDGET_TIMELINE_ENTRY_COUNT,
  calendarWidgetTimelineMonthKeys,
  createCalendarWidgetTimeline,
  type CalendarWidgetMonthData,
} from '../calendarWidgetPresentation';

const palettes = {
  light: {
    background: '#ffffff', heading: '#111111', text: '#333333', muted: '#999999',
    accent: '#7c3aed', accentSoft: '#f3e8ff', onAccent: '#ffffff',
  },
  dark: {
    background: '#111111', heading: '#ffffff', text: '#dddddd', muted: '#777777',
    accent: '#a78bfa', accentSoft: '#2e1065', onAccent: '#111111',
  },
};

function summary(overrides: Partial<ChekiCalendarDaySummary>): ChekiCalendarDaySummary {
  return {
    date: '2026-08-15', totalCount: 3, photoCount: 1, noPhotoCount: 2, artistCount: 1,
    latestPhotoUri: 'file:///photo.jpg', secondPhotoUri: null, thirdPhotoUri: null,
    fallbackArtistAvatarUri: null, ...overrides,
  };
}

function monthData(summaries: ChekiCalendarDaySummary[] = []): CalendarWidgetMonthData {
  return { summaries };
}

describe('createCalendarWidgetTimeline', () => {
  test('builds a fixed six-row month and shows only a small cheki photo on photo days', () => {
    const months = new Map([['2026-08', monthData([summary({})])]]);
    const timeline = createCalendarWidgetTimeline(
      months,
      new Map([['file:///photo.jpg', 'file:///cached.jpg']]),
      palettes,
      0,
      new Date(2026, 7, 15, 12),
    );

    expect(timeline).toHaveLength(CALENDAR_WIDGET_TIMELINE_ENTRY_COUNT);
    expect(timeline[0].props.days).toHaveLength(42);
    expect(timeline[0].props.title).toBe('2026年8月');
    expect(timeline[0].props.weekdays).toEqual(['日', '一', '二', '三', '四', '五', '六']);
    expect(timeline[0].props.days.find((day) => day.date === '2026-08-15')).toMatchObject({
      isToday: true,
      imageUri: 'file:///cached.jpg',
      count: 3,
    });
    expect(timeline[0].props.days.find((day) => day.date === '2026-08-16')).toMatchObject({
      imageUri: undefined,
      count: 0,
    });
  });

  test('follows Monday week start and uses the fallback avatar for no-photo records', () => {
    const noPhoto = summary({
      date: '2026-08-03',
      latestPhotoUri: null,
      photoCount: 0,
      fallbackArtistAvatarUri: 'file:///avatar.jpg',
    });
    const timeline = createCalendarWidgetTimeline(
      new Map([['2026-08', monthData([noPhoto])]]),
      new Map([['file:///avatar.jpg', 'file:///cached-avatar.jpg']]),
      palettes,
      1,
      new Date(2026, 7, 3, 9),
    );

    expect(timeline[0].props.weekdays).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(timeline[0].props.days[0].date).toBe('2026-07-27');
    expect(timeline[0].props.days.find((day) => day.date === '2026-08-03')).toMatchObject({
      imageUri: 'file:///cached-avatar.jpg',
      isAvatar: true,
    });
  });

  test('moves the timeline to the next month at local midnight', () => {
    const timeline = createCalendarWidgetTimeline(
      new Map([
        ['2026-08', monthData()],
        ['2026-09', monthData()],
      ]),
      new Map(),
      palettes,
      0,
      new Date(2026, 7, 31, 23, 30),
    );

    expect(timeline[0].props.title).toBe('2026年8月');
    expect(timeline[1].date).toEqual(new Date(2026, 8, 1));
    expect(timeline[1].props.title).toBe('2026年9月');
    expect(timeline[1].props.days.find((day) => day.date === '2026-09-01')?.isToday).toBe(true);
  });
});

describe('calendarWidgetTimelineMonthKeys', () => {
  test('returns every month needed by the rolling timeline', () => {
    expect(calendarWidgetTimelineMonthKeys(new Date(2026, 0, 31, 12), 45)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });
});

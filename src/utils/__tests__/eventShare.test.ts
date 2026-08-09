import type { Event, EventSession } from '../../types/models';
import {
  buildEventShareAction,
  formatEventShareDate,
  formatEventShareLocation,
  formatEventShareSessionDateTime,
  resolveEventShareSessions,
} from '../eventShare';

const event = {
  title: '测试活动',
  url: null,
  event_date: '2026-08-10',
  open_time: '17:00',
  start_time: '18:00',
  city: '上海',
  venue: '新歌空间',
} as Pick<Event, 'title' | 'url' | 'event_date' | 'open_time' | 'start_time' | 'city' | 'venue'>;

function session(overrides: Partial<EventSession> = {}): EventSession {
  return {
    id: 'session-1',
    event_id: 'event-1',
    title: null,
    session_date: '2026-08-10',
    end_date: null,
    open_time: '17:00',
    start_time: '18:00',
    end_time: null,
    city: '上海',
    venue: '新歌空间',
    sort_order: 0,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('event sharing text', () => {
  test('copies the event title together with a public URL', () => {
    expect(buildEventShareAction({ ...event, url: ' https://example.com/live ' }, []))
      .toEqual({
        menuLabel: '复制活动链接',
        toastLabel: '活动链接已复制',
        text: '测试活动\nhttps://example.com/live',
      });
  });

  test('falls back to all session dates, times, and locations', () => {
    const action = buildEventShareAction(event, [
      session(),
      session({
        id: 'session-2',
        session_date: '2026-08-11',
        end_date: '2026-08-12',
        open_time: null,
        start_time: null,
        city: null,
        venue: null,
      }),
    ]);

    expect(action).toEqual({
      menuLabel: '复制活动信息',
      toastLabel: '活动信息已复制',
      text: [
        '测试活动',
        '2026-08-10  OPEN 17:00 · START 18:00',
        '上海 · 新歌空间',
        '',
        '2026-08-11 至 2026-08-12  时间待定',
        '地点待定',
      ].join('\n'),
    });
  });

  test('uses compatibility event fields when no session rows exist', () => {
    const [fallback] = resolveEventShareSessions(event, []);
    expect(formatEventShareSessionDateTime(fallback))
      .toBe('2026-08-10  OPEN 17:00 · START 18:00');
    expect(formatEventShareLocation(fallback)).toBe('上海 · 新歌空间');
  });

  test('shows a date range only for a cross-day session', () => {
    const [singleDay, crossDay] = resolveEventShareSessions(event, [
      session(),
      session({ id: 'session-2', end_date: '2026-08-12' }),
    ]);
    expect(formatEventShareDate(singleDay)).toBe('2026-08-10');
    expect(formatEventShareDate(crossDay)).toBe('2026-08-10 至 2026-08-12');
  });

});

import type { Event, EventSession, EventTimetableEntry } from '../../../types/models';
import { projectEventLiveActivity } from '../projection';

const event: Event = {
  id: 'event-1', title: '测试活动', event_type: 'concert', actual_expense: null,
  event_date: '2026-09-01', event_time: '18:00', open_time: '17:30', start_time: '18:00',
  end_time: '21:00', city: '上海', venue: '测试场馆', ticket_price: null,
  status: 'planned', review_score: null, notes: null, details: null, url: null,
  setlist_text: null, trip_id: null, created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function session(overrides: Partial<EventSession> = {}): EventSession {
  return {
    id: 'session-1', event_id: event.id, title: '夜场', session_date: '2026-09-01',
    end_date: null, open_time: '17:30', start_time: '18:00', end_time: '21:00',
    city: '上海', venue: '测试场馆', sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function entry(
  id: string,
  startTime: string | null,
  endTime: string | null,
  sortOrder: number,
  title = id,
): EventTimetableEntry {
  return {
    id, session_id: 'session-1', title, artist_id: null, start_time: startTime,
    end_time: endTime, notes: null, sort_order: sortOrder,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('projectEventLiveActivity', () => {
  test('becomes eligible exactly 30 minutes before doors open', () => {
    const projection = projectEventLiveActivity(
      event,
      [session()],
      { 'session-1': [] },
      new Date('2026-09-01T17:00:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      phase: 'upcoming',
      countdownKind: 'opens',
      countdownTargetAt: new Date('2026-09-01T17:30:00').getTime(),
    });
  });

  test('reports the next eligible time before the prestart window', () => {
    const projection = projectEventLiveActivity(
      event,
      [session()],
      { 'session-1': [] },
      new Date('2026-09-01T16:59:59'),
    );
    expect(projection).toMatchObject({
      availability: 'unavailable',
      reason: 'too-early',
      nextEligibleAt: new Date('2026-09-01T17:00:00').getTime(),
    });
  });

  test('switches from the opening countdown to the performance countdown', () => {
    const projection = projectEventLiveActivity(
      event,
      [session()],
      { 'session-1': [] },
      new Date('2026-09-01T17:45:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      phase: 'upcoming',
      countdownKind: 'starts',
      countdownTargetAt: new Date('2026-09-01T18:00:00').getTime(),
      nextBoundaryAt: new Date('2026-09-01T18:00:00').getTime(),
    });
  });

  test('uses the only supplied opening time for eligibility and countdown', () => {
    const projection = projectEventLiveActivity(
      event,
      [session({ open_time: '17:30', start_time: null })],
      { 'session-1': [] },
      new Date('2026-09-01T17:15:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      phase: 'upcoming',
      countdownKind: 'opens',
      countdownTargetAt: new Date('2026-09-01T17:30:00').getTime(),
    });
  });

  test('uses the only supplied performance time for eligibility and countdown', () => {
    const projection = projectEventLiveActivity(
      event,
      [session({ open_time: null, start_time: '18:00' })],
      { 'session-1': [] },
      new Date('2026-09-01T17:45:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      phase: 'upcoming',
      countdownKind: 'starts',
      countdownTargetAt: new Date('2026-09-01T18:00:00').getTime(),
    });
  });

  test.each([
    ['matching opening and performance times', '18:00'],
    ['an opening time later than the performance time', '18:30'],
  ])('does not introduce a reversed opening phase for %s', (_label, openTime) => {
    const projection = projectEventLiveActivity(
      event,
      [session({ open_time: openTime, start_time: '18:00' })],
      { 'session-1': [] },
      new Date('2026-09-01T17:45:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      phase: 'upcoming',
      countdownKind: 'starts',
      countdownTargetAt: new Date('2026-09-01T18:00:00').getTime(),
    });
  });

  test('uses the next timed entry as an inferred entry end', () => {
    const entries = [
      entry('opening', '18:00', null, 0, '开场表演'),
      entry('main', '18:45', '19:30', 1, '主舞台'),
    ];
    const projection = projectEventLiveActivity(
      event,
      [session()],
      { 'session-1': entries },
      new Date('2026-09-01T18:20:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      phase: 'running',
      currentEntry: {
        entry: { id: 'opening' },
        endAt: new Date('2026-09-01T18:45:00').getTime(),
      },
      nextEntry: { entry: { id: 'main' } },
    });
  });

  test('uses the session end for the final timed entry', () => {
    const projection = projectEventLiveActivity(
      event,
      [session()],
      { 'session-1': [entry('finale', '20:00', null, 0)] },
      new Date('2026-09-01T20:30:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      currentEntry: {
        entry: { id: 'finale' },
        endAt: new Date('2026-09-01T21:00:00').getTime(),
      },
    });
  });

  test('defaults a missing session end to four hours after start', () => {
    const projection = projectEventLiveActivity(
      event,
      [session({ end_time: null })],
      { 'session-1': [entry('untimed-end', '18:00', null, 0)] },
      new Date('2026-09-01T18:30:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      phase: 'running',
      sessionEndsAt: new Date('2026-09-01T22:00:00').getTime(),
      usesDefaultEndTime: true,
    });
  });

  test('caps the default session end before the start date changes', () => {
    const projection = projectEventLiveActivity(
      event,
      [session({ start_time: '22:30', open_time: '22:00', end_time: null })],
      { 'session-1': [] },
      new Date('2026-09-01T23:00:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      sessionEndsAt: new Date('2026-09-01T23:59:59.999').getTime(),
      usesDefaultEndTime: true,
    });
  });

  test('uses the latest explicit timetable end as the session end fallback', () => {
    const projection = projectEventLiveActivity(
      event,
      [session({ end_time: null })],
      { 'session-1': [entry('main', '18:00', '20:15', 0)] },
      new Date('2026-09-01T19:00:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      sessionEndsAt: new Date('2026-09-01T20:15:00').getTime(),
    });
  });

  test('maps after-midnight entries onto the explicit end date', () => {
    const overnight = session({ end_date: '2026-09-02', end_time: '01:30' });
    const projection = projectEventLiveActivity(
      event,
      [overnight],
      { 'session-1': [entry('late', '00:30', '01:10', 0)] },
      new Date('2026-09-02T00:45:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      currentEntry: {
        entry: { id: 'late' },
        startAt: new Date('2026-09-02T00:30:00').getTime(),
      },
    });
  });

  test('chooses the latest-starting overlapping entry', () => {
    const projection = projectEventLiveActivity(
      event,
      [session()],
      {
        'session-1': [
          entry('stage-a', '18:00', '19:30', 0),
          entry('stage-b', '18:30', '19:00', 1),
        ],
      },
      new Date('2026-09-01T18:45:00'),
    );
    expect(projection).toMatchObject({
      availability: 'available',
      currentEntry: { entry: { id: 'stage-b' } },
    });
  });

  test('falls back to open time when start time is absent', () => {
    const projection = projectEventLiveActivity(
      event,
      [session({ start_time: null, open_time: '17:30' })],
      { 'session-1': [] },
      new Date('2026-09-01T17:31:00'),
    );
    expect(projection).toMatchObject({ availability: 'available', phase: 'running' });
  });

  test('does not start for wishlist activities', () => {
    const projection = projectEventLiveActivity(
      { ...event, status: 'wishlist' },
      [session()],
      { 'session-1': [] },
      new Date('2026-09-01T18:00:00'),
    );
    expect(projection).toEqual({ availability: 'unavailable', reason: 'ineligible-status' });
  });
});

import {
  applyImportedTimetableArtistResolutions,
  prepareImportedEventDraft,
} from '../importedEventDraft';
import type { ImportedEventPage } from '../ievent/importEvent';

const importedEvent: ImportedEventPage = {
  sourceUrl: 'https://ievent.life/event/10365',
  coverUrl: 'https://image.ievent.life/cover/10365.jpg',
  photoUrls: ['https://image.ievent.life/cover/10365.jpg'],
  details: '开场：10:30\n开演：11:00',
  parsed: {
    title: 'YGG IDOL Fes',
    event_date: '2026-07-25',
    event_time: '11:00',
    city: '上海',
    venue: '世界树剧场一号馆',
    artist: null,
    ticket_price: 93,
    artist_mentions: [],
  },
  sessions: [{
    sourceEventId: 10365,
    title: '',
    sessionDate: '2026-07-25',
    endDate: null,
    openTime: '10:30',
    startTime: '11:00',
    endTime: null,
    city: '上海',
    venue: '世界树剧场一号馆',
    timetable: [],
    sourceDetails: '开场：10:30\n开演：11:00',
  }],
  partialFailures: [],
};

describe('prepareImportedEventDraft', () => {
  test('hands a valid draft to the shared creation flow when cover download fails', async () => {
    const existingPhotoUris = ['file:///documents/existing.jpg'];
    const downloader = jest.fn(async () => null);

    await expect(prepareImportedEventDraft(
      importedEvent,
      [],
      existingPhotoUris,
      downloader,
    )).resolves.toEqual({
      draft: {
        fields: {
          title: 'YGG IDOL Fes',
          sessions: [{
            key: expect.any(String),
            title: '',
            session_date: '2026-07-25',
            end_date: '',
            open_time: '10:30',
            start_time: '11:00',
            end_time: '',
            city: '上海',
            venue: '世界树剧场一号馆',
            timetable: [],
          }],
          actual_expense: '93',
          details: '开场：10:30\n开演：11:00',
          url: 'https://ievent.life/event/10365',
        },
        matchedIds: [],
        candidates: [],
        shouldConfirmArtists: false,
      },
      photoUris: existingPhotoUris,
      mediaDownloadFailed: true,
    });
    expect(downloader).toHaveBeenCalledTimes(1);
  });

  test('prefills sessions, matches known artists, and applies confirmed resolutions', async () => {
    const event: ImportedEventPage = {
      ...importedEvent,
      photoUrls: [],
      parsed: {
        ...importedEvent.parsed,
        artist_mentions: [
          { rawName: 'Known Artist', source: 'lineup', order: 0 },
          { rawName: 'Unknown Artist', source: 'lineup', order: 1 },
        ],
      },
      sessions: [{
        ...importedEvent.sessions[0],
        sourceEventId: 10016,
        title: '主舞台',
        timetable: [
          {
            title: 'Known　Artist', startTime: '11:00', endTime: '11:20',
            notes: null, artistName: 'Known　Artist',
          },
          {
            title: 'Unknown Artist', startTime: '11:20', endTime: '11:40',
            notes: '特典会时间：12:00~13:00', artistName: 'Unknown Artist',
          },
          {
            title: '大合影', startTime: '21:00', endTime: null,
            notes: null, artistName: null,
          },
        ],
      }],
    };

    const handoff = await prepareImportedEventDraft(
      event,
      [{ id: 'known-id', name: 'Known Artist', short_name: null }],
      [],
    );
    const timetable = handoff.draft.fields.sessions?.[0].timetable ?? [];

    expect(handoff.draft.matchedIds).toEqual(['known-id']);
    expect(handoff.draft.candidates.map((candidate) => candidate.rawName))
      .toEqual(['Unknown Artist']);
    expect(timetable).toEqual([
      expect.objectContaining({
        title: 'Known　Artist', artist_id: 'known-id', source_artist_name: 'Known　Artist',
      }),
      expect.objectContaining({
        title: 'Unknown Artist', artist_id: '', source_artist_name: 'Unknown Artist',
      }),
      expect.objectContaining({ title: '大合影', artist_id: '' }),
    ]);

    const resolved = applyImportedTimetableArtistResolutions(
      handoff.draft.fields,
      new Map([['Unknown Artist', 'confirmed-id']]),
    );
    expect(resolved.sessions?.[0].timetable[1].artist_id).toBe('confirmed-id');
  });
});

import { prepareImportedEventDraft } from '../importedEventDraft';
import type { ImportedEventPage } from '../ievent/importEvent';

const importedEvent: ImportedEventPage = {
  sourceUrl: 'https://ievent.life/event/10365',
  coverUrl: 'https://image.ievent.life/cover/10365.jpg',
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
          event_date: '2026-07-25',
          event_time: '11:00',
          city: '上海',
          venue: '世界树剧场一号馆',
          ticket_price: '93',
          details: '开场：10:30\n开演：11:00',
          url: 'https://ievent.life/event/10365',
        },
        matchedIds: [],
        candidates: [],
        shouldConfirmArtists: false,
      },
      photoUris: existingPhotoUris,
      coverDownloadFailed: true,
    });
    expect(downloader).toHaveBeenCalledTimes(1);
  });
});

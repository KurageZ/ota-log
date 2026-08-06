import { appendImportedEventMedia } from '../importedEventMedia';

describe('appendImportedEventMedia', () => {
  test('does not call the downloader when there is no media', async () => {
    const downloader = jest.fn();

    await expect(appendImportedEventMedia([], [], downloader)).resolves.toEqual({
      photoUris: [],
      downloadFailed: false,
    });
    expect(downloader).not.toHaveBeenCalled();
  });

  test('downloads unique cover and timetable images while keeping partial success', async () => {
    const downloader = jest.fn(async (url: string) => (
      url.includes('timetable') ? null : 'file:///documents/event.jpg'
    ));

    await expect(appendImportedEventMedia(
      ['file:///documents/existing.jpg'],
      [
        'https://image.ievent.life/cover/event.jpg',
        'https://image.ievent.life/cover/event.jpg',
        'https://idols-events.oss-cn-hangzhou.aliyuncs.com/event_timetable/test.jpg',
      ],
      downloader,
    )).resolves.toEqual({
      photoUris: [
        'file:///documents/existing.jpg',
        'file:///documents/event.jpg',
      ],
      downloadFailed: true,
    });
    expect(downloader).toHaveBeenCalledTimes(2);
  });
});

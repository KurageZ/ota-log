import { File } from 'expo-file-system';
import { appendImportedEventMedia } from '../importedEventMedia';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));

describe('appendImportedEventMedia', () => {
  beforeEach(() => {
    jest.mocked(File).mockImplementation((uri) => ({ md5: String(uri) }) as File);
  });

  test('keeps one copy when different URLs download identical content', async () => {
    const deleteDuplicate = jest.fn();
    const deleteKept = jest.fn();
    jest.mocked(File).mockImplementation((uri) => ({
      md5: String(uri).includes('different') ? 'different-content' : 'same-content',
      delete: String(uri).includes('timetable') ? deleteDuplicate : deleteKept,
    }) as unknown as File);
    const downloader = jest.fn()
      .mockResolvedValueOnce('file:///documents/cover.jpg')
      .mockResolvedValueOnce('file:///documents/timetable.jpg')
      .mockResolvedValueOnce('file:///documents/different.jpg');

    await expect(appendImportedEventMedia(
      ['file:///documents/existing.jpg'],
      [
        'https://image.ievent.life/cover/cea9269f668f0875be2ccabfd5c37400.jpg',
        'https://idols-events.oss-cn-hangzhou.aliyuncs.com/event_timetable/eb1810558b17b656d487f0aa9e7990e6.jpg',
        'https://image.ievent.life/cover/different.jpg',
      ],
      downloader,
    )).resolves.toEqual({
      photoUris: ['file:///documents/existing.jpg', 'file:///documents/cover.jpg', 'file:///documents/different.jpg'],
      downloadFailed: false,
    });
    expect(deleteDuplicate).toHaveBeenCalledTimes(1);
    expect(deleteKept).not.toHaveBeenCalled();
    expect(downloader).toHaveBeenCalledTimes(3);
  });

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

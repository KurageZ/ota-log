import { appendImportedEventCover } from '../importedEventMedia';

describe('appendImportedEventCover', () => {
  test('appends a downloaded cover without replacing existing photos', async () => {
    const downloader = jest.fn(async () => 'file:///documents/event.jpg');

    await expect(appendImportedEventCover(
      ['file:///documents/existing.jpg'],
      'https://image.ievent.life/cover/event.jpg',
      downloader,
    )).resolves.toEqual({
      photoUris: [
        'file:///documents/existing.jpg',
        'file:///documents/event.jpg',
      ],
      downloadFailed: false,
    });
  });

  test('keeps the parsed draft photos when cover download fails', async () => {
    const existing = ['file:///documents/existing.jpg'];
    const downloader = jest.fn(async () => null);

    await expect(appendImportedEventCover(
      existing,
      'https://image.ievent.life/cover/event.jpg',
      downloader,
    )).resolves.toEqual({
      photoUris: existing,
      downloadFailed: true,
    });
  });

  test('does not call the downloader when there is no cover', async () => {
    const downloader = jest.fn();

    await expect(appendImportedEventCover([], null, downloader)).resolves.toEqual({
      photoUris: [],
      downloadFailed: false,
    });
    expect(downloader).not.toHaveBeenCalled();
  });
});

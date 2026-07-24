import type { Artist } from '../types/models';
import type { ImportedEventPage } from './ievent/importEvent';
import {
  appendImportedEventCover,
  type RemoteFileDownloader,
} from './importedEventMedia';
import {
  buildParsedEventDraft,
  type ParsedEventDraftResult,
} from './parsedEventDraft';

export interface ImportedEventDraftHandoff {
  draft: ParsedEventDraftResult;
  photoUris: string[];
  coverDownloadFailed: boolean;
}

export async function prepareImportedEventDraft(
  event: ImportedEventPage,
  allArtists: Array<Pick<Artist, 'id' | 'name' | 'short_name'>>,
  existingPhotoUris: string[],
  downloader?: RemoteFileDownloader,
): Promise<ImportedEventDraftHandoff> {
  const cover = await appendImportedEventCover(
    existingPhotoUris,
    event.coverUrl,
    downloader,
  );

  return {
    draft: buildParsedEventDraft(
      event.details,
      event.parsed,
      allArtists,
      { url: event.sourceUrl },
    ),
    photoUris: cover.photoUris,
    coverDownloadFailed: cover.downloadFailed,
  };
}

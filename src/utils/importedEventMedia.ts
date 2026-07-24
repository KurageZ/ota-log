import { downloadRemoteFile } from './downloadRemoteFile';

export type RemoteFileDownloader = (
  url: string,
  filenamePrefix: string,
) => Promise<string | null>;

export interface ImportedEventCoverResult {
  photoUris: string[];
  downloadFailed: boolean;
}

export async function appendImportedEventCover(
  photoUris: string[],
  coverUrl: string | null,
  downloader: RemoteFileDownloader = downloadRemoteFile,
): Promise<ImportedEventCoverResult> {
  if (!coverUrl) {
    return { photoUris, downloadFailed: false };
  }

  const downloadedUri = await downloader(coverUrl, 'event');
  return downloadedUri
    ? { photoUris: [...photoUris, downloadedUri], downloadFailed: false }
    : { photoUris, downloadFailed: true };
}

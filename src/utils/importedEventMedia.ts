import { downloadRemoteFile } from './downloadRemoteFile';

export type RemoteFileDownloader = (
  url: string,
  filenamePrefix: string,
) => Promise<string | null>;

export interface ImportedEventMediaResult {
  photoUris: string[];
  downloadFailed: boolean;
}

export async function appendImportedEventMedia(
  photoUris: string[],
  mediaUrls: string[],
  downloader: RemoteFileDownloader = downloadRemoteFile,
): Promise<ImportedEventMediaResult> {
  const uniqueUrls = [...new Set(mediaUrls)];
  if (uniqueUrls.length === 0) {
    return { photoUris, downloadFailed: false };
  }

  const downloads = await Promise.all(
    uniqueUrls.map((url, index) => downloader(url, index === 0 ? 'event' : 'event_info')),
  );
  const downloadedUris = downloads.filter((uri): uri is string => uri != null);
  return {
    photoUris: [...photoUris, ...downloadedUris],
    downloadFailed: downloadedUris.length !== uniqueUrls.length,
  };
}

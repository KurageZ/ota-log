import { File } from 'expo-file-system';
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
  const seenHashes = new Set<string>();
  const uniqueDownloadedUris = downloadedUris.filter((uri) => {
    const file = new File(uri);
    const hash = file.md5;
    if (hash == null) return true;
    if (seenHashes.has(hash)) {
      file.delete();
      return false;
    }
    seenHashes.add(hash);
    return true;
  });
  return {
    photoUris: [...photoUris, ...uniqueDownloadedUris],
    downloadFailed: downloadedUris.length !== uniqueUrls.length,
  };
}

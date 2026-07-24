import { File, Paths } from 'expo-file-system';
import { copyToDocuments } from './copyToDocuments';

export async function downloadRemoteFile(
  url: string,
  filenamePrefix: string,
  headers: Record<string, string> = {},
): Promise<string | null> {
  let temporaryFile: File | null = null;
  try {
    const rawExtension = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const extension = /^[a-z0-9]{2,5}$/.test(rawExtension) ? rawExtension : 'jpg';
    const filename = `download_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;
    temporaryFile = new File(Paths.cache, filename);
    await File.downloadFileAsync(url, temporaryFile, {
      headers,
      idempotent: true,
    });
    return await copyToDocuments(temporaryFile.uri, { filenamePrefix });
  } catch {
    return null;
  } finally {
    try {
      temporaryFile?.delete();
    } catch {
      // Cache cleanup is best-effort and should not turn a successful import into a failure.
    }
  }
}

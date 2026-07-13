import { File, Paths } from 'expo-file-system';
import { WEIBO_HEADERS } from './fetchPost';

export async function downloadWeiboFile(
  url: string,
  filenamePrefix: string,
  cookie: string,
): Promise<string | null> {
  try {
    const raw = url.split('?')[0];
    const ext = raw.split('.').pop() ?? 'jpg';
    const filename = `${filenamePrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const destFile = new File(Paths.document, filename);
    await File.downloadFileAsync(url, destFile, {
      headers: { ...WEIBO_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
      idempotent: true,
    });
    return destFile.uri;
  } catch {
    return null;
  }
}

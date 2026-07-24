import { WEIBO_HEADERS } from './fetchPost';
import { downloadRemoteFile } from '../downloadRemoteFile';

export async function downloadWeiboFile(
  url: string,
  filenamePrefix: string,
  cookie: string,
): Promise<string | null> {
  return downloadRemoteFile(
    url,
    filenamePrefix,
    { ...WEIBO_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
  );
}

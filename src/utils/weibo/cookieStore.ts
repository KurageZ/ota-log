import { File, Paths } from 'expo-file-system';

const FILENAME = 'weibo_cookie.txt';

function cookieFile(): File {
  return new File(Paths.document, FILENAME);
}

export async function loadWeiboCookie(): Promise<string> {
  const f = cookieFile();
  if (!f.exists) return '';
  try {
    return (await f.text()).trim();
  } catch {
    return '';
  }
}

export async function saveWeiboCookie(cookie: string): Promise<void> {
  const f = cookieFile();
  if (!f.exists) f.create();
  f.write(cookie);
}

import { File } from 'expo-file-system';

export function deleteTemporaryStickerFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Cache cleanup is best effort and must not hide the user's actual result.
  }
}

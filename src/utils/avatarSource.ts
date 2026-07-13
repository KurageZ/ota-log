import { resolveBundledArtistAvatar } from '../db/bundledArtistCatalog';

export function resolveAvatarSource(
  uri: string | null | undefined,
): number | { uri: string } | null {
  if (!uri) return null;
  if (uri.startsWith('preset://')) {
    const id = uri.slice(9);
    const mod = resolveBundledArtistAvatar(id);
    return mod != null ? mod : null;
  }
  return { uri };
}

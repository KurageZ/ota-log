import type { Artist } from '../../types/models';
import { normalizeArtistComparisonText } from '../artistName';
import type { WeiboFollowingUser } from './fetchFollowing';
import { extractWeiboUid } from './fetchUser';

function extractExistingWeiboUid(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!/(^|\.)weibo\.(com|cn)$/i.test(parsed.hostname)) return null;
    return extractWeiboUid(url);
  } catch {
    return null;
  }
}

export function findExistingWeiboUserIds(
  users: WeiboFollowingUser[],
  artists: Artist[],
): Set<string> {
  const existingUids = new Set<string>();
  const existingNames = new Set<string>();

  for (const artist of artists) {
    const uid = extractExistingWeiboUid(artist.url);
    if (uid) existingUids.add(uid);

    for (const value of [artist.name, artist.short_name]) {
      const normalized = value ? normalizeArtistComparisonText(value) : '';
      if (normalized) existingNames.add(normalized);
    }
  }

  return new Set(
    users
      .filter((user) => (
        existingUids.has(user.id)
        || existingNames.has(normalizeArtistComparisonText(user.screenName))
      ))
      .map((user) => user.id),
  );
}

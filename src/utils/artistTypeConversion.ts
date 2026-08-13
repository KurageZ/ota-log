import { Artist, ArtistType } from '../types/models';

export interface ArtistTypeConversionGraph {
  linkedIdsByArtistId: Record<string, string[]>;
  suggestedTypes: Record<string, ArtistType>;
  ambiguousArtistIds: Set<string>;
}

export interface ArtistAffiliationEdge {
  memberArtistId: string;
  parentArtistId: string;
}

export interface ArtistTypeConversionGroup {
  id: string;
  artists: Artist[];
  isRelationship: boolean;
  ambiguous: boolean;
  activityCount: number;
}

export function analyzeArtistTypeConversionGraph(
  artistIds: Iterable<string>,
  affiliations: ArtistAffiliationEdge[],
): ArtistTypeConversionGraph {
  const orderedArtistIds = [...artistIds];
  const artistIdSet = new Set(orderedArtistIds);
  const adjacency = new Map<string, Set<string>>(
    orderedArtistIds.map((artistId) => [artistId, new Set<string>()]),
  );
  const memberIds = new Set<string>();
  const parentIds = new Set<string>();

  for (const affiliation of affiliations) {
    if (!artistIdSet.has(affiliation.memberArtistId) || !artistIdSet.has(affiliation.parentArtistId)) {
      continue;
    }
    memberIds.add(affiliation.memberArtistId);
    parentIds.add(affiliation.parentArtistId);
    adjacency.get(affiliation.memberArtistId)!.add(affiliation.parentArtistId);
    adjacency.get(affiliation.parentArtistId)!.add(affiliation.memberArtistId);
  }

  const linkedIdsByArtistId: Record<string, string[]> = {};
  const suggestedTypes: Record<string, ArtistType> = {};
  const ambiguousArtistIds = new Set<string>();
  const visited = new Set<string>();

  for (const startArtistId of orderedArtistIds) {
    if (visited.has(startArtistId)) continue;
    const component: string[] = [];
    const queue = [startArtistId];
    visited.add(startArtistId);
    while (queue.length > 0) {
      const artistId = queue.shift()!;
      component.push(artistId);
      for (const neighborId of adjacency.get(artistId) ?? []) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }

    const ambiguous = component.some((artistId) => memberIds.has(artistId) && parentIds.has(artistId));
    for (const artistId of component) {
      linkedIdsByArtistId[artistId] = component;
      if (ambiguous) ambiguousArtistIds.add(artistId);
    }
    if (!ambiguous && component.length > 1) {
      for (const artistId of component) {
        if (memberIds.has(artistId)) suggestedTypes[artistId] = 'person';
        if (parentIds.has(artistId)) suggestedTypes[artistId] = 'group';
      }
    }
  }

  return { linkedIdsByArtistId, suggestedTypes, ambiguousArtistIds };
}

export function buildArtistTypeConversionGraph(artists: Artist[]): ArtistTypeConversionGraph {
  return analyzeArtistTypeConversionGraph(
    artists.map((artist) => artist.id),
    artists.flatMap((artist) => artist.parent_id ? [{
      memberArtistId: artist.id,
      parentArtistId: artist.parent_id,
    }] : []),
  );
}

export function updateLinkedTypeDecision(
  decisions: Record<string, ArtistType | null>,
  artistId: string,
  nextType: ArtistType | null,
  graph: ArtistTypeConversionGraph,
): Record<string, ArtistType | null> {
  if (graph.ambiguousArtistIds.has(artistId)) return decisions;
  const linkedIds = graph.linkedIdsByArtistId[artistId] ?? [artistId];
  if (linkedIds.length === 1) {
    return { ...decisions, [artistId]: nextType };
  }

  const next = { ...decisions };
  for (const linkedId of linkedIds) {
    next[linkedId] = nextType == null ? null : (graph.suggestedTypes[linkedId] ?? null);
  }
  return next;
}

export function buildArtistTypeConversionGroups(
  artists: Artist[],
  graph: ArtistTypeConversionGraph,
  activityCounts: Record<string, number>,
): ArtistTypeConversionGroup[] {
  const artistsById = new Map(artists.map((artist) => [artist.id, artist]));
  const seen = new Set<string>();
  const groups: ArtistTypeConversionGroup[] = [];

  for (const artist of artists) {
    if (seen.has(artist.id)) continue;
    const componentIds = graph.linkedIdsByArtistId[artist.id] ?? [artist.id];
    componentIds.forEach((artistId) => seen.add(artistId));
    const componentArtists = componentIds
      .map((artistId) => artistsById.get(artistId))
      .filter((item): item is Artist => item != null);
    const groupArtist = componentArtists.find((item) => graph.suggestedTypes[item.id] === 'group')
      ?? componentArtists.find((item) => !item.parent_id || !componentIds.includes(item.parent_id));
    const orderedArtists = [
      ...(groupArtist ? [groupArtist] : []),
      ...componentArtists
        .filter((item) => item.id !== groupArtist?.id)
        .sort((left, right) => (
          (activityCounts[right.id] ?? 0) - (activityCounts[left.id] ?? 0)
          || left.name.localeCompare(right.name)
        )),
    ];
    const activityCount = orderedArtists.reduce((total, item) => total + (activityCounts[item.id] ?? 0), 0);
    groups.push({
      id: groupArtist?.id ?? orderedArtists[0]?.id ?? artist.id,
      artists: orderedArtists,
      isRelationship: orderedArtists.length > 1,
      ambiguous: orderedArtists.some((item) => graph.ambiguousArtistIds.has(item.id)),
      activityCount,
    });
  }

  return groups.sort((left, right) => (
    Number(right.activityCount > 0) - Number(left.activityCount > 0)
    || right.activityCount - left.activityCount
    || (left.artists[0]?.name ?? '').localeCompare(right.artists[0]?.name ?? '')
  ));
}

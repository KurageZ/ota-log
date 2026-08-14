import {
  buildChekiSearchIndex,
  matchesChekiSearchIndex,
  normalizeChekiSearchText,
  tokenizeChekiSearchQuery,
} from './chekiSearch';

export const normalizeEventSearchText = normalizeChekiSearchText;
export const tokenizeEventSearchQuery = tokenizeChekiSearchQuery;

export function buildEventSearchIndex(parts: Array<string | null | undefined>): string {
  return buildChekiSearchIndex(parts);
}

export function matchesEventSearchIndex(index: string, query: string): boolean {
  return matchesChekiSearchIndex(index, tokenizeEventSearchQuery(query));
}

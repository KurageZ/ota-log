import {
  buildSearchIndex,
  matchesSearchIndex,
  normalizeSearchText,
  tokenizeSearchQuery,
} from './searchText';

export const normalizeChekiSearchText = normalizeSearchText;
export const tokenizeChekiSearchQuery = tokenizeSearchQuery;
export const buildChekiSearchIndex = buildSearchIndex;

interface ChekiRecordSearchFields {
  date: string | null;
  recordNotes: string | null;
  artistText: string | null;
  eventTitle: string | null;
}

interface ChekiItemSearchFields extends ChekiRecordSearchFields {
  itemNotes: string | null;
}

export function buildChekiItemSearchIndex(fields: ChekiItemSearchFields): string {
  return buildChekiSearchIndex([
    fields.date,
    fields.recordNotes,
    fields.itemNotes,
    fields.artistText,
    fields.eventTitle,
  ]);
}

export function buildChekiRecordSearchIndex(
  fields: ChekiRecordSearchFields & { itemNotes: Array<string | null> },
): string {
  return buildChekiSearchIndex([
    fields.date,
    fields.recordNotes,
    fields.artistText,
    fields.eventTitle,
    ...fields.itemNotes,
  ]);
}

export function matchesChekiSearchIndex(index: string, queryTokens: string[]): boolean {
  return matchesSearchIndex(index, queryTokens);
}

import {
  EMPTY_CHEKI_ITEM_FILTERS,
  EMPTY_CHEKI_RECORD_FILTERS,
  cloneChekiItemFilters,
  cloneChekiRecordFilters,
  countChekiItemFilterCategories,
  countChekiRecordFilterCategories,
} from '../chekiFilters';

describe('chekiFilters', () => {
  it('clones mutable selections for an independent draft', () => {
    const appliedRecord = { ...EMPTY_CHEKI_RECORD_FILTERS, artistIds: ['a'] };
    const recordDraft = cloneChekiRecordFilters(appliedRecord);
    recordDraft.artistIds.push('b');
    expect(appliedRecord.artistIds).toEqual(['a']);

    const appliedItem = { ...EMPTY_CHEKI_ITEM_FILTERS, specs: ['square' as const] };
    const itemDraft = cloneChekiItemFilters(appliedItem);
    itemDraft.specs.push('three_inch_portrait');
    expect(appliedItem.specs).toEqual(['square']);
  });

  it('counts active categories instead of selected option count', () => {
    expect(countChekiRecordFilterCategories({
      ...EMPTY_CHEKI_RECORD_FILTERS,
      artistIds: ['a', 'b'],
      eventId: 'event',
      hasLinkedEvent: true,
      hasNotes: true,
      hasBackImage: true,
    })).toBe(4);
    expect(countChekiItemFilterCategories({
      ...EMPTY_CHEKI_ITEM_FILTERS,
      specs: ['square', 'five_inch_landscape'],
      isFavorite: true,
      hasBackImage: true,
    })).toBe(3);
    expect(countChekiRecordFilterCategories({ ...EMPTY_CHEKI_RECORD_FILTERS, hasBackImage: true })).toBe(1);
    expect(countChekiItemFilterCategories({ ...EMPTY_CHEKI_ITEM_FILTERS, hasBackImage: true })).toBe(1);
  });
});

import {
  EMPTY_CHEKI_ITEM_FILTERS,
  EMPTY_CHEKI_RECORD_FILTERS,
  cloneChekiItemFilters,
  cloneChekiRecordFilters,
  countChekiItemFilterCategories,
  countChekiRecordFilterCategories,
  matchesChekiItemFilters,
} from '../chekiFilters';

const browseItem = {
  id: 'item-1',
  record_id: 'record-1',
  sort_order: 0,
  unit_price: 1000,
  spec: 'square' as const,
  is_favorite: 1 as const,
  notes: '签名',
  created_at: '2026-08-25T00:00:00.000Z',
  updated_at: '2026-08-25T00:00:00.000Z',
  images: [{
    id: 'image-back',
    item_id: 'item-1',
    side: 'back' as const,
    photo_uri: 'file:///back.jpg',
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
  }],
  record: {
    id: 'record-1',
    event_id: 'event-1',
    artist_id: 'artist-1',
    date: '2026-08-25',
    quantity: 1,
    notes: null,
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
  },
};

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

  it('matches the complete album item filter set', () => {
    expect(matchesChekiItemFilters(browseItem, {
      ...EMPTY_CHEKI_ITEM_FILTERS,
      date: { mode: 'day', startDate: '2026-08-25', endDate: '2026-08-25' },
      artistIds: ['artist-1'],
      specs: ['square'],
      hasLinkedEvent: true,
      hasNotes: true,
      isFavorite: true,
      hasBackImage: true,
    })).toBe(true);

    expect(matchesChekiItemFilters(browseItem, {
      ...EMPTY_CHEKI_ITEM_FILTERS,
      artistIds: ['artist-2'],
    })).toBe(false);
    expect(matchesChekiItemFilters(browseItem, {
      ...EMPTY_CHEKI_ITEM_FILTERS,
      date: { mode: 'day', startDate: '2026-08-24', endDate: '2026-08-24' },
    })).toBe(false);
    expect(matchesChekiItemFilters(browseItem, {
      ...EMPTY_CHEKI_ITEM_FILTERS,
      specs: ['three_inch_portrait'],
    })).toBe(false);
  });
});

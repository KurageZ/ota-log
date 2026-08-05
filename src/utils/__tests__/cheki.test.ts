import { Artist, Cheki, ChekiManualEntry } from '../../types/models';
import {
  calculateChekiGridLayout,
  calculateChekiStackPreview,
  calculateManualChekiTotalPrice,
  buildChekiViewerItems,
  chunkChekis,
  groupChekiRecordsByDate,
  matchesChekiKeyword,
} from '../cheki';

function artist(input: Partial<Artist> & Pick<Artist, 'id' | 'name'>): Artist {
  return {
    short_name: null,
    parent_id: null,
    avatar_uri: null,
    background_uri: null,
    background_color: null,
    url: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...input,
  };
}

describe('cheki keyword search', () => {
  const artists = [
    artist({ id: 'group', name: 'Group Name' }),
    artist({ id: 'member', name: 'Member Name', short_name: 'MN', parent_id: 'group' }),
  ];
  const artistMap = new Map(artists.map((item) => [item.id, item]));

  test('matches photo cheki notes', () => {
    expect(matchesChekiKeyword(
      { artist_id: null, notes: '第一次参加线上签售' },
      '线上签售',
      artistMap,
    )).toBe(true);
  });

  test('still matches artist names and recursive parent groups', () => {
    const record = { artist_id: 'member', notes: '普通备注' };

    expect(matchesChekiKeyword(record, 'MN', artistMap)).toBe(true);
    expect(matchesChekiKeyword(record, 'Group Name', artistMap)).toBe(true);
  });

  test('does not match unrelated text', () => {
    expect(matchesChekiKeyword(
      { artist_id: 'member', notes: '普通备注' },
      '不存在的关键词',
      artistMap,
    )).toBe(false);
  });
});

describe('manual cheki price calculation', () => {
  test('calculates total price from count and unit price', () => {
    expect(calculateManualChekiTotalPrice(3, 80)).toBe(240);
  });

  test('rounds currency results to two decimal places', () => {
    expect(calculateManualChekiTotalPrice(3, 0.1)).toBe(0.3);
    expect(calculateManualChekiTotalPrice(3, 12.345)).toBe(37.04);
  });

  test('rejects invalid counts and unit prices', () => {
    expect(calculateManualChekiTotalPrice(0, 80)).toBeNull();
    expect(calculateManualChekiTotalPrice(1.5, 80)).toBeNull();
    expect(calculateManualChekiTotalPrice(2, -1)).toBeNull();
  });
});

function cheki(input: Partial<Cheki> & Pick<Cheki, 'id'>): Cheki {
  return {
    event_id: null,
    artist_id: null,
    photo_uri: `file:///${input.id}.jpg`,
    front_photo_uri: `file:///${input.id}.jpg`,
    back_photo_uri: null,
    date: null,
    price: null,
    notes: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...input,
  };
}

function manualEntry(input: Partial<ChekiManualEntry> & Pick<ChekiManualEntry, 'id' | 'artist_id'>): ChekiManualEntry {
  return {
    event_id: null,
    date: null,
    count: 1,
    total_price: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...input,
  };
}

describe('cheki view helpers', () => {
  const chekis = [
    cheki({ id: 'old', date: '2026-05-01', created_at: '2026-05-01T10:00:00.000Z' }),
    cheki({ id: 'new', date: '2026-06-01', created_at: '2026-06-01T10:00:00.000Z' }),
    cheki({ id: 'created', date: null, created_at: '2026-06-02T10:00:00.000Z' }),
  ];

  test('keeps the back URI paired without adding it to the swipe sequence', () => {
    const viewerItems = buildChekiViewerItems([
      cheki({
        id: 'double-sided',
        front_photo_uri: 'file:///front.jpg',
        back_photo_uri: 'file:///back.jpg',
      }),
    ], new Map(), new Map());

    expect(viewerItems).toEqual([
      expect.objectContaining({
        id: 'double-sided',
        itemId: 'double-sided',
        photoUri: 'file:///front.jpg',
        frontPhotoUri: 'file:///front.jpg',
        backPhotoUri: 'file:///back.jpg',
        side: 'front',
      }),
    ]);
  });

  test('chunks photo cheki rows by selected column count', () => {
    expect(chunkChekis(chekis, 3).map((row) => row.map((item) => item.id))).toEqual([
      ['old', 'new', 'created'],
    ]);
    expect(chunkChekis(chekis, 4).map((row) => row.map((item) => item.id))).toEqual([
      ['old', 'new', 'created'],
    ]);
    expect(chunkChekis([...chekis, cheki({ id: 'extra' })], 3).map((row) => row.map((item) => item.id))).toEqual([
      ['old', 'new', 'created'],
      ['extra'],
    ]);
  });

  test('calculates responsive columns from the same target row density', () => {
    const phone = calculateChekiGridLayout({
      density: 'medium',
      availableWidth: 358,
      availableHeight: 580,
      gap: 8,
      aspectRatio: 86 / 54,
    });
    const tabletLandscape = calculateChekiGridLayout({
      density: 'medium',
      availableWidth: 992,
      availableHeight: 670,
      gap: 8,
      aspectRatio: 86 / 54,
    });

    expect(phone.targetRows).toBe(4);
    expect(tabletLandscape.targetRows).toBe(4);
    expect(phone.columns).toBe(4);
    expect(tabletLandscape.columns).toBeGreaterThan(phone.columns);
  });

  test('maps photo size density to distinct per-row counts', () => {
    const input = {
      availableWidth: 328,
      availableHeight: 734,
      gap: 8,
      aspectRatio: 86 / 54,
    };

    const large = calculateChekiGridLayout({ ...input, density: 'large' });
    const medium = calculateChekiGridLayout({ ...input, density: 'medium' });
    const small = calculateChekiGridLayout({ ...input, density: 'small' });

    expect(large.targetRows).toBe(3);
    expect(medium.targetRows).toBe(4);
    expect(small.targetRows).toBe(5);
    expect([large.columns, medium.columns, small.columns]).toEqual([3, 4, 5]);
    expect(medium.itemWidth).toBeGreaterThan(small.itemWidth);
    expect(small.columns).toBeGreaterThan(medium.columns);
    expect(large.itemWidth).toBeGreaterThan(small.itemWidth);
  });

  test('keeps the photo size column mapping stable when viewport height changes', () => {
    const shortViewport = calculateChekiGridLayout({
      density: 'small',
      availableWidth: 328,
      availableHeight: 480,
      gap: 8,
      aspectRatio: 86 / 54,
    });
    const tallViewport = calculateChekiGridLayout({
      density: 'small',
      availableWidth: 328,
      availableHeight: 734,
      gap: 8,
      aspectRatio: 86 / 54,
    });

    expect(shortViewport.columns).toBe(5);
    expect(tallViewport.columns).toBe(5);
  });

  test('only stacks date previews when photos overflow one row', () => {
    expect(calculateChekiStackPreview({ total: 5, columns: 5, visibleLimit: 10 })).toEqual({
      shouldStack: false,
      visibleCount: 5,
      hiddenCount: 0,
    });
    expect(calculateChekiStackPreview({ total: 6, columns: 5, visibleLimit: 10 })).toEqual({
      shouldStack: true,
      visibleCount: 6,
      hiddenCount: 0,
    });
  });

  test('caps visible stacked photos and reports hidden count', () => {
    expect(calculateChekiStackPreview({ total: 18, columns: 5, visibleLimit: 10 })).toEqual({
      shouldStack: true,
      visibleCount: 10,
      hiddenCount: 8,
    });
  });

  test('groups photo and manual records by date for stack view', () => {
    const groups = groupChekiRecordsByDate(
      chekis,
      [
        manualEntry({
          id: 'manual',
          artist_id: 'artist-1',
          date: '2026-06-01',
          count: 2,
          total_price: 120,
        }),
      ],
    );

    expect(groups.map((group) => ({
      date: group.date,
      chekiIds: group.chekis.map((item) => item.id),
      manualCount: group.manualEntries.length,
      totalCount: group.totalCount,
      totalPrice: group.totalPrice,
    }))).toEqual([
      { date: '2026-06-02', chekiIds: ['created'], manualCount: 0, totalCount: 1, totalPrice: 0 },
      { date: '2026-06-01', chekiIds: ['new'], manualCount: 1, totalCount: 3, totalPrice: 120 },
      { date: '2026-05-01', chekiIds: ['old'], manualCount: 0, totalCount: 1, totalPrice: 0 },
    ]);
  });
});

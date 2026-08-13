import { buildChekiDateSections, buildChekiMonthSections } from '../chekiSections';

const item = (id: string, date: string | null, createdAt = `2026-08-${id.padStart(2, '0')}T12:00:00.000Z`) => ({
  id,
  date,
  created_at: createdAt,
});

describe('chekiSections', () => {
  it('groups records by month and keeps records without a date last', () => {
    const sections = buildChekiMonthSections([
      item('1', '2026-07-20'),
      item('2', null),
      item('3', '2026-08-10'),
      item('4', '2026-08-12'),
    ], 'desc');

    expect(sections.map((section) => section.key)).toEqual(['2026-08', '2026-07', '__undated__']);
    expect(sections[0].items.map(({ id }) => id)).toEqual(['4', '3']);
  });

  it('reverses dated section and item order without moving the undated section', () => {
    const sections = buildChekiDateSections([
      item('1', '2026-08-10', '2026-08-10T10:00:00.000Z'),
      item('2', '2026-08-10', '2026-08-10T12:00:00.000Z'),
      item('3', '2026-08-12'),
      item('4', null),
    ], 'asc');

    expect(sections.map((section) => section.key)).toEqual(['2026-08-10', '2026-08-12', '__undated__']);
    expect(sections[0].items.map(({ id }) => id)).toEqual(['1', '2']);
  });
});

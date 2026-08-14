import { monthGridLeadingBlankCount, reorderWeekdayLabels } from '../calendarWeeks';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

describe('monthGridLeadingBlankCount', () => {
  test('2026-08 starts on Saturday: six blanks from Sunday, five from Monday', () => {
    expect(monthGridLeadingBlankCount(2026, 8, 0)).toBe(6);
    expect(monthGridLeadingBlankCount(2026, 8, 1)).toBe(5);
  });

  test('2026-11 starts on Sunday: no blanks from Sunday, six blanks from Monday', () => {
    expect(monthGridLeadingBlankCount(2026, 11, 0)).toBe(0);
    expect(monthGridLeadingBlankCount(2026, 11, 1)).toBe(6);
  });
});

describe('reorderWeekdayLabels', () => {
  test('keeps Sunday-first order when the week starts on Sunday', () => {
    expect(reorderWeekdayLabels(WEEKDAY_LABELS, 0)).toEqual(WEEKDAY_LABELS);
  });

  test('rotates to Monday-first order when the week starts on Monday', () => {
    expect(reorderWeekdayLabels(WEEKDAY_LABELS, 1)).toEqual([
      '一',
      '二',
      '三',
      '四',
      '五',
      '六',
      '日',
    ]);
  });
});

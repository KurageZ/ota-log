import { formatChineseDateWithWeekday, formatDateInput, normalizeDateInput } from '../date';

describe('Chinese date formatting', () => {
  test('includes the weekday and keeps the year by default', () => {
    expect(formatChineseDateWithWeekday('2026-08-13')).toBe('2026年8月13日 周四');
  });

  test('returns invalid input unchanged', () => {
    expect(formatChineseDateWithWeekday('2026-02-30')).toBe('2026-02-30');
  });
});

describe('date input formatting', () => {
  test('inserts date separators while typing digits', () => {
    expect(formatDateInput('20260812')).toBe('2026-08-12');
    expect(formatDateInput('2026')).toBe('2026-');
    expect(formatDateInput('202608')).toBe('2026-08-');
  });

  test('keeps the event form backspace behavior for automatic separators', () => {
    expect(formatDateInput('2026', '2026-')).toBe('202');
  });

  test('normalizes one-digit month and day segments on blur', () => {
    expect(normalizeDateInput('20261')).toBe('2026-01');
    expect(normalizeDateInput('2026012')).toBe('2026-01-02');
  });
});

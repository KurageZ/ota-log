import { formatEventTimes } from '../eventTime';

describe('formatEventTimes', () => {
  test('labels opening and performance times independently', () => {
    expect(formatEventTimes('17:30', '18:30')).toBe('开场 17:30 · 开演 18:30');
    expect(formatEventTimes('17:30', null)).toBe('开场 17:30');
    expect(formatEventTimes(null, '18:30')).toBe('开演 18:30');
    expect(formatEventTimes(null, null)).toBeNull();
  });
});

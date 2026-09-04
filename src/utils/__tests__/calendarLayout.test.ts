import { shouldUseCalendarSplitLayout } from '../calendarLayout';

describe('shouldUseCalendarSplitLayout', () => {
  it('only enables the two-pane calendar for wide iOS windows', () => {
    expect(shouldUseCalendarSplitLayout('compact', true)).toBe(false);
    expect(shouldUseCalendarSplitLayout('regular', true)).toBe(false);
    expect(shouldUseCalendarSplitLayout('wide', true)).toBe(true);
    expect(shouldUseCalendarSplitLayout('wide', false)).toBe(false);
  });
});

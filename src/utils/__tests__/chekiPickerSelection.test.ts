import {
  appendChekiPickerSelection,
  removeChekiPickerSelection,
} from '../chekiPickerSelection';

describe('appendChekiPickerSelection', () => {
  test('keeps previous selections and appends visible results in order', () => {
    expect(appendChekiPickerSelection(
      ['already-selected'],
      ['visible-1', 'already-selected', 'visible-2'],
      48,
    )).toEqual(['already-selected', 'visible-1', 'visible-2']);
  });

  test('stops at the selection limit using the first visible results', () => {
    const visibleIds = Array.from({ length: 60 }, (_, index) => `visible-${index + 1}`);
    const result = appendChekiPickerSelection(['kept-1', 'kept-2'], visibleIds, 48);

    expect(result).toHaveLength(48);
    expect(result.slice(0, 2)).toEqual(['kept-1', 'kept-2']);
    expect(result.at(-1)).toBe('visible-46');
  });

  test('removes only selected items in the current visible results', () => {
    expect(removeChekiPickerSelection(
      ['kept-outside-results', 'visible-1', 'visible-2'],
      ['visible-1', 'visible-2', 'visible-3'],
    )).toEqual(['kept-outside-results']);
  });
});

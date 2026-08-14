import { toggleBatchSelection } from '../filterSelection';

describe('filterSelection', () => {
  test('adds a batch when any value is missing', () => {
    expect(toggleBatchSelection(['artist-1'], ['artist-1', 'artist-2'])).toEqual(['artist-1', 'artist-2']);
  });

  test('removes a batch when every value is selected', () => {
    expect(toggleBatchSelection(['artist-1', 'artist-2', 'artist-3'], ['artist-1', 'artist-2']))
      .toEqual(['artist-3']);
  });

  test('leaves the selection unchanged for an empty batch', () => {
    expect(toggleBatchSelection(['artist-1'], [])).toEqual(['artist-1']);
  });
});

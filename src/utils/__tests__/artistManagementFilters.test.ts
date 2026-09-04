import type { Artist } from '../../types/models';
import { matchesArtistGroupFilter } from '../artistManagementFilters';

function makeArtist(id: string, artistType: Artist['artist_type']): Artist {
  return {
    id,
    name: id,
    short_name: null,
    artist_type: artistType,
    parent_id: null,
    avatar_uri: null,
    background_uri: null,
    background_color: null,
    url: null,
    is_favorite: 0,
    created_at: '2026-09-04T00:00:00.000Z',
  };
}

describe('matchesArtistGroupFilter', () => {
  test('无所属团体只包含无所属个人和无所属未设置，不包含团体', () => {
    const ungroupedPerson = makeArtist('person', 'person');
    const ungroupedUnset = makeArtist('unset', null);
    const group = makeArtist('group', 'group');

    expect(matchesArtistGroupFilter(ungroupedPerson, 'no_parent', false)).toBe(true);
    expect(matchesArtistGroupFilter(ungroupedUnset, 'no_parent', false)).toBe(true);
    expect(matchesArtistGroupFilter(group, 'no_parent', false)).toBe(false);
  });
});

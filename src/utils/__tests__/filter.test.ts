import { Artist } from '../../types/models';
import {
  filterArtistsByQuery,
  getArtistSearchText,
  sortArtistsByPreference,
  sortArtistsWithOshi,
} from '../filter';

function artist(input: Partial<Artist> & Pick<Artist, 'id' | 'name'>): Artist {
  return {
    short_name: null,
    artist_type: null,
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

describe('artist filtering', () => {
  test('sortArtistsWithOshi promotes the oshi and preserves the remaining order', () => {
    const artists = [
      artist({ id: 'first', name: 'First' }),
      artist({ id: 'oshi', name: 'Oshi' }),
      artist({ id: 'last', name: 'Last' }),
    ];

    expect(sortArtistsWithOshi(artists, 'oshi').map((item) => item.id)).toEqual(['oshi', 'first', 'last']);
    expect(artists.map((item) => item.id)).toEqual(['first', 'oshi', 'last']);
  });

  test('sortArtistsByPreference promotes oshi and its parent group above favorites and their groups', () => {
    const artists = [
      artist({ id: 'oshi', name: 'Oshi', parent_id: 'oshiGroup' }),
      artist({ id: 'oshiGroup', name: 'Oshi Group' }),
      artist({ id: 'fav', name: 'Fav', is_favorite: 1, parent_id: 'favGroup' }),
      artist({ id: 'favGroup', name: 'Fav Group' }),
      artist({ id: 'other1', name: 'Other 1' }),
      artist({ id: 'other2', name: 'Other 2' }),
    ];

    expect(sortArtistsByPreference(artists, 'oshi').map((item) => item.id)).toEqual([
      'oshi',
      'oshiGroup',
      'fav',
      'favGroup',
      'other1',
      'other2',
    ]);
  });

  test('sortArtistsByPreference follows the full parent chain of oshi and favorites', () => {
    const artists = [
      artist({ id: 'other', name: 'Other' }),
      artist({ id: 'oshi', name: 'Oshi', parent_id: 'group' }),
      artist({ id: 'group', name: 'Group', parent_id: 'agency' }),
      artist({ id: 'agency', name: 'Agency' }),
      artist({ id: 'fav', name: 'Fav', is_favorite: 1, parent_id: 'favGroup' }),
      artist({ id: 'favGroup', name: 'Fav Group', parent_id: 'favAgency' }),
      artist({ id: 'favAgency', name: 'Fav Agency' }),
    ];

    expect(sortArtistsByPreference(artists, 'oshi').map((item) => item.id)).toEqual([
      'oshi',
      'group',
      'agency',
      'fav',
      'favGroup',
      'favAgency',
      'other',
    ]);
  });

  test('sortArtistsByPreference does not promote members of a favorite group', () => {
    const artists = [
      artist({ id: 'other', name: 'Other' }),
      artist({ id: 'member', name: 'Member', parent_id: 'favGroup' }),
      artist({ id: 'favGroup', name: 'Fav Group', is_favorite: 1 }),
    ];

    expect(sortArtistsByPreference(artists).map((item) => item.id)).toEqual([
      'favGroup',
      'other',
      'member',
    ]);
  });

  test('sortArtistsByPreference preserves the original order without oshi or favorites', () => {
    const artists = [
      artist({ id: 'first', name: 'First' }),
      artist({ id: 'second', name: 'Second' }),
    ];

    expect(sortArtistsByPreference(artists).map((item) => item.id)).toEqual(['first', 'second']);
  });

  test('sortArtistsByPreference with group priority puts oshi, oshi group, favorite groups, other groups, then persons', () => {
    const artists = [
      artist({ id: 'otherGroup', name: 'Other Group', artist_type: 'group' }),
      artist({ id: 'otherPerson', name: 'Other Person', artist_type: 'person' }),
      artist({ id: 'oshi', name: 'Oshi', artist_type: 'person', parent_id: 'oshiGroup', is_favorite: 1 }),
      artist({ id: 'oshiGroup', name: 'Oshi Group', artist_type: 'group' }),
      artist({ id: 'favGroup', name: 'Fav Group', artist_type: 'group', parent_id: 'favAgency', is_favorite: 1 }),
      artist({ id: 'favAgency', name: 'Fav Agency', artist_type: 'group' }),
      artist({ id: 'favPerson', name: 'Fav Person', artist_type: 'person', parent_id: 'favGroup', is_favorite: 1 }),
      artist({ id: 'unset', name: 'Unset', artist_type: null }),
    ];

    expect(sortArtistsByPreference(artists, 'oshi', 'group').map((item) => item.id)).toEqual([
      'oshi',
      'oshiGroup',
      'favGroup',
      'favAgency',
      'otherGroup',
      'favPerson',
      'otherPerson',
      'unset',
    ]);
  });

  test('sortArtistsByPreference infers untyped artists from parent relations in group mode', () => {
    const artists = [
      artist({ id: 'oshi', name: 'Oshi', artist_type: 'person' }),
      artist({ id: 'untypedGroup', name: 'Untyped Group', artist_type: null }),
      artist({ id: 'untypedMember', name: 'Untyped Member', artist_type: null, parent_id: 'untypedGroup' }),
      artist({ id: 'typedPerson', name: 'Typed Person', artist_type: 'person' }),
    ];

    expect(sortArtistsByPreference(artists, 'oshi', 'group').map((item) => item.id)).toEqual([
      'oshi',
      'untypedGroup',
      'untypedMember',
      'typedPerson',
    ]);
  });

  test('sortArtistsByPreference infers untyped artists from parent relations in person mode', () => {
    const artists = [
      artist({ id: 'oshi', name: 'Oshi', artist_type: 'person' }),
      artist({ id: 'untypedMember', name: 'Untyped Member', artist_type: null, parent_id: 'untypedGroup' }),
      artist({ id: 'typedPerson', name: 'Typed Person', artist_type: 'person' }),
      artist({ id: 'untypedGroup', name: 'Untyped Group', artist_type: null }),
      artist({ id: 'member', name: 'Member', artist_type: 'person', parent_id: 'untypedGroup' }),
    ];

    expect(sortArtistsByPreference(artists, 'oshi', 'person').map((item) => item.id)).toEqual([
      'oshi',
      'untypedMember',
      'typedPerson',
      'member',
      'untypedGroup',
    ]);
  });

  test('filterArtistsByQuery matches parent-group names through a separate lookup', () => {
    const candidates = [
      artist({ id: 'member', name: '小美', parent_id: 'group' }),
    ];
    const lookup = [
      artist({ id: 'member', name: '小美', parent_id: 'group' }),
      artist({ id: 'group', name: '超级团体' }),
    ];

    expect(filterArtistsByQuery(candidates, '超级团体', null, lookup).map((item) => item.id)).toEqual(['member']);
    expect(filterArtistsByQuery(candidates, '超级团体').map((item) => item.id)).toEqual([]);
  });

  test('sortArtistsByPreference resolves favorite chains through a separate lookup', () => {
    const candidates = [
      artist({ id: 'group', name: 'Fav Person Group', artist_type: 'group' }),
      artist({ id: 'otherGroup', name: 'Other Group', artist_type: 'group' }),
    ];
    const lookup = [
      ...candidates,
      artist({ id: 'favPerson', name: 'Fav Person', artist_type: 'person', parent_id: 'group', is_favorite: 1 }),
    ];

    expect(sortArtistsByPreference(candidates, null, 'group', lookup).map((item) => item.id)).toEqual([
      'group',
      'otherGroup',
    ]);
  });

  test('sortArtistsByPreference with person priority puts oshi, favorite persons, other persons, then groups', () => {
    const artists = [
      artist({ id: 'oshi', name: 'Oshi', artist_type: 'person', parent_id: 'oshiGroup', is_favorite: 1 }),
      artist({ id: 'oshiGroup', name: 'Oshi Group', artist_type: 'group' }),
      artist({ id: 'favPerson', name: 'Fav Person', artist_type: 'person', is_favorite: 1 }),
      artist({ id: 'favGroup', name: 'Fav Group', artist_type: 'group', is_favorite: 1 }),
      artist({ id: 'otherPerson', name: 'Other Person', artist_type: 'person' }),
      artist({ id: 'otherGroup', name: 'Other Group', artist_type: 'group' }),
      artist({ id: 'unset', name: 'Unset', artist_type: null }),
    ];

    expect(sortArtistsByPreference(artists, 'oshi', 'person').map((item) => item.id)).toEqual([
      'oshi',
      'favPerson',
      'otherPerson',
      'oshiGroup',
      'favGroup',
      'otherGroup',
      'unset',
    ]);
  });

  test('search text includes recursive parent groups', () => {
    const artists = [
      artist({ id: 'agency', name: 'Agency Root' }),
      artist({ id: 'group', name: 'Group Name', short_name: 'GN', parent_id: 'agency' }),
      artist({ id: 'member', name: 'Member Name', short_name: 'MN', parent_id: 'group' }),
    ];

    expect(getArtistSearchText(artists[2], artists)).toContain('Member Name');
    expect(getArtistSearchText(artists[2], artists)).toContain('Group Name');
    expect(getArtistSearchText(artists[2], artists)).toContain('Agency Root');
  });

  test('filterArtistsByQuery matches artists by recursive parent group name', () => {
    const artists = [
      artist({ id: 'group', name: 'Group Name' }),
      artist({ id: 'member', name: 'Member Name', parent_id: 'group' }),
      artist({ id: 'solo', name: 'Solo Artist' }),
    ];

    expect(filterArtistsByQuery(artists, 'Group Name').map((item) => item.id)).toEqual(['group', 'member']);
  });

  test('filterArtistsByQuery shares account-handle normalization with artist matching', () => {
    const artists = [
      artist({ id: 'bpm', name: 'BPM' }),
      artist({ id: 'vortex', name: '惑星 VORTEX' }),
    ];

    expect(filterArtistsByQuery(artists, 'BPM_official').map((item) => item.id)).toEqual(['bpm']);
    expect(filterArtistsByQuery(artists, '惑星-vortex').map((item) => item.id)).toEqual(['vortex']);
  });

  test('account suffix-only queries do not become empty searches', () => {
    const artists = [
      artist({ id: 'official', name: 'BPM_official' }),
      artist({ id: 'info', name: 'NarakuChaos_info' }),
      artist({ id: 'plain', name: 'Plain Artist' }),
    ];

    expect(filterArtistsByQuery(artists, 'official').map((item) => item.id)).toEqual(['official']);
    expect(filterArtistsByQuery(artists, 'info').map((item) => item.id)).toEqual(['info']);
    expect(filterArtistsByQuery(artists, 'jp')).toEqual([]);
  });

  test('search keeps visually similar characters distinct', () => {
    const artists = [
      artist({ id: 'digit', name: 'A1' }),
      artist({ id: 'letter', name: 'Ai' }),
      artist({ id: 'cyrillic', name: 'SolameИte' }),
      artist({ id: 'latin', name: 'Solamente' }),
    ];

    expect(filterArtistsByQuery(artists, 'A1').map((item) => item.id)).toEqual(['digit']);
    expect(filterArtistsByQuery(artists, 'Ai').map((item) => item.id)).toEqual(['letter']);
    expect(filterArtistsByQuery(artists, 'SolameИte').map((item) => item.id)).toEqual(['cyrillic']);
    expect(filterArtistsByQuery(artists, 'Solamente').map((item) => item.id)).toEqual(['latin']);
  });
});

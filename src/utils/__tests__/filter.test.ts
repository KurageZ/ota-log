import { Artist } from '../../types/models';
import { filterArtistsByQuery, getArtistSearchText, sortArtistsWithOshi } from '../filter';

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

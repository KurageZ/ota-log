import { Artist } from '../../types/models';
import { getArtistDisplayText, getArtistPrimaryName } from '../artistDisplay';

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

describe('artist display text', () => {
  test('getArtistPrimaryName prefers short names', () => {
    expect(getArtistPrimaryName(artist({ id: 'artist-1', name: 'Full Name', short_name: 'Short' }))).toBe('Short');
    expect(getArtistPrimaryName(artist({ id: 'artist-2', name: 'Full Name' }))).toBe('Full Name');
  });

  test('management mode prefers short name and only shows parent group name as subtitle', () => {
    expect(
      getArtistDisplayText({
        artist: artist({ id: 'artist-1', name: 'Full Name', short_name: 'Short' }),
        parentName: 'Group Name',
        mode: 'management',
      })
    ).toEqual({ title: 'Short', subtitle: 'Group Name' });
  });

  test('management mode does not show full name as a subtitle', () => {
    expect(
      getArtistDisplayText({
        artist: artist({ id: 'artist-1', name: 'Full Name', short_name: 'Short' }),
        mode: 'management',
      })
    ).toEqual({ title: 'Short', subtitle: null });
  });

  test('compact mode keeps a single-line display name', () => {
    expect(
      getArtistDisplayText({
        artist: artist({ id: 'artist-1', name: 'Full Name', short_name: 'Short' }),
        parentName: 'Group Name',
      })
    ).toEqual({ title: 'Short', subtitle: null });
  });
});

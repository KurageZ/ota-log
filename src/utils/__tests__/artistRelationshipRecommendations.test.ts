import type { Artist } from '../../types/models';
import {
  getArtistNameRecommendations,
  promoteArtistNameRecommendations,
} from '../artistRelationshipRecommendations';

function artist(id: string, name: string, shortName: string | null = null): Artist {
  return {
    id,
    name,
    short_name: shortName,
    artist_type: null,
    parent_id: null,
    avatar_uri: null,
    background_uri: null,
    background_color: null,
    url: null,
    is_favorite: 0,
    created_at: '2026-09-04T00:00:00.000Z',
  };
}

describe('artist relationship name recommendations', () => {
  const vortexGroup = artist('vortex', '惑星 VORTEX');
  const otherGroup = artist('other', '月夜グループ');

  test('recommends a group from a meaningful fragment in a person name', () => {
    expect(getArtistNameRecommendations(
      { name: '海羽Rione-VORTEX' },
      [otherGroup, vortexGroup],
    )).toEqual([
      { artistId: 'vortex', matchedText: 'VORTEX', score: 206 },
    ]);
  });

  test('supports the reverse flow when a group chooses people', () => {
    const matchingPerson = artist('rione', '海羽Rione_VORTEX');
    const otherPerson = artist('other-person', '月野ひかり');

    expect(getArtistNameRecommendations(
      { name: '惑星 VORTEX' },
      [otherPerson, matchingPerson],
    ).map((item) => item.artistId)).toEqual(['rione']);
  });

  test('normalizes full-width characters, case, spaces, and separators', () => {
    expect(getArtistNameRecommendations(
      { name: '海羽Ｒｉｏｎｅ－ＶＯＲＴＥＸ' },
      [vortexGroup],
    )[0]).toMatchObject({ artistId: 'vortex', matchedText: 'VORTEX' });
  });

  test('matches a group fragment even when it is concatenated into the person name', () => {
    expect(getArtistNameRecommendations(
      { name: '海羽RioneVORTEX' },
      [vortexGroup],
    )[0]).toMatchObject({ artistId: 'vortex', matchedText: 'VORTEX' });
  });

  test('ignores generic or too-short shared fragments', () => {
    const genericGroup = artist('generic', 'Dream Idol Project');
    const shortGroup = artist('short', 'AB');

    expect(getArtistNameRecommendations(
      { name: 'Alice Idol-AB' },
      [genericGroup, shortGroup],
    )).toEqual([]);
  });

  test('promotes recommendations without disturbing the remaining order', () => {
    expect(promoteArtistNameRecommendations(
      [otherGroup, vortexGroup, artist('last', '最后一个团体')],
      [{ artistId: 'vortex', matchedText: 'VORTEX', score: 206 }],
    ).map((item) => item.id)).toEqual(['vortex', 'other', 'last']);
  });
});

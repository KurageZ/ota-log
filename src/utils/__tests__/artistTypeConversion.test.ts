import { Artist } from '../../types/models';
import {
  analyzeArtistTypeConversionGraph,
  buildArtistTypeConversionGraph,
  buildArtistTypeConversionGroups,
  updateLinkedTypeDecision,
} from '../artistTypeConversion';

function artist(id: string, parentId: string | null = null): Artist {
  return {
    id,
    name: id,
    short_name: null,
    artist_type: null,
    parent_id: parentId,
    avatar_uri: null,
    background_uri: null,
    background_color: null,
    url: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('artist type conversion selection linkage', () => {
  test('selecting or clearing one artist updates the whole direct affiliation group', () => {
    const artists = [artist('group'), artist('person-a', 'group'), artist('person-b', 'group')];
    const graph = buildArtistTypeConversionGraph(artists);
    const empty = Object.fromEntries(artists.map((item) => [item.id, null]));

    const selected = updateLinkedTypeDecision(empty, 'person-a', 'person', graph);
    expect(selected).toEqual({ group: 'group', 'person-a': 'person', 'person-b': 'person' });

    expect(updateLinkedTypeDecision(selected, 'group', null, graph)).toEqual({
      group: null,
      'person-a': null,
      'person-b': null,
    });
  });

  test('allows an isolated artist to be converted independently', () => {
    const artists = [artist('solo')];
    const graph = buildArtistTypeConversionGraph(artists);

    expect(updateLinkedTypeDecision({ solo: null }, 'solo', 'group', graph)).toEqual({ solo: 'group' });
  });

  test('does not allow selecting a multi-level affiliation component', () => {
    const artists = [artist('root'), artist('middle', 'root'), artist('leaf', 'middle')];
    const graph = buildArtistTypeConversionGraph(artists);
    const decisions = { root: null, middle: null, leaf: null };

    expect([...graph.ambiguousArtistIds]).toEqual(expect.arrayContaining(['root', 'middle', 'leaf']));
    expect(updateLinkedTypeDecision(decisions, 'leaf', 'person', graph)).toBe(decisions);
  });

  test('shares the same graph analysis for repository relationship rows', () => {
    const graph = analyzeArtistTypeConversionGraph(
      ['group', 'person-a', 'person-b', 'solo'],
      [
        { memberArtistId: 'person-a', parentArtistId: 'group' },
        { memberArtistId: 'person-b', parentArtistId: 'group' },
      ],
    );

    expect(graph.suggestedTypes).toEqual({
      group: 'group',
      'person-a': 'person',
      'person-b': 'person',
    });
    expect(graph.linkedIdsByArtistId.solo).toEqual(['solo']);
  });

  test('keeps relationships together and prioritizes groups containing artists with activities', () => {
    const artists = [
      artist('quiet-group'),
      artist('quiet-person', 'quiet-group'),
      artist('active-group'),
      artist('active-person', 'active-group'),
      artist('solo'),
    ];
    const graph = buildArtistTypeConversionGraph(artists);
    const groups = buildArtistTypeConversionGroups(artists, graph, { 'active-person': 3, solo: 1 });

    expect(groups.map((group) => group.id)).toEqual(['active-group', 'solo', 'quiet-group']);
    expect(groups[0].artists.map((item) => item.id)).toEqual(['active-group', 'active-person']);
    expect(groups[0].activityCount).toBe(3);
  });
});

import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Artist } from '../../types/models';
import { ArtistSearchPicker } from '../ArtistSearchPicker';

jest.mock('@gorhom/bottom-sheet', () => {
  const { TextInput } = require('react-native');
  return { BottomSheetTextInput: TextInput };
});

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#6750a4',
      accentBorder: '#9a82db',
      accentPress: '#eee8ff',
      accentSoft: '#eee8ff',
      card: '#fff',
      cardAlt: '#f5f5f5',
      cardMuted: '#fafafa',
      input: '#fff',
      inputBorder: '#ddd',
      placeholder: '#999',
      text: '#222',
      textMuted: '#999',
      textSecondary: '#666',
    },
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));

const existingArtist: Artist = {
  id: 'artist-1',
  name: '已有艺人',
  short_name: null,
  artist_type: null,
  parent_id: null,
  avatar_uri: null,
  background_uri: null,
  background_color: null,
  url: null,
  is_favorite: 0,
  created_at: '2026-08-25T00:00:00.000Z',
};

function renderPicker(searchValue: string, onCreateArtist?: (name: string) => Promise<void>) {
  return create(
    <ArtistSearchPicker
      artists={[existingArtist]}
      isDark={false}
      searchValue={searchValue}
      onSearchChange={jest.fn()}
      onSelectArtist={jest.fn()}
      onRemoveArtist={jest.fn()}
      onCreateArtist={onCreateArtist}
      usePlainScroll
    />,
  );
}

describe('ArtistSearchPicker quick create', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('shows quick create only for a non-empty search with no matches', () => {
    act(() => {
      renderer = renderPicker('  新艺人  ', jest.fn().mockResolvedValue(undefined));
    });

    expect(renderer.root.findByProps({ accessibilityLabel: '新建艺人新艺人' })).toBeTruthy();
    expect(renderer.root.findAllByType(Text).map((node) => node.props.children))
      .toContain('新建艺人「新艺人」');

    act(() => {
      renderer.update(
        <ArtistSearchPicker
          artists={[existingArtist]}
          isDark={false}
          searchValue="已有"
          onSearchChange={jest.fn()}
          onSelectArtist={jest.fn()}
          onRemoveArtist={jest.fn()}
          onCreateArtist={jest.fn().mockResolvedValue(undefined)}
          usePlainScroll
        />,
      );
    });

    expect(renderer.root.findAllByProps({ accessibilityLabel: '新建艺人已有' })).toHaveLength(0);
  });

  test('trims the name, reports pending state, and blocks duplicate presses', async () => {
    let resolveCreate: (() => void) | undefined;
    const createArtist = jest.fn(() => new Promise<void>((resolve) => {
      resolveCreate = resolve;
    }));
    const onPendingChange = jest.fn();

    await act(async () => {
      renderer = create(
        <ArtistSearchPicker
          artists={[]}
          isDark={false}
          searchValue="  新艺人  "
          onSearchChange={jest.fn()}
          onSelectArtist={jest.fn()}
          onRemoveArtist={jest.fn()}
          onCreateArtist={createArtist}
          onCreateArtistPendingChange={onPendingChange}
          usePlainScroll
        />,
      );
    });

    const createButton = renderer.root.findByProps({ accessibilityLabel: '新建艺人新艺人' });
    let createPromise: Promise<void> | undefined;
    act(() => {
      createPromise = createButton.props.onPress();
      createButton.props.onPress();
    });

    expect(createArtist).toHaveBeenCalledTimes(1);
    expect(createArtist).toHaveBeenCalledWith('新艺人');
    expect(onPendingChange).toHaveBeenCalledWith(true);
    expect(renderer.root.findByType(ActivityIndicator)).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: '新建艺人新艺人' }).props.accessibilityState)
      .toEqual({ disabled: true, busy: true });

    await act(async () => {
      resolveCreate?.();
      await createPromise;
    });

    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });
});

describe('ArtistSearchPicker relationship recommendations', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('promotes and explains a name-matched candidate while the search is empty', () => {
    const favoriteGroup: Artist = {
      ...existingArtist,
      id: 'favorite-group',
      name: '收藏团体',
      artist_type: 'group',
      is_favorite: 1,
    };
    const vortexGroup: Artist = {
      ...existingArtist,
      id: 'vortex-group',
      name: '惑星 VORTEX',
      artist_type: 'group',
    };

    act(() => {
      renderer = create(
        <ArtistSearchPicker
          artists={[favoriteGroup, vortexGroup]}
          isDark={false}
          searchValue=""
          onSearchChange={jest.fn()}
          onSelectArtist={jest.fn()}
          onRemoveArtist={jest.fn()}
          recommendationSource={{ name: '海羽Rione-VORTEX' }}
          usePlainScroll
        />,
      );
    });

    const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels.indexOf('惑星 VORTEX')).toBeLessThan(labels.indexOf('收藏团体'));
    expect(labels).toContainEqual(['名称匹配 · ', 'VORTEX']);
  });

  test('manual search replaces recommendation ordering and annotations', () => {
    const vortexGroup: Artist = {
      ...existingArtist,
      id: 'vortex-group',
      name: '惑星 VORTEX',
      artist_type: 'group',
    };
    const searchedGroup: Artist = {
      ...existingArtist,
      id: 'searched-group',
      name: '目标团体',
      artist_type: 'group',
    };

    act(() => {
      renderer = create(
        <ArtistSearchPicker
          artists={[vortexGroup, searchedGroup]}
          isDark={false}
          searchValue="目标"
          onSearchChange={jest.fn()}
          onSelectArtist={jest.fn()}
          onRemoveArtist={jest.fn()}
          recommendationSource={{ name: '海羽Rione-VORTEX' }}
          usePlainScroll
        />,
      );
    });

    const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels).toContain('目标团体');
    expect(labels).not.toContain('惑星 VORTEX');
    expect(labels.some((label) => Array.isArray(label) && label[0] === '名称匹配 · ')).toBe(false);
  });
});

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ThemeColors } from '../../theme/appTheme';
import { ArtistRankingList } from '../ArtistRankingList';

jest.mock('../Oshi', () => ({
  OshiAvatar: (props: object) => {
    const { View: MockView } = jest.requireActual('react-native');
    return <MockView testID="artist-ranking-avatar" {...props} />;
  },
}));

describe('ArtistRankingList', () => {
  let renderer: ReactTestRenderer;
  const colors = new Proxy({}, { get: () => '#000' }) as ThemeColors;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('does not treat the unassociated label as an artist fallback name', () => {
    act(() => {
      renderer = create(
        <ArtistRankingList
          items={[{ id: null, name: '未关联艺人', avatarUri: null, value: 3 }]}
          colors={colors}
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'artist-ranking-avatar' }).props.name).toBeUndefined();
  });
});

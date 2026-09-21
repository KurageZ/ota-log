import React from 'react';
import { FlatList } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ArtistsScreen from '../../../app/artists';
import { FilterSheet } from '../FilterSheet';
import { SearchFilterBar } from '../SearchFilterBar';

const mockDb = {
  artists: {
    findAll: jest.fn().mockResolvedValue([
      { id: 'person', name: '个人艺人', artist_type: 'person', is_favorite: 0 },
      { id: 'group', name: '团体艺人', artist_type: 'group', is_favorite: 0 },
    ]),
    findCurrentGroupSummaries: jest.fn().mockResolvedValue([]),
  },
  cheki: { findDistinctArtistIds: jest.fn().mockResolvedValue(['person']) },
  events: { findDistinctArtistIds: jest.fn().mockResolvedValue(['group']) },
  userConfig: { getConfig: jest.fn().mockResolvedValue({ oshi_artist_id: null }) },
};

jest.mock('../../context/DBContext', () => ({ useDB: () => mockDb }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@expo/ui/community/segmented-control', () => () => null);
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue('true') },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }), isDark: false }),
}));
jest.mock('../../utils/windowMode', () => ({ useWindowMode: () => ({ isWide: false }) }));
jest.mock('../../../app/artists/[id]/index', () => ({ ArtistDetailScreen: () => null }));
jest.mock('../native-add-toolbar', () => ({ NativeAddToolbar: () => null }));
jest.mock('../Oshi', () => ({ OshiAvatar: () => null, OshiBadge: () => null }));
jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../FilterSheet', () => ({ FilterSheet: () => null }));
jest.mock('../SearchFilterBar', () => ({ SearchFilterBar: () => null }));
jest.mock('../FilteredEmptyState', () => ({ FilteredEmptyState: () => null }));
jest.mock('../../utils/haptics', () => ({ hapticError: jest.fn(), hapticFavoriteToggle: jest.fn() }));

describe('artist filter draft', () => {
  let renderer: ReactTestRenderer;
  const sheet = () => renderer.root.findByType(FilterSheet).props;
  const search = () => renderer.root.findByType(SearchFilterBar).props;
  const ids = () => renderer.root.findByType(FlatList).props.data.map((artist: { id: string }) => artist.id);

  beforeEach(async () => {
    await act(async () => { renderer = create(<ArtistsScreen />); });
  });
  afterEach(() => { act(() => renderer.unmount()); });

  test('changes the list only on apply and restores applied values after cancel', () => {
    act(() => search().onOpenFilter());
    act(() => sheet().sections[0].onChange('person'));
    expect(ids()).toEqual(['person', 'group']);
    act(() => sheet().onClose());
    act(() => search().onOpenFilter());
    expect(sheet().sections[0].value).toBeNull();
    act(() => sheet().sections[0].onChange('person'));
    act(() => sheet().onApply());
    expect(ids()).toEqual(['person']);
    expect(sheet().visible).toBe(false);
    act(() => search().onOpenFilter());
    act(() => sheet().sections[0].onChange('group'));
    act(() => sheet().onClose());
    act(() => search().onOpenFilter());
    expect(sheet().sections[0].value).toBe('person');
    expect(ids()).toEqual(['person']);
  });

  test('reset edits only the draft and keeps the page search', () => {
    act(() => search().onOpenFilter());
    act(() => sheet().sections[0].onChange('person'));
    act(() => sheet().onApply());
    act(() => search().onKeywordChange('艺人'));
    act(() => search().onOpenFilter());
    act(() => sheet().onReset());
    expect(ids()).toEqual(['person']);
    act(() => sheet().onClose());
    act(() => search().onOpenFilter());
    expect(sheet().sections[0].value).toBe('person');
    act(() => sheet().onReset());
    act(() => sheet().onApply());
    expect(ids()).toEqual(['person', 'group']);
    expect(search().keyword).toBe('艺人');
  });
});

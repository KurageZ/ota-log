import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { EventChekiQuickAdd } from '../EventChekiQuickAdd';
import { showSaveFailedAlert } from '../../utils/failureAlert';

const mockArtists = [
  { id: 'a', name: 'A', artist_type: 'person', avatar_uri: null },
  { id: 'b', name: 'B', artist_type: 'person', avatar_uri: null },
  { id: 'c', name: 'C', artist_type: 'person', avatar_uri: null },
];
const mockDb = {
  events: { findById: jest.fn(), getArtists: jest.fn() },
  artists: { findAll: jest.fn(), findCurrentMembers: jest.fn() },
  userConfig: { getConfig: jest.fn() },
  chekiRecords: { findLatestUnitPriceByArtistId: jest.fn(), createRecords: jest.fn() },
};
const mockNavigation = { addListener: jest.fn(() => jest.fn()), dispatch: jest.fn() };
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { back: jest.fn() }, useNavigation: () => mockNavigation }));
jest.mock('../../context/DBContext', () => ({ useDB: () => mockDb }));
jest.mock('../../theme/appTheme', () => ({ useAppTheme: () => ({ isDark: false, colors: { text: '#222', screen: '#fff', accent: '#f00' } }) }));
jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../Oshi', () => ({ OshiAvatar: () => null }));
jest.mock('../ArtistSearchPicker', () => ({ ArtistSearchPicker: (props: object) => require('react').createElement('ArtistSearchPicker', props) }));
jest.mock('../native-text-toolbar', () => ({ NativeTextToolbar: (props: object) => require('react').createElement('NativeTextToolbar', props) }));
jest.mock('../../utils/haptics', () => ({ hapticSaveSuccess: jest.fn() }));
jest.mock('../../utils/failureAlert', () => ({ showSaveFailedAlert: jest.fn() }));

describe('EventChekiQuickAdd', () => {
  let renderer: ReactTestRenderer;
  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.events.findById.mockResolvedValue({ id: 'event', title: 'Live', event_date: '2026-10-09' });
    mockDb.events.getArtists.mockResolvedValue(mockArtists.slice(0, 2));
    mockDb.artists.findAll.mockResolvedValue(mockArtists);
    mockDb.artists.findCurrentMembers.mockResolvedValue([]);
    mockDb.userConfig.getConfig.mockResolvedValue({ oshi_artist_id: 'a' });
    mockDb.chekiRecords.findLatestUnitPriceByArtistId.mockImplementation(async (id) => id === 'a' ? 100 : 0);
    mockDb.chekiRecords.createRecords.mockResolvedValue([]);
    await act(async () => { renderer = create(<EventChekiQuickAdd eventId="event" />); });
  });
  afterEach(() => { act(() => renderer.unmount()); });
  const input = (label: string) => renderer.root.findAllByType(TextInput).find((item) => item.props.accessibilityLabel === label)!;
  const toolbar = () => renderer.root.findByType('NativeTextToolbar' as never);

  test('starts at zero, inherits prices, and saves only positive quantities with the selected date', async () => {
    expect(input('A数量').props.value).toBe('0');
    expect(input('A单价').props.value).toBe('100');
    expect(input('B单价').props.value).toBe('0');
    expect(toolbar().props.right.disabled).toBe(true);
    act(() => {
      input('A数量').props.onChangeText('3');
      input('记录日期').props.onChangeText('20261010');
    });
    await act(async () => { await toolbar().props.right.onPress(); });
    expect(mockDb.chekiRecords.createRecords).toHaveBeenCalledWith([
      { artist_id: 'a', event_id: 'event', date: '2026-10-10', quantity: 3, unit_price: 100 },
    ]);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test('expands performing groups to members on the event date and deduplicates direct performers', async () => {
    act(() => renderer.unmount());
    const group = { id: 'group', name: 'Group', artist_type: 'group', avatar_uri: null };
    const secondGroup = { ...group, id: 'second-group', name: 'Second Group' };
    mockDb.events.getArtists.mockResolvedValue([group, secondGroup, mockArtists[0]]);
    mockDb.artists.findAll.mockResolvedValue([...mockArtists, group, secondGroup]);
    mockDb.artists.findCurrentMembers.mockImplementation(async (id) => id === 'group' ? mockArtists.slice(0, 2) : [mockArtists[0]]);
    await act(async () => { renderer = create(<EventChekiQuickAdd eventId="event" />); });
    expect(mockDb.artists.findCurrentMembers).toHaveBeenCalledWith('group', '2026-10-09');
    expect(mockDb.artists.findCurrentMembers).toHaveBeenCalledWith('second-group', '2026-10-09');
    const labels = renderer.root.findAllByType(TextInput).map((item) => item.props.accessibilityLabel);
    expect(labels.filter((label) => label === 'A数量')).toHaveLength(1);
    expect(labels).toContain('B数量');
    expect(labels).not.toContain('Group数量');
    expect(input('A单价').props.value).toBe('100');
    act(() => input('B数量').props.onChangeText('2'));
    await act(async () => { await toolbar().props.right.onPress(); });
    expect(mockDb.chekiRecords.createRecords).toHaveBeenCalledWith([
      { artist_id: 'b', event_id: 'event', date: '2026-10-09', quantity: 2, unit_price: 0 },
    ]);
  });

  test('allows searching for other artists when a performing group has no members', async () => {
    act(() => renderer.unmount());
    mockDb.events.getArtists.mockResolvedValue([{ id: 'group', name: 'Group', artist_type: 'group' }]);
    await act(async () => { renderer = create(<EventChekiQuickAdd eventId="event" />); });
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);
    const add = renderer.root.findAllByType(TouchableOpacity).find((button) => button.props.accessibilityLabel === '添加艺人')!;
    act(() => add.props.onPress());
    const picker = renderer.root.findByType('ArtistSearchPicker' as never);
    expect(picker.props.artists).toEqual(mockArtists);
    await act(async () => { await picker.props.onSelectArtist(mockArtists[2]); });
    expect(input('C数量').props.value).toBe('0');
    expect(input('C单价').props.value).toBe('0');
  });

  test('uses shared person-first ordering for performers and artists added through search', async () => {
    act(() => renderer.unmount());
    const favorite = { ...mockArtists[2], is_favorite: 1 };
    mockDb.events.getArtists.mockResolvedValue([mockArtists[1], mockArtists[0]]);
    mockDb.artists.findAll.mockResolvedValue([mockArtists[1], favorite, mockArtists[0]]);
    await act(async () => { renderer = create(<EventChekiQuickAdd eventId="event" />); });
    const quantityLabels = () => renderer.root.findAllByType(TextInput)
      .map((item) => item.props.accessibilityLabel).filter((label) => label.endsWith('数量'));
    expect(quantityLabels()).toEqual(['A数量', 'B数量']);
    const add = renderer.root.findAllByType(TouchableOpacity).find((button) => button.props.accessibilityLabel === '添加艺人')!;
    act(() => add.props.onPress());
    await act(async () => { await renderer.root.findByType('ArtistSearchPicker' as never).props.onSelectArtist(favorite); });
    expect(quantityLabels()).toEqual(['A数量', 'C数量', 'B数量']);
  });

  test('supports increment and decrement and rejects fractional prices or invalid dates', () => {
    const plus = renderer.root.findAllByType(TouchableOpacity).find((button) => button.props.accessibilityLabel === 'A增加一张')!;
    act(() => plus.props.onPress());
    expect(input('A数量').props.value).toBe('1');
    act(() => input('A单价').props.onChangeText('1.5'));
    expect(toolbar().props.right.disabled).toBe(true);
    act(() => { input('A单价').props.onChangeText('80'); input('记录日期').props.onChangeText('20260230'); });
    expect(toolbar().props.right.disabled).toBe(true);
    act(() => input('记录日期').props.onChangeText('20261009'));
    expect(toolbar().props.right.disabled).toBe(false);
    const minus = renderer.root.findAllByType(TouchableOpacity).find((button) => button.props.accessibilityLabel === 'A减少一张')!;
    act(() => minus.props.onPress());
    expect(input('A数量').props.value).toBe('0');
  });

  test('retains the draft on save failure and permits retry', async () => {
    act(() => input('B数量').props.onChangeText('2'));
    mockDb.chekiRecords.createRecords.mockRejectedValueOnce(new Error('write failed'));
    await act(async () => { await toolbar().props.right.onPress(); });
    expect(showSaveFailedAlert).toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(input('B数量').props.value).toBe('2');
    expect(toolbar().props.right.disabled).toBe(false);
    await act(async () => { await toolbar().props.right.onPress(); });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  test('does not overwrite a manual zero price when an added artist price finishes loading', async () => {
    let resolvePrice!: (price: number) => void;
    mockDb.chekiRecords.findLatestUnitPriceByArtistId.mockReturnValueOnce(new Promise<number>((resolve) => { resolvePrice = resolve; }));
    const add = renderer.root.findAllByType(TouchableOpacity).find((button) => button.props.accessibilityLabel === '添加艺人')!;
    act(() => add.props.onPress());
    const picker = renderer.root.findByType('ArtistSearchPicker' as never);
    act(() => picker.props.onSelectArtist(mockArtists[2]));
    act(() => { input('C数量').props.onChangeText('1'); input('C单价').props.onChangeText('0'); });
    expect(toolbar().props.right.disabled).toBe(true);
    await act(async () => resolvePrice(80));
    expect(input('C单价').props.value).toBe('0');
    expect(toolbar().props.right.disabled).toBe(false);
  });
});

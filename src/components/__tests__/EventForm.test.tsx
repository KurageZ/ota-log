import React from 'react';
import { Text, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { EventForm } from '../EventForm';

const mockDb = {
  artists: {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
  events: {
    findVenueSuggestions: jest.fn().mockResolvedValue([]),
  },
  userConfig: {
    getConfig: jest.fn().mockResolvedValue({ oshi_artist_id: null }),
  },
};

jest.mock('../../context/DBContext', () => ({
  useDB: () => mockDb,
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      accent: '#6750a4',
      accentSoft: '#eee8ff',
      card: '#fff',
      cardAlt: '#f5f5f5',
      danger: '#c00',
      heading: '#111',
      input: '#fff',
      inputBorder: '#ddd',
      onAccent: '#fff',
      placeholder: '#999',
      starActive: '#fc0',
      text: '#222',
      textMuted: '#999',
      textSecondary: '#666',
    },
  }),
}));

jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../ArtistSearchPicker', () => ({ ArtistSearchPicker: () => null }));
jest.mock('../EventStatusChips', () => ({ EventStatusChips: () => null }));

describe('EventForm', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer.unmount());
  });

  test('offers timetable input when creating an activity', async () => {
    await act(async () => {
      renderer = create(<EventForm onSubmit={jest.fn()} />);
      await Promise.resolve();
    });

    const addTimetableButton = renderer.root.findByProps({
      accessibilityLabel: '添加时间表',
    });
    act(() => addTimetableButton.props.onPress());

    const textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);
    const inputPlaceholders = renderer.root
      .findAllByType(TextInput)
      .map((node) => node.props.placeholder);

    expect(textContent).toContain('时间表');
    expect(inputPlaceholders).toEqual(expect.arrayContaining(['条目 1', '开始', '结束', '备注']));
  });
});

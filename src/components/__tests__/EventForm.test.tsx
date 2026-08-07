import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
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
jest.mock('../../utils/uuid', () => {
  let nextId = 0;
  return { generateId: () => `event-form-test-${nextId++}` };
});

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

  test('keeps opening and performance times visible while ending data stays advanced', async () => {
    await act(async () => {
      renderer = create(<EventForm onSubmit={jest.fn()} initialValues={{
        sessions: [{
          key: 'session',
          title: '',
          session_date: '2026-09-12',
          end_date: '',
          open_time: '17:30',
          start_time: '18:30',
          end_time: '20:00',
          city: '',
          venue: '',
          timetable: [],
        }],
      }} />);
      await Promise.resolve();
    });

    let textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toEqual(expect.arrayContaining(['日期', '开场', '开演', '高级信息']));
    expect(textContent).not.toContain('结束时间');
    expect(textContent).not.toContain('开始时间');

    act(() => renderer.root.findByProps({ accessibilityLabel: '高级信息' }).props.onPress());
    textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toEqual(expect.arrayContaining(['结束时间', '结束日期']));
  });

  test('orders the shared create and edit form sections by the activity workflow', async () => {
    await act(async () => {
      renderer = create(<EventForm onSubmit={jest.fn()} />);
      await Promise.resolve();
    });

    const textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity)
      .filter((value): value is string => typeof value === 'string');
    const sectionIndexes = ['活动信息', '时间与地点', '资料图', '出演者', '时间表', '我的记录', '高级信息']
      .map((label) => textContent.indexOf(label));

    expect(sectionIndexes.every((index) => index >= 0)).toBe(true);
    expect(sectionIndexes).toEqual([...sectionIndexes].sort((a, b) => a - b));
  });

  test('uses accessible shared rating controls for completed activities', async () => {
    await act(async () => {
      renderer = create(<EventForm onSubmit={jest.fn()} initialValues={{ status: 'completed' }} />);
      await Promise.resolve();
    });

    expect(renderer.root.findAll((node) => (
      node.type === TouchableOpacity
      && typeof node.props.accessibilityLabel === 'string'
      && /^\d 星$/.test(node.props.accessibilityLabel)
    ))).toHaveLength(5);
  });
});

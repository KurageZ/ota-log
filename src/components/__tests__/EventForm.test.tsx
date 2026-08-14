import React from 'react';
import { Keyboard, Text, TextInput, TouchableOpacity } from 'react-native';
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
      divider: '#ddd',
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

    act(() => renderer.root.findByProps({ accessibilityLabel: '高级' }).props.onPress());
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

  test('keeps ending data collapsed inside the time and location card until expanded', async () => {
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

    expect(textContent).toEqual(expect.arrayContaining(['日期', '开场', '开演', '补充结束时间']));
    expect(textContent.filter((value) => value === '结束时间')).toHaveLength(0);

    act(() => renderer.root.findByProps({ accessibilityLabel: '补充结束时间' }).props.onPress());
    textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toEqual(expect.arrayContaining(['结束时间', '结束日期']));
  });

  test('moves filled time and location into the first session when entering multi-session mode', async () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    await act(async () => {
      renderer = create(<EventForm onSubmit={jest.fn()} initialValues={{
        sessions: [{
          key: 'session',
          title: '',
          session_date: '2026-09-12',
          end_date: '',
          open_time: '17:30',
          start_time: '18:30',
          end_time: '',
          city: '上海',
          venue: 'MAO Livehouse',
          timetable: [],
        }],
      }} />);
      await Promise.resolve();
    });

    let textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toContain('时间与地点');

    act(() => renderer.root.findByProps({ accessibilityLabel: '高级' }).props.onPress());
    textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);
    expect(textContent).toContain('添加其他场次');

    act(() => renderer.root.findByProps({ accessibilityLabel: '添加其他场次' }).props.onPress());
    expect(dismissSpy).toHaveBeenCalled();

    textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).not.toContain('时间与地点');
    const nameInputs = renderer.root
      .findAllByType(TextInput)
      .filter((node) => node.props.placeholder === '如：昼场、夜场');
    expect(nameInputs).toHaveLength(2);
    expect(renderer.root.findAllByType(TextInput).filter((node) => node.props.value === 'MAO Livehouse'))
      .toHaveLength(1);

    const deleteButtons = renderer.root.findAllByProps({ accessibilityLabel: '删除场次' });
    act(() => deleteButtons[1].props.onPress());

    textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toContain('时间与地点');
    expect(renderer.root.findAllByType(TextInput).filter((node) => node.props.placeholder === '如：昼场、夜场'))
      .toHaveLength(0);
    dismissSpy.mockRestore();
  });

  test('shows sessions of an existing multi-session activity in the time and location section with editable names', async () => {
    await act(async () => {
      renderer = create(<EventForm mode="edit" onSubmit={jest.fn()} initialValues={{
        sessions: [
          {
            key: 's1',
            title: 'DAY 1',
            session_date: '2026-09-12',
            end_date: '',
            open_time: '17:30',
            start_time: '18:30',
            end_time: '',
            city: '上海',
            venue: 'MAO Livehouse',
            timetable: [],
          },
          {
            key: 's2',
            title: 'DAY 2',
            session_date: '2026-09-13',
            end_date: '',
            open_time: '',
            start_time: '',
            end_time: '',
            city: '',
            venue: '',
            timetable: [],
          },
        ],
      }} />);
      await Promise.resolve();
    });

    const textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);
    expect(textContent).not.toContain('时间与地点');
    expect(textContent).toContain('场次');
    expect(textContent).toContain('添加场次');
    expect(textContent).toContain('时间表');

    const nameInputs = renderer.root
      .findAllByType(TextInput)
      .filter((node) => node.props.placeholder === '如：昼场、夜场');
    expect(nameInputs).toHaveLength(2);
    expect(nameInputs.map((node) => node.props.value)).toEqual(['DAY 1', 'DAY 2']);

    act(() => nameInputs[0].props.onChangeText('改名后'));
    const updated = renderer.root
      .findAllByType(TextInput)
      .filter((node) => node.props.placeholder === '如：昼场、夜场');
    expect(updated[0].props.value).toBe('改名后');
  });

  test('auto-expands the advanced section on edit when session or timetable content exists', async () => {
    await act(async () => {
      renderer = create(<EventForm mode="edit" onSubmit={jest.fn()} initialValues={{
        sessions: [{
          key: 'empty',
          title: '',
          session_date: '2026-09-12',
          end_date: '',
          open_time: '',
          start_time: '',
          end_time: '',
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

    expect(textContent).toContain('高级');
    expect(textContent).not.toContain('时间表');

    act(() => renderer.unmount());

    await act(async () => {
      renderer = create(<EventForm mode="edit" onSubmit={jest.fn()} initialValues={{
        sessions: [{
          key: 'single-with-timetable',
          title: '',
          session_date: '2026-09-12',
          end_date: '',
          open_time: '',
          start_time: '',
          end_time: '',
          city: '',
          venue: '',
          timetable: [{
            key: 't1',
            title: '开场',
            artist_id: '',
            start_time: '18:00',
            end_time: '18:30',
            notes: '',
          }],
        }],
      }} />);
      await Promise.resolve();
    });

    textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toEqual(expect.arrayContaining(['场次', '时间表']));

    act(() => renderer.unmount());

    await act(async () => {
      renderer = create(<EventForm mode="edit" onSubmit={jest.fn()} initialValues={{
        sessions: [
          {
            key: 's1',
            title: '',
            session_date: '2026-09-12',
            end_date: '',
            open_time: '',
            start_time: '',
            end_time: '',
            city: '',
            venue: '',
            timetable: [{
              key: 't1',
              title: '开场',
              artist_id: '',
              start_time: '18:00',
              end_time: '18:30',
              notes: '',
            }],
          },
          {
            key: 's2',
            title: '',
            session_date: '2026-09-13',
            end_date: '',
            open_time: '',
            start_time: '',
            end_time: '',
            city: '',
            venue: '',
            timetable: [],
          },
        ],
      }} />);
      await Promise.resolve();
    });

    textContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity);

    expect(textContent).toEqual(expect.arrayContaining(['场次', '时间表']));
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
    const sectionIndexes = ['活动信息', '时间与地点', '出演者', '详情', '我的记录', '高级']
      .map((label) => textContent.indexOf(label));

    expect(sectionIndexes.every((index) => index >= 0)).toBe(true);
    expect(sectionIndexes).toEqual([...sectionIndexes].sort((a, b) => a - b));

    act(() => renderer.root.findByProps({ accessibilityLabel: '高级' }).props.onPress());
    const expandedTextContent = renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat(Infinity)
      .filter((value): value is string => typeof value === 'string');
    expect(expandedTextContent).toContain('场次');
    expect(expandedTextContent).toContain('时间表');
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

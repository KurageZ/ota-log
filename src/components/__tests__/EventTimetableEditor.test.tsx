import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Artist } from '../../types/models';
import {
  EventTimetableEditor,
  createEmptyTimetableEntry,
  type EventTimetableEntryDraft,
} from '../EventTimetableEditor';

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      accent: '#6750a4',
      danger: '#c00',
      divider: '#ddd',
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
jest.mock('../Oshi', () => ({ OshiAvatar: () => null }));
jest.mock('../../utils/uuid', () => {
  let nextId = 0;
  return { generateId: () => `timetable-test-${nextId++}` };
});

const artists: Artist[] = [
  {
    id: 'a1',
    name: 'SKE48',
    short_name: null,
    artist_type: 'group',
    parent_id: null,
    avatar_uri: null,
    background_uri: null,
    background_color: null,
    url: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a2',
    name: '松井玲奈',
    short_name: null,
    artist_type: 'person',
    parent_id: null,
    avatar_uri: null,
    background_uri: null,
    background_color: null,
    url: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

function makeEntry(overrides: Partial<ReturnType<typeof createEmptyTimetableEntry>> = {}) {
  return { ...createEmptyTimetableEntry(), ...overrides };
}

function Harness({ initialEntries }: { initialEntries: EventTimetableEntryDraft[] }) {
  const [entries, setEntries] = useState(initialEntries);
  return (
    <EventTimetableEditor
      entries={entries}
      artists={artists}
      onChange={setEntries}
    />
  );
}

describe('EventTimetableEditor', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer.unmount());
  });

  test('matches artists while typing the entry name and associates on tap', async () => {
    await act(async () => {
      renderer = create(<Harness initialEntries={[makeEntry()]} />);
      await Promise.resolve();
    });

    act(() => renderer.root.findByProps({ placeholder: '条目 1' }).props.onChangeText('SKE'));

    const suggestion = renderer.root.findAllByProps({ accessibilityLabel: '关联 SKE48' })[0];
    act(() => suggestion.props.onPress());

    expect(renderer.root.findByProps({ placeholder: '条目 1' }).props.value).toBe('SKE48');
    expect(renderer.root.findAllByProps({ accessibilityLabel: '移除关联艺人' }).length).toBeGreaterThan(0);
  });

  test('keeps the entry unlinked when the suggestion is ignored', async () => {
    await act(async () => {
      renderer = create(<Harness initialEntries={[makeEntry()]} />);
      await Promise.resolve();
    });

    act(() => renderer.root.findByProps({ placeholder: '条目 1' }).props.onChangeText('松井'));

    expect(renderer.root.findAllByProps({ accessibilityLabel: '关联 松井玲奈' }).length).toBeGreaterThan(0);
    expect(renderer.root.findByProps({ placeholder: '条目 1' }).props.value).toBe('松井');
    expect(renderer.root.findAllByProps({ accessibilityLabel: '移除关联艺人' })).toHaveLength(0);
  });

  test('removes the artist association by tapping the avatar', async () => {
    await act(async () => {
      renderer = create(
        <Harness initialEntries={[makeEntry({ title: 'SKE48', artist_id: 'a1' })]} />,
      );
      await Promise.resolve();
    });

    expect(renderer.root.findAllByProps({ accessibilityLabel: '移除关联艺人' }).length).toBeGreaterThan(0);
    act(() => renderer.root.findAllByProps({ accessibilityLabel: '移除关联艺人' })[0].props.onPress());

    expect(renderer.root.findAllByProps({ accessibilityLabel: '移除关联艺人' })).toHaveLength(0);
    expect(renderer.root.findByProps({ placeholder: '条目 1' }).props.value).toBe('SKE48');
  });

  test('uses the second row as the notes input', async () => {
    await act(async () => {
      renderer = create(<Harness initialEntries={[makeEntry()]} />);
      await Promise.resolve();
    });

    act(() => renderer.root.findByProps({ placeholder: '备注' }).props.onChangeText('物贩'));

    expect(renderer.root.findByProps({ placeholder: '备注' }).props.value).toBe('物贩');
  });
});

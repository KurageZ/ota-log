import React from 'react';
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import WidgetSettingsScreen from '../../../app/settings/widget';
import ChekiWidgetGroupEditorScreen from '../../../app/settings/widget/[slot]/index';
import ChekiWidgetGroupSelectScreen from '../../../app/settings/widget/[slot]/select';
import { AppIcon } from '../AppIcon';
import {
  clearChekiWidgetGroupDraft,
  getChekiWidgetGroupDraft,
  setChekiWidgetGroupDraft,
} from '../../utils/chekiWidgetGroupDraftStore';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../utils/safeArea';

const mockDb = {
  chekiRecords: {
    findBrowseItems: jest.fn(),
  },
  chekiWidgetGroups: {
    getEditorState: jest.fn(),
    listManualCandidates: jest.fn(),
    listSummaries: jest.fn(),
    previewSource: jest.fn(),
    reset: jest.fn(),
    save: jest.fn(),
  },
  artists: {
    findAll: jest.fn(),
  },
  events: {
    findAll: jest.fn(),
  },
  userConfig: {
    getConfig: jest.fn(),
  },
};

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  return {
    Stack: {
      Screen: (props: object) => ReactModule.createElement('StackScreen', props),
    },
    router: { back: jest.fn(), push: jest.fn() },
    useNavigation: () => ({ addListener: jest.fn(() => jest.fn()), dispatch: jest.fn() }),
    useLocalSearchParams: () => ({ slot: '1' }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue('true'),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      ReactModule.createElement(View, props, children)
    ),
    useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
  };
});

jest.mock('../../context/DBContext', () => ({
  useDB: () => mockDb,
}));

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: false,
  }),
}));

jest.mock('../ChekiAlbumThumbnail', () => ({
  ChekiGridThumbnail: () => null,
  CHEKI_BARE_THUMBNAIL_RADIUS: 8,
  CHEKI_GRID_GAP: 4,
  useChekiAlbumGridLayout: () => ({ columns: 3, itemWidth: 100, itemHeight: 140 }),
}));

jest.mock('../FilterSheet', () => {
  const ReactModule = require('react');
  return { FilterSheet: (props: object) => ReactModule.createElement('FilterSheet', props) };
});
jest.mock('../ChekiDatePicker', () => ({ ChekiDatePicker: () => null }));
jest.mock('../ChekiWidgetGroupSortableGrid', () => {
  const ReactModule = require('react');
  return {
    ChekiWidgetGroupSortableGrid: (props: object) => (
      ReactModule.createElement('ChekiWidgetGroupSortableGrid', props)
    ),
  };
});
jest.mock('../ChekiWidgetGroupPreviewGrid', () => {
  const ReactModule = require('react');
  return {
    ChekiWidgetGroupPreviewGrid: (props: { header?: React.ReactNode; footer?: React.ReactNode }) => (
      ReactModule.createElement('ChekiWidgetGroupPreviewGrid', props, props.header, props.footer)
    ),
  };
});
jest.mock('../native-text-toolbar', () => {
  const ReactModule = require('react');
  return {
    NativeTextToolbar: (props: object) => ReactModule.createElement('NativeTextToolbar', props),
  };
});

describe('ChekiWidgetGroupEditorScreen', () => {
  let editorRenderer: ReactTestRenderer | undefined;
  let selectRenderer: ReactTestRenderer | undefined;
  let settingsRenderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    clearChekiWidgetGroupDraft(1);
    jest.clearAllMocks();
    mockDb.chekiWidgetGroups.getEditorState.mockResolvedValue({
      slot: 1,
      name: '分组 1',
      source: null,
      resolvedItems: [],
    });
    mockDb.chekiWidgetGroups.previewSource.mockResolvedValue([]);
    mockDb.chekiWidgetGroups.save.mockResolvedValue(undefined);
    mockDb.chekiWidgetGroups.listSummaries.mockResolvedValue([]);
    mockDb.chekiWidgetGroups.listManualCandidates.mockResolvedValue([{ id: 'item-1', uri: 'file:///item-1.jpg' }]);
    mockDb.chekiRecords.findBrowseItems.mockResolvedValue([{
      id: 'item-1',
      record_id: 'record-1',
      sort_order: 0,
      unit_price: 0,
      spec: 'three_inch_portrait',
      is_favorite: 0,
      notes: null,
      created_at: '2026-08-25T00:00:00.000Z',
      updated_at: '2026-08-25T00:00:00.000Z',
      images: [{
        id: 'image-1',
        item_id: 'item-1',
        side: 'front',
        photo_uri: 'file:///item-1.jpg',
        created_at: '2026-08-25T00:00:00.000Z',
        updated_at: '2026-08-25T00:00:00.000Z',
      }],
      record: {
        id: 'record-1',
        event_id: null,
        artist_id: null,
        date: '2026-08-25',
        quantity: 1,
        notes: null,
        created_at: '2026-08-25T00:00:00.000Z',
        updated_at: '2026-08-25T00:00:00.000Z',
      },
    }]);
    mockDb.artists.findAll.mockResolvedValue([]);
    mockDb.events.findAll.mockResolvedValue([]);
    mockDb.userConfig.getConfig.mockResolvedValue({ oshi_artist_id: null });
  });

  afterEach(() => {
    act(() => {
      editorRenderer?.unmount();
      selectRenderer?.unmount();
      settingsRenderer?.unmount();
    });
    clearChekiWidgetGroupDraft(1);
  });

  test('saves photos selected on the child selection screen', async () => {
    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      selectRenderer = create(<ChekiWidgetGroupSelectScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const photoButton = selectRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '选择拍立得',
    );
    expect(photoButton).toBeDefined();
    act(() => photoButton?.props.onPress());

    const selectToolbar = selectRenderer!.root.findByType('NativeTextToolbar' as React.ElementType);
    act(() => selectToolbar.props.right.onPress());

    const toolbar = editorRenderer!.root.findByType('NativeTextToolbar' as React.ElementType);
    await act(async () => {
      toolbar.props.right.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDb.chekiWidgetGroups.save).toHaveBeenCalledWith(1, {
      name: '分组 1',
      source: { type: 'manual', itemIds: ['item-1'] },
    });
  });

  test('lets the stack and virtualized editor list manage safe-area insets', async () => {
    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const safeArea = editorRenderer!.root.findAllByType(View).find(
      (node) => node.props.edges !== undefined,
    );
    expect(safeArea?.props.edges).toEqual(SCROLL_SCREEN_SAFE_AREA_EDGES);

    const previewList = editorRenderer!.root.findByType('ChekiWidgetGroupPreviewGrid' as React.ElementType);
    expect(previewList.props.scrollEnabled).toBe(true);
  });

  test('renders the source selector as icon mode buttons', async () => {
    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const findModeButton = (label: string) => editorRenderer!.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === label);
    const manualButton = findModeButton('手动选择');
    const filterButton = findModeButton('条件筛选');

    expect(manualButton?.props.accessibilityRole).toBe('radio');
    expect(manualButton?.props.accessibilityState).toEqual({ checked: true });
    expect(manualButton?.props.style.minHeight).toBe(56);
    expect(manualButton?.findAllByType(AppIcon).map((node) => node.props.name))
      .toEqual(['album', 'radio']);

    expect(filterButton?.props.accessibilityRole).toBe('radio');
    expect(filterButton?.props.accessibilityState).toEqual({ checked: false });
    expect(filterButton?.props.style.minHeight).toBe(56);
    expect(filterButton?.findAllByType(AppIcon).map((node) => node.props.name))
      .toEqual(['filter', 'radio']);
    expect(editorRenderer!.root.findAllByType(Text).some(
      (node) => node.props.children === '管理拍立得',
    )).toBe(true);
  });

  test('renders filter editing as an action row and explains the selected mode below the source buttons', async () => {
    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const filterButton = editorRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '条件筛选',
    );
    act(() => filterButton?.props.onPress());

    expect(editorRenderer!.root.findAllByType(Text).some(
      (node) => node.props.children === '编辑筛选条件',
    )).toBe(true);
    const helperText = editorRenderer!.root.findAllByType(Text).find(
      (node) => node.props.children === '根据艺人、活动、收藏、日期和规格自动更新符合条件的图片，最多 48 张。',
    );
    expect(helperText).toBeDefined();
  });

  test('shows the complete current filter result directly on the editor page', async () => {
    mockDb.chekiWidgetGroups.getEditorState.mockResolvedValue({
      slot: 1,
      name: '收藏',
      source: {
        type: 'filter',
        rules: { artistIds: [], eventIds: [], favoriteOnly: true, date: null, specs: [] },
      },
      resolvedItems: [],
    });
    mockDb.chekiWidgetGroups.previewSource.mockResolvedValue([{
      id: 'item-1',
      frontPhotoUri: 'file:///item-1.jpg',
      date: '2026-08-25',
      createdAt: '2026-08-25T00:00:00.000Z',
      sortOrder: 0,
    }]);

    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const preview = editorRenderer!.root.findByType('ChekiWidgetGroupPreviewGrid' as React.ElementType);
    expect(preview.props.maxRows).toBeUndefined();
    expect(editorRenderer!.root.findAllByType(Text).some(
      (node) => node.props.children === '查看全部',
    )).toBe(false);
  });

  test('passes the configured oshi artist to the shared artist picker', async () => {
    mockDb.userConfig.getConfig.mockResolvedValue({ oshi_artist_id: 'artist-oshi' });
    mockDb.artists.findAll.mockResolvedValue([
      { id: 'artist-other', name: '其他艺人', artist_type: 'person', is_favorite: 0 },
      { id: 'artist-oshi', name: '单推艺人', artist_type: 'person', is_favorite: 0 },
    ]);
    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });
    const filterMode = editorRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '条件筛选',
    );
    act(() => filterMode?.props.onPress());
    const editAction = editorRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.findAllByType(Text).some((text) => text.props.children === '编辑筛选条件'),
    );
    act(() => editAction?.props.onPress());

    const sheet = editorRenderer!.root.findByType('FilterSheet' as React.ElementType);
    const artistSection = sheet.props.sections.find((section: { key: string }) => section.key === 'artist');
    expect(artistSection.artistSearch.oshiArtistId).toBe('artist-oshi');
    expect(artistSection.artistSearch.typePreference).toBe('person');
  });

  test('applies filter-sheet changes to the page draft only after Apply', async () => {
    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });
    const filterMode = editorRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '条件筛选',
    );
    act(() => filterMode?.props.onPress());
    const editAction = editorRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.findAllByType(Text).some((text) => text.props.children === '编辑筛选条件'),
    );
    act(() => editAction?.props.onPress());

    let sheet = editorRenderer!.root.findByType('FilterSheet' as React.ElementType);
    const otherSection = sheet.props.sections.find((section: { key: string }) => section.key === 'other');
    const favoriteGroup = otherSection.chipGroups.find((group: { key: string }) => group.key === 'favorite');
    act(() => favoriteGroup.onValuesChange(['favorite']));
    expect(mockDb.chekiWidgetGroups.previewSource).not.toHaveBeenCalled();

    sheet = editorRenderer!.root.findByType('FilterSheet' as React.ElementType);
    await act(async () => {
      sheet.props.onApply();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockDb.chekiWidgetGroups.previewSource).toHaveBeenCalledWith(1, {
      type: 'filter',
      rules: { artistIds: [], eventIds: [], favoriteOnly: true, date: null, specs: [] },
    });
  });

  test('automatically protects the bottom of the widget settings list', async () => {
    await act(async () => {
      settingsRenderer = create(<WidgetSettingsScreen />);
      await Promise.resolve();
    });

    const scrollView = settingsRenderer!.root.findByType(ScrollView);
    expect(scrollView.props.contentInsetAdjustmentBehavior).toBe('automatic');
    expect(scrollView.props.contentContainerStyle.paddingBottom).toBe(40);
  });

  test('shows a recoverable widget settings load error and renders accessible menu rows after retry', async () => {
    mockDb.chekiWidgetGroups.listSummaries
      .mockRejectedValueOnce(new Error('数据库暂时不可用'))
      .mockResolvedValueOnce([{
        slot: 1,
        name: '精选',
        sourceType: 'manual',
        displayCount: 2,
      }]);

    await act(async () => {
      settingsRenderer = create(<WidgetSettingsScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(settingsRenderer!.root.findAllByType(Text).some(
      (node) => node.props.children === '无法载入小组件分组',
    )).toBe(true);
    const retry = settingsRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '重新载入小组件分组',
    );
    expect(retry?.props.style.minHeight).toBe(44);

    await act(async () => {
      retry?.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const groupRow = settingsRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '编辑分组 1，精选',
    );
    expect(groupRow?.props.accessibilityRole).toBe('button');
    expect(groupRow?.findAllByType(AppIcon).map((node) => node.props.name))
      .toEqual(['widget', 'disclosure']);
  });

  test('does not add the bottom safe-area inset twice in the selection list', async () => {
    await act(async () => {
      selectRenderer = create(<ChekiWidgetGroupSelectScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const list = selectRenderer!.root.findByType(FlatList);
    expect(list.props.contentInsetAdjustmentBehavior).toBe('automatic');
    expect(list.props.contentContainerStyle.paddingBottom).toBe(24);
  });

  test('selects and cancels all current filter results without affecting selections outside the results', async () => {
    const makeBrowseItem = (id: string, isFavorite: boolean) => ({
      id,
      record_id: `record-${id}`,
      sort_order: 0,
      unit_price: 0,
      spec: 'three_inch_portrait',
      is_favorite: isFavorite ? 1 : 0,
      notes: null,
      created_at: '2026-08-25T00:00:00.000Z',
      updated_at: '2026-08-25T00:00:00.000Z',
      images: [{
        id: `image-${id}`,
        item_id: id,
        side: 'front',
        photo_uri: `file:///${id}.jpg`,
        created_at: '2026-08-25T00:00:00.000Z',
        updated_at: '2026-08-25T00:00:00.000Z',
      }],
      record: {
        id: `record-${id}`,
        event_id: null,
        artist_id: null,
        date: '2026-08-25',
        quantity: 1,
        notes: null,
        created_at: '2026-08-25T00:00:00.000Z',
        updated_at: '2026-08-25T00:00:00.000Z',
      },
    });
    setChekiWidgetGroupDraft({
      slot: 1,
      name: '分组 1',
      source: { type: 'manual', itemIds: ['kept'] },
    });
    mockDb.chekiRecords.findBrowseItems.mockResolvedValue([
      makeBrowseItem('kept', false),
      makeBrowseItem('matching', true),
      makeBrowseItem('other', false),
    ]);

    await act(async () => {
      selectRenderer = create(<ChekiWidgetGroupSelectScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const filterButton = selectRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '筛选',
    );
    act(() => filterButton?.props.onPress());
    let sheet = selectRenderer!.root.findByType('FilterSheet' as React.ElementType);
    const otherSection = sheet.props.sections.find((section: { key: string }) => section.key === 'other');
    const quickGroup = otherSection.chipGroups.find((group: { key: string }) => group.key === 'quick');
    act(() => quickGroup.onValuesChange(['favorite']));
    sheet = selectRenderer!.root.findByType('FilterSheet' as React.ElementType);
    act(() => sheet.props.onApply());

    expect(selectRenderer!.root.findAllByType(Text).some(
      (node) => node.props.children?.join?.('') === '已选 1/48 · 当前 1 张',
    )).toBe(true);

    const selectAllButton = selectRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '全选当前搜索或筛选结果',
    );
    expect(selectAllButton?.props.accessibilityState).toEqual({ disabled: false });
    act(() => selectAllButton?.props.onPress());

    const toolbar = selectRenderer!.root.findByType('NativeTextToolbar' as React.ElementType);
    await act(async () => {
      toolbar.props.right.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getChekiWidgetGroupDraft(1)?.source).toEqual({
      type: 'manual',
      itemIds: ['kept', 'matching'],
    });

    const cancelAllButton = selectRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '取消全选当前搜索或筛选结果',
    );
    expect(cancelAllButton?.props.accessibilityState).toEqual({ disabled: false });
    act(() => cancelAllButton?.props.onPress());
    await act(async () => {
      toolbar.props.right.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getChekiWidgetGroupDraft(1)?.source).toEqual({
      type: 'manual',
      itemIds: ['kept'],
    });
  });

  test('saves the order changed by the grid embedded in the editor', async () => {
    mockDb.chekiWidgetGroups.getEditorState.mockResolvedValue({
      slot: 1,
      name: '分组 1',
      source: { type: 'manual', itemIds: ['item-1', 'item-2'] },
      resolvedItems: [],
    });
    mockDb.chekiWidgetGroups.listManualCandidates.mockResolvedValue([
      { id: 'item-1', uri: 'file:///item-1.jpg' },
      { id: 'item-2', uri: 'file:///item-2.jpg' },
    ]);

    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const grid = editorRenderer!.root.findByType(
      'ChekiWidgetGroupSortableGrid' as React.ElementType,
    );
    expect(grid.props.itemIds).toEqual(['item-1', 'item-2']);
    act(() => grid.props.onChange(['item-2', 'item-1']));

    const toolbar = editorRenderer!.root.findByType('NativeTextToolbar' as React.ElementType);
    await act(async () => {
      toolbar.props.right.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDb.chekiWidgetGroups.save).toHaveBeenCalledWith(1, {
      name: '分组 1',
      source: { type: 'manual', itemIds: ['item-2', 'item-1'] },
    });
  });

  test('shows the manual ordering hint only until it is dismissed', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    mockDb.chekiWidgetGroups.getEditorState.mockResolvedValue({
      slot: 1,
      name: '分组 1',
      source: { type: 'manual', itemIds: ['item-1', 'item-2'] },
      resolvedItems: [],
    });
    mockDb.chekiWidgetGroups.listManualCandidates.mockResolvedValue([
      { id: 'item-1', uri: 'file:///item-1.jpg' },
      { id: 'item-2', uri: 'file:///item-2.jpg' },
    ]);

    await act(async () => {
      editorRenderer = create(<ChekiWidgetGroupEditorScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const hint = '长按照片拖动，即可调整小组件的轮播顺序。';
    expect(editorRenderer!.root.findAllByType(Text).some((node) => node.props.children === hint)).toBe(true);
    const dismissButton = editorRenderer!.root.findAllByType(TouchableOpacity).find(
      (node) => node.props.accessibilityLabel === '知道了',
    );
    act(() => dismissButton?.props.onPress());
    expect(editorRenderer!.root.findAllByType(Text).some((node) => node.props.children === hint)).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});

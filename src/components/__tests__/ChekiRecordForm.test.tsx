import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { ChekiRecordForm } from '../ChekiRecordForm';

const mockDb = {
  rawDb: {},
  artists: { findAll: jest.fn() },
  events: { findAll: jest.fn() },
  userConfig: { getConfig: jest.fn() },
  chekiRecords: {
    findRecordById: jest.fn(),
    updateRecordWithItemChanges: jest.fn(),
    createRecordWithItems: jest.fn(),
    findLatestUnitPriceByArtistId: jest.fn(),
  },
};

const mockNavigation = {
  addListener: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
};

let mockRecord: {
  id: string;
  event_id: string | null;
  artist_id: string | null;
  date: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    record_id: string;
    sort_order: number;
    unit_price: number;
    spec: 'three_inch_portrait';
    is_favorite: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    images: [];
  }>;
};

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn(), replace: jest.fn() },
  useNavigation: () => mockNavigation,
}));

jest.mock('../../context/DBContext', () => ({ useDB: () => mockDb }));
jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: Object.fromEntries([
      'accent', 'accentSofter', 'card', 'cardAlt', 'cardMuted', 'chevron', 'danger',
      'divider', 'heading', 'info', 'infoSoft', 'input', 'inputBorder', 'onAccent',
      'placeholder', 'screen', 'scrim', 'text', 'textMuted', 'textSecondary',
    ].map((key) => [key, '#000'])),
  }),
}));
jest.mock('../AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../ArtistSearchPicker', () => ({ ArtistSearchPicker: () => null }));
jest.mock('../native-text-toolbar', () => ({
  NativeTextToolbar: (props: object) => require('react').createElement('NativeTextToolbar', props),
}));
jest.mock('../../utils/copyToDocuments', () => ({ copyToDocuments: jest.fn() }));
jest.mock('../../utils/localMedia', () => ({ deleteLocalFileIfUnreferenced: jest.fn() }));
jest.mock('../../utils/failureAlert', () => ({
  showCameraPermissionAlert: jest.fn(),
  showArtistCreateFailedAlert: jest.fn(),
  showPhotoLibraryPermissionAlert: jest.fn(),
  showSaveFailedAlert: jest.fn(),
}));
jest.mock('../../utils/haptics', () => ({ hapticSaveSuccess: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('true'),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

describe('ChekiRecordForm', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    mockRecord = {
      id: 'record-1',
      event_id: null,
      artist_id: null,
      date: '2026-08-05',
      quantity: 1,
      notes: null,
      created_at: '2026-08-05T00:00:00.000Z',
      updated_at: '2026-08-05T00:00:00.000Z',
      items: [{
        id: 'item-1',
        record_id: 'record-1',
        sort_order: 0,
        unit_price: 100,
        spec: 'three_inch_portrait',
        is_favorite: 0,
        notes: null,
        created_at: '2026-08-05T00:00:00.000Z',
        updated_at: '2026-08-05T00:00:00.000Z',
        images: [],
      }],
    };
    mockDb.artists.findAll.mockResolvedValue([]);
    mockDb.events.findAll.mockResolvedValue([]);
    mockDb.userConfig.getConfig.mockResolvedValue({ oshi_artist_id: null });
    mockDb.chekiRecords.findRecordById.mockImplementation(async () => mockRecord);
    mockDb.chekiRecords.updateRecordWithItemChanges.mockImplementation(async (
      _id: string,
      _input: object,
      changes: { existingUnitPrice?: number },
    ) => {
      if (changes.existingUnitPrice != null) {
        mockRecord.items.forEach((item) => { item.unit_price = changes.existingUnitPrice!; });
      }
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.clearAllMocks();
  });

  test('persists an edited price for existing items', async () => {
    await act(async () => {
      renderer = create(<ChekiRecordForm mode="edit" recordId="record-1" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const priceInput = renderer.root.findAllByType(TextInput).find((input) => input.props.value === '100');
    expect(priceInput).toBeDefined();

    act(() => priceInput!.props.onChangeText('200'));
    const toolbar = renderer.root.findByType('NativeTextToolbar' as React.ElementType);
    await act(async () => toolbar.props.right.onPress());

    expect(mockDb.chekiRecords.updateRecordWithItemChanges).toHaveBeenCalledWith(
      'record-1',
      expect.objectContaining({ quantity: 1 }),
      expect.objectContaining({ existingUnitPrice: 200 }),
    );
    expect(mockRecord.items[0]?.unit_price).toBe(200);
  });
});

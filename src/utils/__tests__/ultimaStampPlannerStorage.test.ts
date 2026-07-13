import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ULTIMA_STAMP_PLANNER_STORAGE_KEY,
  ULTIMA_STAMP_UPDATE_NOTICE_STORAGE_KEY,
  loadUltimaUpdateNoticeDismissed,
  loadUltimaPlannerState,
  saveUltimaUpdateNoticeDismissed,
  saveUltimaPlannerState,
} from '../ultimaStampPlannerStorage';
import { createDefaultUltimaPlannerState } from '../ultimaStampPlanner';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('ultimaStampPlannerStorage', () => {
  beforeEach(() => {
    mockedAsyncStorage.getItem.mockReset();
    mockedAsyncStorage.setItem.mockReset();
  });

  it('falls back to default state when stored JSON is invalid', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('{bad json');

    const state = await loadUltimaPlannerState();

    expect(state.groups.vortex.target).toBe(50);
    expect(state.eventPlans).toEqual({});
  });

  it('falls back to default state when schema version is unsupported', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ schemaVersion: 99 }));

    const state = await loadUltimaPlannerState();

    expect(state.groups.vortex.target).toBe(50);
    expect(state.eventPlans).toEqual({});
  });

  it('saves planner state as JSON under the planner storage key', async () => {
    const state = createDefaultUltimaPlannerState();

    await saveUltimaPlannerState(state);

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      ULTIMA_STAMP_PLANNER_STORAGE_KEY,
      JSON.stringify(state),
    );
  });

  it('loads whether the update notice was dismissed', async () => {
    mockedAsyncStorage.getItem.mockResolvedValue('true');

    await expect(loadUltimaUpdateNoticeDismissed()).resolves.toBe(true);

    expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(ULTIMA_STAMP_UPDATE_NOTICE_STORAGE_KEY);
  });

  it('shows the update notice by default when loading dismissal state fails', async () => {
    mockedAsyncStorage.getItem.mockRejectedValue(new Error('storage failed'));

    await expect(loadUltimaUpdateNoticeDismissed()).resolves.toBe(false);
  });

  it('saves the dismissed update notice state', async () => {
    await saveUltimaUpdateNoticeDismissed();

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      ULTIMA_STAMP_UPDATE_NOTICE_STORAGE_KEY,
      'true',
    );
  });
});

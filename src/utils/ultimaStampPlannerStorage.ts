import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createDefaultUltimaPlannerState,
  sanitizeUltimaPlannerState,
  type UltimaPlannerState,
} from './ultimaStampPlanner';

export const ULTIMA_STAMP_PLANNER_STORAGE_KEY = 'ota-log.ultima-stamp-planner.v1';
export const ULTIMA_STAMP_UPDATE_NOTICE_STORAGE_KEY = 'ota-log.ultima-stamp-planner.update-notice.v2';

export async function loadUltimaPlannerState(): Promise<UltimaPlannerState> {
  try {
    const raw = await AsyncStorage.getItem(ULTIMA_STAMP_PLANNER_STORAGE_KEY);
    if (!raw) return createDefaultUltimaPlannerState();
    return sanitizeUltimaPlannerState(JSON.parse(raw));
  } catch {
    return createDefaultUltimaPlannerState();
  }
}

export async function saveUltimaPlannerState(state: UltimaPlannerState): Promise<void> {
  await AsyncStorage.setItem(ULTIMA_STAMP_PLANNER_STORAGE_KEY, JSON.stringify(state));
}

export async function loadUltimaUpdateNoticeDismissed(): Promise<boolean> {
  try {
    return await AsyncStorage.getItem(ULTIMA_STAMP_UPDATE_NOTICE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export async function saveUltimaUpdateNoticeDismissed(): Promise<void> {
  await AsyncStorage.setItem(ULTIMA_STAMP_UPDATE_NOTICE_STORAGE_KEY, 'true');
}

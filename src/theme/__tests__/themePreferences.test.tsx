import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppThemeProvider, useThemePreferences } from '../themePreferences';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const key = 'ota-log.theme-preferences.v1';
let preferences: ReturnType<typeof useThemePreferences>;
function Probe() {
  preferences = useThemePreferences();
  return null;
}

let tree: ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  jest.clearAllMocks();
});

test('older preferences default to physical frames and tidy mode persists through remounting', async () => {
  await AsyncStorage.setItem(key, JSON.stringify({ chekiDisplayMode: 'portrait' }));
  await act(async () => { tree = create(<AppThemeProvider><Probe /></AppThemeProvider>); });
  expect(preferences.chekiTidyMode).toBe(false);
  await act(async () => { await preferences.setChekiTidyMode(true); });
  expect(JSON.parse((await AsyncStorage.getItem(key))!).chekiTidyMode).toBe(true);
  await act(async () => { await preferences.setChekiDisplayMode('original'); });
  expect(preferences.chekiTidyMode).toBe(true);
  act(() => tree.unmount());
  await act(async () => { tree = create(<AppThemeProvider><Probe /></AppThemeProvider>); });
  expect(preferences.chekiTidyMode).toBe(true);
  expect(preferences.chekiDisplayMode).toBe('original');
});

test('failed persistence restores the previous layout and reports the error', async () => {
  await AsyncStorage.setItem(key, JSON.stringify({ chekiTidyMode: false }));
  await act(async () => { tree = create(<AppThemeProvider><Probe /></AppThemeProvider>); });
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('write failed'));
  await act(async () => {
    await expect(preferences.setChekiTidyMode(true)).rejects.toThrow('write failed');
  });
  expect(preferences.chekiTidyMode).toBe(false);
});

test('style selection is saved atomically and retains gap filling preference', async () => {
  await AsyncStorage.setItem(key, JSON.stringify({ chekiTidyMode: true, chekiDisplayMode: 'portrait' }));
  await act(async () => { tree = create(<AppThemeProvider><Probe /></AppThemeProvider>); });
  expect(preferences.chekiFillGaps).toBe(true);
  await act(async () => { await preferences.setChekiFillGaps(false); });
  await act(async () => { await preferences.setChekiDisplayStyle('square'); });
  expect(preferences.chekiDisplayMode).toBe('original');
  await act(async () => { await preferences.setChekiDisplayStyle('physical'); });
  expect(preferences.chekiTidyMode).toBe(false);
  expect(preferences.chekiFillGaps).toBe(false);
  await act(async () => { await preferences.setChekiDisplayStyle('justified'); });
  const saved = JSON.parse((await AsyncStorage.getItem(key))!);
  expect(saved).toEqual(expect.objectContaining({ chekiDisplayMode: 'portrait', chekiTidyMode: true, chekiFillGaps: false }));
});

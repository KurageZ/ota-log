import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppAppearance,
  AppCalendarDefaultView,
  AppThemeId,
  DEFAULT_APPEARANCE,
  DEFAULT_CALENDAR_DEFAULT_VIEW,
  DEFAULT_THEME_ID,
} from './config';

const STORAGE_KEY = 'ota-log.theme-preferences.v1';

export interface ThemePreferences {
  themeId: AppThemeId;
  appearance: AppAppearance;
  calendarDefaultView: AppCalendarDefaultView;
}

interface ThemePreferencesContextValue extends ThemePreferences {
  isHydrated: boolean;
  setAppearance: (appearance: AppAppearance) => Promise<void>;
  setCalendarDefaultView: (view: AppCalendarDefaultView) => Promise<void>;
  setThemeId: (themeId: AppThemeId) => Promise<void>;
}

const defaultPreferences: ThemePreferences = {
  themeId: DEFAULT_THEME_ID,
  appearance: DEFAULT_APPEARANCE,
  calendarDefaultView: DEFAULT_CALENDAR_DEFAULT_VIEW,
};

const ThemePreferencesContext = createContext<ThemePreferencesContextValue | null>(null);

function isThemeId(value: unknown): value is AppThemeId {
  return value === 'monoChrome' || value === 'classicViolet' || value === 'nightNeon';
}

function isAppearance(value: unknown): value is AppAppearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isCalendarDefaultView(value: unknown): value is AppCalendarDefaultView {
  return value === 'month' || value === 'timeline';
}

function parseStoredPreferences(rawValue: string | null): ThemePreferences {
  if (!rawValue) return defaultPreferences;

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') return defaultPreferences;

    const rawThemeId = 'themeId' in parsed ? parsed.themeId : undefined;
    const themeId = rawThemeId === 'paperBerry'
      ? 'monoChrome'
      : isThemeId(rawThemeId)
        ? rawThemeId
        : DEFAULT_THEME_ID;
    const appearance = 'appearance' in parsed && isAppearance(parsed.appearance)
      ? parsed.appearance
      : DEFAULT_APPEARANCE;
    const rawCalendarDefaultView = 'calendarDefaultView' in parsed ? parsed.calendarDefaultView : undefined;
    const calendarDefaultView = rawCalendarDefaultView === 'chekiMonth'
      ? 'month'
      : isCalendarDefaultView(rawCalendarDefaultView)
        ? rawCalendarDefaultView
        : DEFAULT_CALENDAR_DEFAULT_VIEW;

    return { themeId, appearance, calendarDefaultView };
  } catch {
    return defaultPreferences;
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ThemePreferences>(defaultPreferences);
  const [isHydrated, setIsHydrated] = useState(false);
  const latestPreferencesRef = useRef(preferences);

  useEffect(() => {
    latestPreferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let isActive = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((rawValue: string | null) => {
        if (!isActive) return;
        const nextPreferences = parseStoredPreferences(rawValue);
        latestPreferencesRef.current = nextPreferences;
        setPreferences(nextPreferences);
      })
      .finally(() => {
        if (isActive) {
          setIsHydrated(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const persistPreferences = useCallback(async (nextPreferences: ThemePreferences) => {
    const previousPreferences = latestPreferencesRef.current;
    latestPreferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
    } catch (error) {
      latestPreferencesRef.current = previousPreferences;
      setPreferences(previousPreferences);
      throw error;
    }
  }, []);

  const setAppearance = useCallback(
    async (appearance: AppAppearance) => persistPreferences({ ...latestPreferencesRef.current, appearance }),
    [persistPreferences],
  );

  const setCalendarDefaultView = useCallback(
    async (calendarDefaultView: AppCalendarDefaultView) => (
      persistPreferences({ ...latestPreferencesRef.current, calendarDefaultView })
    ),
    [persistPreferences],
  );

  const setThemeId = useCallback(
    async (themeId: AppThemeId) => persistPreferences({ ...latestPreferencesRef.current, themeId }),
    [persistPreferences],
  );

  const value = useMemo<ThemePreferencesContextValue>(() => ({
    ...preferences,
    isHydrated,
    setAppearance,
    setCalendarDefaultView,
    setThemeId,
  }), [isHydrated, preferences, setAppearance, setCalendarDefaultView, setThemeId]);

  return (
    <ThemePreferencesContext.Provider value={value}>
      {children}
    </ThemePreferencesContext.Provider>
  );
}

export function useThemePreferences() {
  const value = useContext(ThemePreferencesContext);
  if (!value) {
    throw new Error('useThemePreferences must be used within AppThemeProvider');
  }
  return value;
}

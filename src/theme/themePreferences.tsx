import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppAppearance,
  AppCalendarWeekStart,
  AppThemeId,
  ChekiDisplayMode,
  CalendarDisplayOptions,
  DEFAULT_APPEARANCE,
  DEFAULT_CALENDAR_DISPLAY,
  DEFAULT_CALENDAR_WEEK_START,
  DEFAULT_CHEKI_DISPLAY_MODE,
  DEFAULT_THEME_ID,
} from './config';

const STORAGE_KEY = 'ota-log.theme-preferences.v1';

export interface ThemePreferences {
  themeId: AppThemeId;
  appearance: AppAppearance;
  calendarWeekStart: AppCalendarWeekStart;
  calendarDisplay: CalendarDisplayOptions;
  chekiDisplayMode: ChekiDisplayMode;
}

interface ThemePreferencesContextValue extends ThemePreferences {
  isHydrated: boolean;
  setAppearance: (appearance: AppAppearance) => Promise<void>;
  setCalendarWeekStart: (weekStart: AppCalendarWeekStart) => Promise<void>;
  setCalendarDisplay: (display: CalendarDisplayOptions) => Promise<void>;
  setChekiDisplayMode: (mode: ChekiDisplayMode) => Promise<void>;
  setThemeId: (themeId: AppThemeId) => Promise<void>;
}

const defaultPreferences: ThemePreferences = {
  themeId: DEFAULT_THEME_ID,
  appearance: DEFAULT_APPEARANCE,
  calendarWeekStart: DEFAULT_CALENDAR_WEEK_START,
  calendarDisplay: DEFAULT_CALENDAR_DISPLAY,
  chekiDisplayMode: DEFAULT_CHEKI_DISPLAY_MODE,
};

const ThemePreferencesContext = createContext<ThemePreferencesContextValue | null>(null);

function isThemeId(value: unknown): value is AppThemeId {
  return value === 'monoChrome' || value === 'classicViolet' || value === 'nightNeon';
}

function isAppearance(value: unknown): value is AppAppearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isCalendarWeekStart(value: unknown): value is AppCalendarWeekStart {
  return value === 'sunday' || value === 'monday';
}

function isChekiDisplayMode(value: unknown): value is ChekiDisplayMode {
  return value === 'portrait' || value === 'original';
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
    const rawCalendarWeekStart = 'calendarWeekStart' in parsed ? parsed.calendarWeekStart : undefined;
    const calendarWeekStart = isCalendarWeekStart(rawCalendarWeekStart)
      ? rawCalendarWeekStart
      : DEFAULT_CALENDAR_WEEK_START;
    const rawCalendarDisplay = 'calendarDisplay' in parsed && parsed.calendarDisplay !== null
      && typeof parsed.calendarDisplay === 'object'
      ? parsed.calendarDisplay as Partial<Record<keyof CalendarDisplayOptions, unknown>>
      : {};
    const calendarDisplay: CalendarDisplayOptions = {
      showChekiPhotos: typeof rawCalendarDisplay.showChekiPhotos === 'boolean'
        ? rawCalendarDisplay.showChekiPhotos
        : DEFAULT_CALENDAR_DISPLAY.showChekiPhotos,
      showEvents: typeof rawCalendarDisplay.showEvents === 'boolean'
        ? rawCalendarDisplay.showEvents
        : DEFAULT_CALENDAR_DISPLAY.showEvents,
      showDateItems: typeof rawCalendarDisplay.showDateItems === 'boolean'
        ? rawCalendarDisplay.showDateItems
        : DEFAULT_CALENDAR_DISPLAY.showDateItems,
    };
    const chekiDisplayMode = 'chekiDisplayMode' in parsed && isChekiDisplayMode(parsed.chekiDisplayMode)
      ? parsed.chekiDisplayMode
      : DEFAULT_CHEKI_DISPLAY_MODE;

    return {
      themeId,
      appearance,
      calendarWeekStart,
      calendarDisplay,
      chekiDisplayMode,
    };
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

  const setCalendarWeekStart = useCallback(
    async (calendarWeekStart: AppCalendarWeekStart) => (
      persistPreferences({ ...latestPreferencesRef.current, calendarWeekStart })
    ),
    [persistPreferences],
  );

  const setCalendarDisplay = useCallback(
    async (calendarDisplay: CalendarDisplayOptions) => (
      persistPreferences({ ...latestPreferencesRef.current, calendarDisplay })
    ),
    [persistPreferences],
  );

  const setChekiDisplayMode = useCallback(
    async (chekiDisplayMode: ChekiDisplayMode) => (
      persistPreferences({ ...latestPreferencesRef.current, chekiDisplayMode })
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
    setCalendarWeekStart,
    setCalendarDisplay,
    setChekiDisplayMode,
    setThemeId,
  }), [
    isHydrated,
    preferences,
    setAppearance,
    setCalendarWeekStart,
    setCalendarDisplay,
    setChekiDisplayMode,
    setThemeId,
  ]);

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

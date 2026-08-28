import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDB } from '../context/DBContext';
import { useAppTheme } from '../theme/appTheme';
import { initializeCalendarWidget } from './initializeCalendarWidget';

export function CalendarWidgetSync() {
  const { artists, cheki, chekiRecords } = useDB();
  const { calendarWeekStart, isHydrated, themeId } = useAppTheme();

  useEffect(() => {
    if (!isHydrated) return undefined;

    let disposed = false;
    let running: Promise<void> | null = null;
    let queued = false;
    const requestSync = () => {
      if (disposed) return;
      if (running) {
        queued = true;
        return;
      }
      running = initializeCalendarWidget(cheki, themeId, calendarWeekStart)
        .catch((error: unknown) => {
          console.warn('Failed to synchronize the calendar widget', error);
        })
        .finally(() => {
          running = null;
          if (queued) {
            queued = false;
            requestSync();
          }
        });
    };

    requestSync();
    const subscriptions = [
      artists.subscribeToChanges(requestSync),
      cheki.subscribeToChanges(requestSync),
      chekiRecords.subscribeToChanges(requestSync),
    ];
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync();
    });

    return () => {
      disposed = true;
      for (const unsubscribe of subscriptions) unsubscribe();
      appStateSubscription.remove();
    };
  }, [artists, calendarWeekStart, cheki, chekiRecords, isHydrated, themeId]);

  return null;
}

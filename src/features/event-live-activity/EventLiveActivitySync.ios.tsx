import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useDB } from '../../context/DBContext';
import { useAppTheme } from '../../theme/appTheme';
import { reconcileEventLiveActivity } from './manager';
import { createEventLiveActivityPalettes } from './palette';

export function EventLiveActivitySync() {
  const repositories = useDB();
  const { isHydrated, themeId } = useAppTheme();
  const palettes = useMemo(() => createEventLiveActivityPalettes(themeId), [themeId]);

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
      running = reconcileEventLiveActivity(repositories, palettes).finally(() => {
        running = null;
        if (queued) {
          queued = false;
          requestSync();
        }
      });
    };

    requestSync();
    const unsubscribe = repositories.events.subscribeToChanges(requestSync);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync();
    });

    return () => {
      disposed = true;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [isHydrated, palettes, repositories]);

  return null;
}

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDB } from '../context/DBContext';
import { initializeNextEventWidget } from './initializeNextEventWidget';

export function NextEventWidgetSync() {
  const { events, photos } = useDB();

  useEffect(() => {
    let disposed = false;
    let running: Promise<void> | null = null;
    let queued = false;
    const requestSync = () => {
      if (disposed) return;
      if (running) { queued = true; return; }
      running = initializeNextEventWidget(events, photos).catch((error: unknown) => {
        console.warn('Failed to synchronize the next event widget', error);
      }).finally(() => {
        running = null;
        if (queued) { queued = false; requestSync(); }
      });
    };
    requestSync();
    const unsubscribe = events.subscribeToChanges(requestSync);
    const unsubscribeFromPhotos = photos.subscribeToChanges(requestSync);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync();
    });
    return () => { disposed = true; unsubscribe(); unsubscribeFromPhotos(); appStateSubscription.remove(); };
  }, [events, photos]);

  return null;
}

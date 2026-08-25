import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDB } from '../context/DBContext';
import { initializeChekiPhotoWidget } from './initializeChekiPhotoWidget';

export function ChekiPhotoWidgetSync() {
  const { cheki, chekiRecords, chekiWidgetGroups, artists, events } = useDB();

  useEffect(() => {
    let disposed = false;
    let syncInProgress: Promise<void> | null = null;
    let syncAgain = false;

    const requestSync = () => {
      if (disposed) return;
      if (syncInProgress) {
        syncAgain = true;
        return;
      }

      syncInProgress = initializeChekiPhotoWidget(chekiWidgetGroups)
        .catch((error: unknown) => {
          console.warn('Failed to synchronize the cheki photo widget', error);
        })
        .finally(() => {
          syncInProgress = null;
          if (syncAgain) {
            syncAgain = false;
            requestSync();
          }
        });
    };

    requestSync();
    const unsubscribeFromChekiChanges = cheki.subscribeToChanges(requestSync);
    const unsubscribeFromRecordChanges = chekiRecords.subscribeToChanges(requestSync);
    const unsubscribeFromGroupChanges = chekiWidgetGroups.subscribeToChanges(requestSync);
    const unsubscribeFromArtistChanges = artists.subscribeToChanges(requestSync);
    const unsubscribeFromEventChanges = events.subscribeToChanges(requestSync);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync();
    });

    return () => {
      disposed = true;
      unsubscribeFromChekiChanges();
      unsubscribeFromRecordChanges();
      unsubscribeFromGroupChanges();
      unsubscribeFromArtistChanges();
      unsubscribeFromEventChanges();
      appStateSubscription.remove();
    };
  }, [artists, cheki, chekiRecords, chekiWidgetGroups, events]);

  return null;
}

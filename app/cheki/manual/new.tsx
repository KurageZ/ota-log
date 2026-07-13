import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RedirectManualChekiNewScreen() {
  const { artist_id, event_id, date } = useLocalSearchParams<{
    artist_id?: string;
    event_id?: string;
    date?: string;
  }>();

  return (
    <Redirect
      href={{
        pathname: '/cheki/new',
        params: {
          artist_id,
          event_id,
          date,
          mode: 'manual',
        },
      }}
    />
  );
}

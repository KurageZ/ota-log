import { useLocalSearchParams } from 'expo-router';
import { ChekiRecordForm } from '../../src/components/ChekiRecordForm';

export default function NewChekiRecordScreen() {
  const {
    artist_id: artistId,
    event_id: eventId,
    date,
  } = useLocalSearchParams<{
    artist_id?: string;
    event_id?: string;
    date?: string;
  }>();

  return (
    <ChekiRecordForm
      mode="create"
      initialArtistId={artistId}
      initialEventId={eventId}
      initialDate={date}
    />
  );
}

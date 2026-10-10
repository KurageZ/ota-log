import { useLocalSearchParams } from 'expo-router';
import { EventChekiQuickAdd } from '../../src/components/EventChekiQuickAdd';

export default function EventChekiQuickAddScreen() {
  const { event_id: eventId } = useLocalSearchParams<{ event_id: string }>();
  return <EventChekiQuickAdd eventId={eventId} />;
}

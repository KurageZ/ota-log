import { useLocalSearchParams } from 'expo-router';
import { ChekiRecordForm } from '../../../../src/components/ChekiRecordForm';

export default function EditChekiRecordScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();

  return (
    <ChekiRecordForm
      mode="edit"
      recordId={id}
      focusImages={focus === 'images'}
    />
  );
}

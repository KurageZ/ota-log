import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RedirectManualChekiEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <Redirect href={`/cheki/records/${id}/edit`} />;
}

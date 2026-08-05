import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RedirectLegacyChekiEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <Redirect href={`/cheki/items/${id}/edit`} />;
}

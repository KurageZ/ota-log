import AsyncStorage from '@react-native-async-storage/async-storage';

const SORT_TUTORIAL_DISMISSED_KEY = '@ota_log:cheki_widget_group_sort_tutorial_dismissed:v1';

export async function hasDismissedChekiWidgetSortTutorial(): Promise<boolean> {
  try {
    return await AsyncStorage.getItem(SORT_TUTORIAL_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export async function dismissChekiWidgetSortTutorial(): Promise<void> {
  try {
    await AsyncStorage.setItem(SORT_TUTORIAL_DISMISSED_KEY, 'true');
  } catch {
    // This hint is non-critical; keep editing available if preference storage fails.
  }
}

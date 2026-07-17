import type { WidgetTimelineEntry } from 'expo-widgets';
import type { ChekiPhotoWidgetProps } from './ChekiPhotoWidget';

export const CHEKI_WIDGET_ROTATION_INTERVAL_MS = 30 * 60 * 1000;
export const CHEKI_WIDGET_TIMELINE_ENTRY_COUNT = 48;

export function createChekiPhotoWidgetTimeline(
  imageUris: string[],
  startTime = Date.now(),
): WidgetTimelineEntry<ChekiPhotoWidgetProps>[] {
  if (imageUris.length === 0) return [];

  return Array.from({ length: CHEKI_WIDGET_TIMELINE_ENTRY_COUNT }, (_, index) => {
    const currentIndex = index % imageUris.length;
    const props: ChekiPhotoWidgetProps = { imageUri: imageUris[currentIndex] };

    if (imageUris.length === 2) {
      props.trailingImageUri = imageUris[(currentIndex + 1) % imageUris.length];
    } else if (imageUris.length >= 3) {
      props.leadingImageUri = imageUris[(currentIndex + 1) % imageUris.length];
      props.trailingImageUri = imageUris[(currentIndex + 2) % imageUris.length];
    }

    return {
      date: new Date(startTime + index * CHEKI_WIDGET_ROTATION_INTERVAL_MS),
      props,
    };
  });
}

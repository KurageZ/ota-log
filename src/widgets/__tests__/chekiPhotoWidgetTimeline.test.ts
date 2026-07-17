import {
  CHEKI_WIDGET_ROTATION_INTERVAL_MS,
  CHEKI_WIDGET_TIMELINE_ENTRY_COUNT,
  createChekiPhotoWidgetTimeline,
} from '../chekiPhotoWidgetTimeline';

describe('createChekiPhotoWidgetTimeline', () => {
  const startTime = 0;

  test('returns no entries when there are no photos', () => {
    expect(createChekiPhotoWidgetTimeline([], startTime)).toEqual([]);
  });

  test('rotates through every photo in repository order', () => {
    const imageUris = ['file:///newest.jpg', 'file:///middle.jpg', 'file:///oldest.jpg'];
    const timeline = createChekiPhotoWidgetTimeline(imageUris, startTime);

    expect(timeline.slice(0, 4).map((entry) => entry.props.imageUri)).toEqual([
      'file:///newest.jpg',
      'file:///middle.jpg',
      'file:///oldest.jpg',
      'file:///newest.jpg',
    ]);
    expect(timeline[1].date.getTime() - timeline[0].date.getTime()).toBe(
      CHEKI_WIDGET_ROTATION_INTERVAL_MS,
    );
    expect(timeline[0].props).toEqual({
      leadingImageUri: 'file:///middle.jpg',
      imageUri: 'file:///newest.jpg',
      trailingImageUri: 'file:///oldest.jpg',
    });
    expect(timeline[1].props).toEqual({
      leadingImageUri: 'file:///oldest.jpg',
      imageUri: 'file:///middle.jpg',
      trailingImageUri: 'file:///newest.jpg',
    });
  });

  test('centers one or two available photos without duplicating a third slot', () => {
    const singlePhotoTimeline = createChekiPhotoWidgetTimeline(['file:///only.jpg'], startTime);
    const twoPhotoTimeline = createChekiPhotoWidgetTimeline(
      ['file:///first.jpg', 'file:///second.jpg'],
      startTime,
    );

    expect(singlePhotoTimeline[0].props).toEqual({ imageUri: 'file:///only.jpg' });
    expect(twoPhotoTimeline[0].props).toEqual({
      imageUri: 'file:///first.jpg',
      trailingImageUri: 'file:///second.jpg',
    });
  });

  test('bounds large photo libraries to a 24-hour rolling window', () => {
    const imageUris = Array.from({ length: 400 }, (_, index) => `file:///cheki-${index}.jpg`);
    const timeline = createChekiPhotoWidgetTimeline(imageUris, startTime);
    const lastEntryIndex = CHEKI_WIDGET_TIMELINE_ENTRY_COUNT - 1;

    expect(timeline).toHaveLength(CHEKI_WIDGET_TIMELINE_ENTRY_COUNT);
    expect(timeline[0].props.imageUri).toBe('file:///cheki-0.jpg');
    expect(timeline[lastEntryIndex].props.imageUri).toBe(
      `file:///cheki-${lastEntryIndex}.jpg`,
    );
  });

  test('starts a refreshed timeline from the newest photo regardless of wall-clock time', () => {
    const imageUris = Array.from({ length: 400 }, (_, index) => `file:///cheki-${index}.jpg`);
    const nextWindowStart =
      CHEKI_WIDGET_TIMELINE_ENTRY_COUNT * CHEKI_WIDGET_ROTATION_INTERVAL_MS;
    const timeline = createChekiPhotoWidgetTimeline(imageUris, nextWindowStart);

    expect(timeline[0].props.imageUri).toBe('file:///cheki-0.jpg');
    expect(timeline[CHEKI_WIDGET_TIMELINE_ENTRY_COUNT - 1].props.imageUri).toBe(
      `file:///cheki-${CHEKI_WIDGET_TIMELINE_ENTRY_COUNT - 1}.jpg`,
    );
  });
});

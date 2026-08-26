import {
  getRotatedChekiImageFrame,
  isLandscapeChekiSpec,
  isLandscapeImageSize,
  resolveChekiLandscapeRotation,
} from '../chekiThumbnailRotation';

describe('chekiThumbnailRotation', () => {
  test('only treats controlled three-inch and five-inch landscape specs as landscape', () => {
    expect(isLandscapeChekiSpec('three_inch_landscape')).toBe(true);
    expect(isLandscapeChekiSpec('five_inch_landscape')).toBe(true);
    expect(isLandscapeChekiSpec('three_inch_portrait')).toBe(false);
    expect(isLandscapeChekiSpec('five_inch_portrait')).toBe(false);
    expect(isLandscapeChekiSpec('square')).toBe(false);
    expect(isLandscapeChekiSpec(undefined)).toBe(false);
  });

  test('requires a finite image size with width greater than height', () => {
    expect(isLandscapeImageSize(1080, 720)).toBe(true);
    expect(isLandscapeImageSize(720, 1080)).toBe(false);
    expect(isLandscapeImageSize(800, 800)).toBe(false);
    expect(isLandscapeImageSize(Number.NaN, 720)).toBe(false);
    expect(isLandscapeImageSize(1080, 0)).toBe(false);
  });

  test('rotates only a landscape image with a landscape spec in portrait display mode', () => {
    const base = {
      displayMode: 'portrait' as const,
      preference: 'clockwise' as const,
      spec: 'three_inch_landscape' as const,
      isImageLandscape: true,
    };

    expect(resolveChekiLandscapeRotation(base)).toBe('clockwise');
    expect(resolveChekiLandscapeRotation({ ...base, spec: 'five_inch_landscape' })).toBe('clockwise');
    expect(resolveChekiLandscapeRotation({ ...base, displayMode: 'original' })).toBe('original');
    expect(resolveChekiLandscapeRotation({ ...base, preference: 'original' })).toBe('original');
    expect(resolveChekiLandscapeRotation({ ...base, spec: 'three_inch_portrait' })).toBe('original');
    expect(resolveChekiLandscapeRotation({ ...base, isImageLandscape: false })).toBe('original');
  });

  test('swaps the image frame dimensions and resolves the requested direction', () => {
    expect(getRotatedChekiImageFrame(90, 144, 'clockwise')).toEqual({
      width: 144,
      height: 90,
      rotate: '90deg',
    });
    expect(getRotatedChekiImageFrame(90, 144, 'counterclockwise')).toEqual({
      width: 144,
      height: 90,
      rotate: '-90deg',
    });
  });
});

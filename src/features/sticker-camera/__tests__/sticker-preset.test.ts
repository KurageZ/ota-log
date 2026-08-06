import {
  getPreviewMatchedResizeHeight,
  resolveStickerLayout,
} from '../sticker-preset';

describe('sticker camera preset', () => {
  test('does not crop a photo that Expo Camera already matched to the iOS preview', () => {
    expect(getPreviewMatchedResizeHeight(4032, 3024)).toBe(1800);
    expect(getPreviewMatchedResizeHeight(3024, 4032)).toBe(2400);
    expect(getPreviewMatchedResizeHeight(900, 1200)).toBe(1200);
  });

  test.each([
    [1200, 1600],
    [1600, 1200],
    [2000, 2000],
  ])('keeps a %d by %d sticker inside the lower-right preset area', (imageWidth, imageHeight) => {
    const layout = resolveStickerLayout(900, 1200, imageWidth, imageHeight);

    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.y).toBeGreaterThanOrEqual(0);
    expect(layout.x + layout.width).toBeLessThanOrEqual(900);
    expect(layout.y + layout.height).toBeLessThanOrEqual(1200);
    expect(layout.rotationDegrees).toBe(-7);
  });

  test('uses the enlarged borderless preset for a portrait sticker', () => {
    const layout = resolveStickerLayout(900, 1200, 900, 1200);

    expect(layout.width).toBeCloseTo(342);
  });

  test('returns finite layout values for incomplete image metadata', () => {
    const values = Object.values(resolveStickerLayout(900, 1200, 0, Number.NaN));
    expect(values.every(Number.isFinite)).toBe(true);
  });
});

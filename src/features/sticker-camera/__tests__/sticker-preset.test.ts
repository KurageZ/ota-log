import {
  getPreviewMatchedResizeHeight,
  resolveStickerLayout,
  resolveStickerStackLayouts,
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
  ])('keeps a %d by %d single sticker inside the lower-left preset area', (imageWidth, imageHeight) => {
    const layout = resolveStickerLayout(900, 1200, imageWidth, imageHeight);

    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.y).toBeGreaterThanOrEqual(0);
    expect(layout.x + layout.width).toBeLessThanOrEqual(900);
    expect(layout.y + layout.height).toBeLessThanOrEqual(1200);
    expect(layout.x).toBeCloseTo(49.5);
    expect(layout.rotationDegrees).toBe(-6);
  });

  test('uses the enlarged single-sticker preset for a portrait image', () => {
    const layout = resolveStickerLayout(900, 1200, 900, 1200);

    expect(layout.width).toBeCloseTo(324);
  });

  test('returns finite layout values for incomplete image metadata', () => {
    const values = Object.values(resolveStickerLayout(900, 1200, 0, Number.NaN));
    expect(values.every(Number.isFinite)).toBe(true);
  });

  test.each([5, 9])('creates a stable, ordered fan that fills the canvas width for %d stickers', (count) => {
    const sources = Array.from({ length: count }, () => ({ width: 900, height: 1200 }));
    const layouts = resolveStickerStackLayouts(900, 1200, sources);

    expect(layouts).toHaveLength(count);
    expect(layouts[0].rotationDegrees).toBeCloseTo(-layouts[count - 1].rotationDegrees, 6);
    expect(layouts.map(({ x }) => x)).toEqual([...layouts.map(({ x }) => x)].sort((a, b) => a - b));
    // 最外侧贴纸的外沿贴近左右边距，尽量铺满画面宽度。
    expect(layouts[0].x).toBeCloseTo(49.5, 1);
    expect(layouts[count - 1].x + layouts[count - 1].width).toBeCloseTo(850.5, 1);
    layouts.forEach((layout) => {
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.width).toBeLessThanOrEqual(900);
      expect(layout.y + layout.height).toBeLessThanOrEqual(1200);
    });
  });

  test('keeps two stickers closer together near the center instead of filling the width', () => {
    const sources = [
      { width: 900, height: 1200 },
      { width: 900, height: 1200 },
    ];
    const layouts = resolveStickerStackLayouts(900, 1200, sources);

    expect(layouts).toHaveLength(2);
    expect(layouts[0].rotationDegrees).toBeCloseTo(-layouts[1].rotationDegrees, 6);
    const innerGap = layouts[1].x - (layouts[0].x + layouts[0].width);
    expect(innerGap).toBeCloseTo(60.3, 1);
    layouts.forEach((layout) => {
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.y).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.width).toBeLessThanOrEqual(900);
      expect(layout.y + layout.height).toBeLessThanOrEqual(1200);
    });
  });

  test('keeps the card centers on a symmetric arc with the middle card highest', () => {
    const sources = Array.from({ length: 9 }, () => ({ width: 900, height: 1200 }));
    const layouts = resolveStickerStackLayouts(900, 1200, sources);

    // 中间中心最高（y 最小），两侧沿圆弧对称下沉。
    expect(layouts[4].y).toBeLessThan(layouts[0].y);
    expect(layouts[4].y).toBeLessThan(layouts[8].y);
    expect(layouts[0].y).toBeCloseTo(layouts[8].y, 6);
    expect(layouts[1].y).toBeCloseTo(layouts[7].y, 6);
    expect(layouts[2].y).toBeCloseTo(layouts[6].y, 6);
    expect(layouts[3].y).toBeCloseTo(layouts[5].y, 6);
  });
});

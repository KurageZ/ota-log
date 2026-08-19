import {
  MAX_CROP_SCALE,
  MIN_CROP_SCALE,
  clampCropTransform,
  getCoverDisplaySize,
  getCropRect,
} from '../cropGeometry';

const CONTAINER = { width: 320, height: 400 }; // 4:5 background frame

describe('getCoverDisplaySize', () => {
  test('keeps the container size when the image aspect matches', () => {
    expect(getCoverDisplaySize(320, 400, 1200, 1500)).toEqual({ width: 320, height: 400 });
  });

  test('sizes a wide image so it covers the full frame height', () => {
    expect(getCoverDisplaySize(320, 400, 2000, 1000)).toEqual({ width: 800, height: 400 });
  });

  test('sizes a tall image so it covers the full frame width', () => {
    expect(getCoverDisplaySize(320, 400, 500, 1000)).toEqual({ width: 320, height: 640 });
  });

  test('falls back to the container size for invalid dimensions', () => {
    expect(getCoverDisplaySize(320, 400, 0, 1000)).toEqual({ width: 320, height: 400 });
  });
});

describe('clampCropTransform', () => {
  test('clamps scale to the supported range', () => {
    const tooSmall = clampCropTransform(320, 400, 2000, 1000, 0.5, 0, 0);
    expect(tooSmall.scale).toBe(MIN_CROP_SCALE);

    const tooLarge = clampCropTransform(320, 400, 2000, 1000, 12, 0, 0);
    expect(tooLarge.scale).toBe(MAX_CROP_SCALE);
  });

  test('clamps horizontal translation for a wide image', () => {
    const result = clampCropTransform(320, 400, 2000, 1000, 1, 500, 0);
    expect(result.translateX).toBe(240); // (800 - 320) / 2
    expect(result.translateY).toBe(0);
  });

  test('clamps vertical translation for a tall image', () => {
    const result = clampCropTransform(320, 400, 500, 1000, 1, 0, -300);
    expect(result.translateX).toBe(0);
    expect(result.translateY).toBe(-120); // -(640 - 400) / 2
  });

  test('allows translation inside the bounds', () => {
    const result = clampCropTransform(320, 400, 500, 1000, 1, 100, -30);
    expect(result.translateX).toBe(0);
    expect(result.translateY).toBe(-30);
  });
});

describe('getCropRect', () => {
  test('center crops a wide image to the frame aspect', () => {
    const rect = getCropRect(320, 400, 2000, 1000, 1, 0, 0);
    expect(rect).toEqual({ originX: 600, originY: 0, width: 800, height: 1000 });
    expect(rect.width / rect.height).toBeCloseTo(0.8, 5);
  });

  test('center crops a tall image to the frame aspect', () => {
    const rect = getCropRect(320, 400, 500, 1000, 1, 0, 0);
    expect(rect).toEqual({ originX: 0, originY: 188, width: 500, height: 625 });
    expect(rect.width / rect.height).toBeCloseTo(0.8, 5);
  });

  test('shows the left edge when translated to the maximum right', () => {
    const rect = getCropRect(320, 400, 2000, 1000, 1, 240, 0);
    expect(rect.originX).toBe(0);
    expect(rect.width).toBe(800);
  });

  test('shows the right edge when translated to the maximum left', () => {
    const rect = getCropRect(320, 400, 2000, 1000, 1, -240, 0);
    expect(rect.originX).toBe(1200);
    expect(rect.originX + rect.width).toBe(2000);
  });

  test('shows the bottom edge when translated to the maximum top', () => {
    const rect = getCropRect(320, 400, 500, 1000, 1, 0, -120);
    expect(rect.originY).toBe(375);
    expect(rect.originY + rect.height).toBe(1000);
  });

  test('zooming in crops a smaller region at the same aspect', () => {
    const rect = getCropRect(320, 400, 2000, 1000, 2, 100, 0);
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(500);
    expect(rect.width / rect.height).toBeCloseTo(0.8, 5);
    expect(rect.originX).toBeGreaterThanOrEqual(0);
    expect(rect.originX + rect.width).toBeLessThanOrEqual(2000);
  });

  test('always keeps the rect inside the image after rounding', () => {
    for (const [scale, tx, ty] of [
      [1.37, 83, -21],
      [2.9, -400, 100],
      [5, 9999, 9999],
      [0.1, -9999, -9999],
    ] as const) {
      const rect = getCropRect(320, 400, 1920, 1080, scale, tx, ty);
      expect(rect.originX).toBeGreaterThanOrEqual(0);
      expect(rect.originY).toBeGreaterThanOrEqual(0);
      expect(rect.originX + rect.width).toBeLessThanOrEqual(1920);
      expect(rect.originY + rect.height).toBeLessThanOrEqual(1080);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  test('returns the full image for invalid dimensions', () => {
    expect(getCropRect(320, 400, 0, 0, 1, 0, 0)).toEqual({ originX: 0, originY: 0, width: 0, height: 0 });
  });
});

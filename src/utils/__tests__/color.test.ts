import { hslToRgb, parseColor, rgbToHsl, toHex, withAlpha } from '../color';

describe('color', () => {
  test('parses supported theme color formats', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseColor('#10203080')).toEqual({ r: 16, g: 32, b: 48 });
    expect(parseColor('rgba(12, 34, 56, 0.5)')).toEqual({ r: 12, g: 34, b: 56 });
    expect(parseColor('not-a-color')).toBeNull();
    expect(withAlpha('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.5)');
  });

  test('round-trips RGB through HSL without visible drift', () => {
    const source = { r: 219, g: 39, b: 119 };
    expect(hslToRgb(rgbToHsl(source))).toEqual(source);
    expect(toHex(source)).toBe('#db2777');
  });
});

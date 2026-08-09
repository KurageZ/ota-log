import { buildPosterParagraphStyle } from '../poster-paragraph-style';

function validateNativeStringProperties(style: Record<string, unknown>): void {
  for (const key of ['ellipsis']) {
    if (key in style && typeof style[key] !== 'string') {
      throw new Error(`Value is ${String(style[key])}, expected a String`);
    }
  }
}

describe('poster paragraph native props', () => {
  test('omits optional string properties instead of passing undefined to Skia', () => {
    const style = buildPosterParagraphStyle(undefined, 0);
    expect(() => validateNativeStringProperties(style as Record<string, unknown>)).not.toThrow();
  });
});

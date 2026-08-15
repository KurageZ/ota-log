import {
  inferChekiSpecFromImageSize,
  DEFAULT_CHEKI_SPEC,
} from '../chekiSpec';

describe('inferChekiSpecFromImageSize', () => {
  test('宽大于高推断为三寸横版', () => {
    expect(inferChekiSpecFromImageSize(1080, 720)).toBe('three_inch_landscape');
  });

  test('高大于宽推断为三寸竖版', () => {
    expect(inferChekiSpecFromImageSize(720, 1080)).toBe('three_inch_portrait');
  });

  test('方形图片不推断方形，回落到三寸竖版', () => {
    expect(inferChekiSpecFromImageSize(1000, 1000)).toBe('three_inch_portrait');
  });

  test('缺失尺寸时回落到默认规格', () => {
    expect(inferChekiSpecFromImageSize(0, 0)).toBe(DEFAULT_CHEKI_SPEC);
  });
});

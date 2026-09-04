import {
  ADAPTIVE_GUTTER,
  DASHBOARD_MAX_WIDTH,
  READING_MAX_WIDTH,
  getAdaptiveContentWidth,
} from '../../components/adaptive/AppContainers';
import { COMPACT_MAX_WIDTH, WIDE_MIN_WIDTH, getWindowMode } from '../windowMode';

describe('getWindowMode', () => {
  it('按窗口宽度划分 compact / regular / wide，不依赖设备型号', () => {
    expect(getWindowMode(0)).toBe('compact');
    expect(getWindowMode(COMPACT_MAX_WIDTH - 1)).toBe('compact');
    expect(getWindowMode(COMPACT_MAX_WIDTH)).toBe('regular');
    expect(getWindowMode(800)).toBe('regular');
    expect(getWindowMode(WIDE_MIN_WIDTH - 1)).toBe('regular');
    expect(getWindowMode(WIDE_MIN_WIDTH)).toBe('wide');
    expect(getWindowMode(1366)).toBe('wide');
  });
});

describe('getAdaptiveContentWidth', () => {
  it('Compact 下与旧 16px 边距布局等价', () => {
    expect(getAdaptiveContentWidth(375, 'compact', 'reading')).toBe(375 - 16 * 2);
    expect(getAdaptiveContentWidth(375, 'compact', 'dashboard')).toBe(375 - 16 * 2);
  });

  it('宽屏下受最大宽度和提升后的 gutter 约束', () => {
    const wideReading = getAdaptiveContentWidth(1366, 'wide', 'reading');
    expect(wideReading).toBe(READING_MAX_WIDTH - ADAPTIVE_GUTTER.wide * 2);

    const wideDashboard = getAdaptiveContentWidth(1366, 'wide', 'dashboard');
    expect(wideDashboard).toBe(DASHBOARD_MAX_WIDTH - ADAPTIVE_GUTTER.wide * 2);

    const regularDashboard = getAdaptiveContentWidth(900, 'regular', 'dashboard');
    expect(regularDashboard).toBe(900 - ADAPTIVE_GUTTER.regular * 2);
  });

  it('窗口比容器窄时不放大、不出现负值', () => {
    expect(getAdaptiveContentWidth(0, 'compact', 'dashboard')).toBe(0);
    expect(getAdaptiveContentWidth(20, 'wide', 'reading')).toBe(0);
    expect(getAdaptiveContentWidth(200, 'compact', 'dashboard')).toBe(200 - 32);
  });
});

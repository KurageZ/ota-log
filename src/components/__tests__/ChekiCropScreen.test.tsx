import React from 'react';
import { Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ChekiCropScreen from '../../../app/tools/cheki-crop';
import { MenuItem } from '../SettingsMenu';

const mockScan = jest.fn();
const mockDetect = jest.fn();
const mockCopy = jest.fn();
const mockPermission = jest.fn();
jest.mock('../../../modules/cheki-crop/src/ChekiCropModule', () => ({
  getChekiCropModule: () => ({ scanDocuments: mockScan, detect: mockDetect }),
}));
jest.mock('@expo/ui', () => ({ Host: 'Host', Slider: 'Slider' }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockPermission(),
}));
jest.mock('../../utils/copyToDocuments', () => ({
  copyToDocuments: (...args: unknown[]) => mockCopy(...args),
}));
jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000000' }) }),
}));
jest.mock('../adaptive/AppContainers', () => ({ ReadingContainer: 'ReadingContainer' }));
jest.mock('../SettingsMenu', () => ({ MenuCard: 'MenuCard', MenuItem: 'MenuItem', SectionLabel: 'SectionLabel' }));

describe('VisionKit scan results', () => {
  let renderer: ReactTestRenderer;
  const originalOS = process.env.EXPO_OS;
  beforeEach(async () => {
    process.env.EXPO_OS = 'ios';
    jest.clearAllMocks();
    mockPermission.mockResolvedValue({ granted: true });
    mockCopy.mockImplementation(async (uri: string) => uri.replace('/tmp/', '/documents/'));
    await act(async () => { renderer = create(<ChekiCropScreen />); });
  });
  afterEach(() => {
    act(() => renderer.unmount());
    if (originalOS === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = originalOS;
  });
  async function scan() {
    await act(async () => {
      renderer.root.findAllByType(MenuItem).find(item => item.props.label === '系统扫描相机')!.props.onPress();
    });
  }
  test('preserves every system-cropped page without running rectangle detection again', async () => {
    mockScan.mockResolvedValue([
      { uri: 'file:///tmp/one.jpg', width: 600, height: 900 },
      { uri: 'file:///tmp/two.jpg', width: 900, height: 600 },
    ]);
    await scan();
    expect(renderer.root.findAllByType(MenuItem)).toHaveLength(1);
    expect(mockCopy).toHaveBeenCalledTimes(2);
    expect(mockDetect).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(Image).map(image => image.props.source.uri)).toEqual([
      'file:///documents/one.jpg', 'file:///documents/two.jpg',
    ]);
    mockScan.mockResolvedValue(null);
    await scan();
    expect(renderer.root.findAllByType(Image)).toHaveLength(2);
    expect(mockCopy).toHaveBeenCalledTimes(2);
  });
  test('shows scanner errors and allows another attempt', async () => {
    mockScan.mockRejectedValue(new Error('扫描失败'));
    await scan();
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('扫描失败');
    expect(renderer.root.findAllByType(MenuItem)[0].props.disabled).toBe(false);
  });
  test('does not launch scanning when camera access is denied', async () => {
    mockPermission.mockResolvedValue({ granted: false });
    await scan();
    expect(mockScan).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('未获得相机权限');
  });
});

import React from 'react';
import { Image, Pressable, TouchableOpacity, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Slider } from '@expo/ui';
import { ChekiWhiteBalanceEditor } from '../ChekiWhiteBalanceEditor';

const mockAdjust = jest.fn();
const mockCopy = jest.fn();
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({ __esModule: true, default: 'Pressable' }));
jest.mock('@expo/ui', () => ({ Host: 'Host', Slider: 'Slider' }));
jest.mock('../../../modules/cheki-crop/src/ChekiCropModule', () => ({
  getChekiCropModule: () => ({ whiteBalance: mockAdjust }),
}));
jest.mock('../../utils/copyToDocuments', () => ({ copyToDocuments: (...args: unknown[]) => mockCopy(...args) }));
jest.mock('../../theme/appTheme', () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }), isDark: true }) }));

const original = { uri: 'file:///documents/original.jpg', width: 600, height: 900 };
const corrected = { ...original, uri: 'file:///tmp/corrected.jpg' };
describe('white balance editor', () => {
  let renderer: ReactTestRenderer;
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    mockAdjust.mockResolvedValue(corrected);
    mockCopy.mockResolvedValue('file:///documents/corrected.jpg');
    await act(async () => { renderer = create(<ChekiWhiteBalanceEditor image={original} disabled={false} />); });
    act(() => renderer.root.findByType(Pressable).props.onLayout({ nativeEvent: { layout: { width: 200, height: 300 } } }));
  });
  afterEach(() => { act(() => renderer.unmount()); jest.useRealTimers(); });
  async function press(label: string) {
    await act(async () => {
      renderer.root.findAllByType(TouchableOpacity).find(button => button.findByType(Text).props.children === label)!.props.onPress();
    });
  }
  async function select() {
    await press('选取白边');
    await act(async () => renderer.root.findByType(Pressable).props.onPress({ nativeEvent: { locationX: 10, locationY: 30 } }));
    await act(async () => { jest.advanceTimersByTime(200); });
  }
  test('samples original pixels, previews without saving, and saves explicitly', async () => {
    await select();
    expect(mockAdjust).toHaveBeenLastCalledWith(original.uri, 0.05, 0.1, 1);
    expect(renderer.root.findByType(Image).props.source.uri).toBe(corrected.uri);
    expect(mockCopy).not.toHaveBeenCalled();
    await press('对比原图');
    expect(renderer.root.findByType(Image).props.source.uri).toBe(original.uri);
    await press('查看校正');
    await press('保存调整');
    expect(mockCopy).toHaveBeenCalledWith(corrected.uri, expect.objectContaining({ filenamePrefix: 'cheki-white-balance' }));
    expect(renderer.root.findByType(Image).props.source.uri).toBe('file:///documents/corrected.jpg');
    await act(async () => renderer.root.findByType(Slider).props.onValueChange(0.5));
    await act(async () => { jest.advanceTimersByTime(200); });
    expect(mockAdjust).toHaveBeenLastCalledWith(original.uri, 0.05, 0.1, 0.5);
    await press('恢复原图');
    expect(renderer.root.findByType(Image).props.source.uri).toBe(original.uri);
    expect(renderer.root.findAllByType(Slider)).toHaveLength(0);
  });
  test('ignores a pending correction after reset', async () => {
    let finish!: (value: typeof corrected) => void;
    mockAdjust.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await select();
    await press('恢复原图');
    await act(async () => finish(corrected));
    expect(renderer.root.findByType(Image).props.source.uri).toBe(original.uri);
  });
  test('rejects an unusable sample visibly without saving or replacing the original', async () => {
    mockAdjust.mockRejectedValue(new Error('请重新点选白边'));
    await select();
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('请重新点选白边');
    expect(renderer.root.findByType(Image).props.source.uri).toBe(original.uri);
    expect(mockCopy).not.toHaveBeenCalled();
  });
  test('zero strength uses original without another render', async () => {
    await select();
    await act(async () => renderer.root.findByType(Slider).props.onValueChange(0));
    await act(async () => { jest.advanceTimersByTime(200); });
    expect(renderer.root.findByType(Image).props.source.uri).toBe(original.uri);
    expect(mockAdjust).toHaveBeenCalledTimes(1);
  });
});

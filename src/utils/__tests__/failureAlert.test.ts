import { Alert } from 'react-native';
import { hapticError } from '../haptics';
import {
  showArtistCreateFailedAlert,
  showDeleteFailedAlert,
  showOperationFailedAlert,
} from '../failureAlert';

jest.mock('../haptics', () => ({ hapticError: jest.fn() }));

describe('failureAlert', () => {
  test('uses an artist-specific message when quick creation fails', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    showArtistCreateFailedAlert(new Error('database unavailable'));

    expect(hapticError).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      '新建艺人失败',
      expect.stringContaining('未能创建该艺人。\n\n请确认艺人名称后再试一次'),
      [{ text: '知道了' }],
    );
  });

  test('uses error haptics when a delete fails', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    showDeleteFailedAlert(new Error('database unavailable'));

    expect(hapticError).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      '删除失败',
      expect.stringContaining('删除失败\n\n请稍后再试一次'),
      [{ text: '知道了' }],
    );
  });

  test('uses error haptics when an operation fails', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    showOperationFailedAlert('无法读取存储空间。', '请稍后再试。');

    expect(hapticError).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      '操作失败',
      expect.stringContaining('无法读取存储空间。\n\n请稍后再试。'),
      [{ text: '知道了' }],
    );
  });
});

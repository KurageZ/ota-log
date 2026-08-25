import { Alert } from 'react-native';
import { hapticError } from '../haptics';
import { showArtistCreateFailedAlert } from '../failureAlert';

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
});

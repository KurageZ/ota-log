import React from 'react';
import { Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { StickerPicker } from '../sticker-picker';

jest.mock('../../../components/ChekiPickerScreen', () => {
  const ReactModule = require('react');
  return {
    ChekiPickerScreen: (props: object) => ReactModule.createElement('ChekiPickerScreen', props),
  };
});

jest.mock('../../../utils/failureAlert', () => ({ showFailureAlert: jest.fn() }));

describe('StickerPicker', () => {
  const originalGetSize = Image.getSize;
  let renderer: ReactTestRenderer | undefined;

  afterEach(async () => {
    await act(async () => {
      renderer?.unmount();
    });
    renderer = undefined;
    Image.getSize = originalGetSize;
    jest.useRealTimers();
  });

  test('uses the embedded picker header inside the full-screen camera route', async () => {
    await act(async () => {
      renderer = create(
        <StickerPicker initialSelection={[]} onCancel={jest.fn()} onConfirm={jest.fn()} />,
      );
    });

    const picker = renderer!.root.findByType('ChekiPickerScreen' as never);

    expect(picker.props.presentation).toBe('embedded');
    expect(picker.props.showSelectionSummary).toBe(false);
  });

  test('uses the portrait fallback when reading an image size does not settle', async () => {
    jest.useFakeTimers();
    Image.getSize = jest.fn(() => undefined) as unknown as typeof Image.getSize;
    const onConfirm = jest.fn();

    await act(async () => {
      renderer = create(
        <StickerPicker initialSelection={[]} onCancel={jest.fn()} onConfirm={onConfirm} />,
      );
    });

    const picker = renderer!.root.findByType('ChekiPickerScreen' as never);
    const confirmation = picker.props.onConfirm([{
      id: 'cheki-1',
      uri: 'file:///cheki-1.jpg',
      spec: 'five_inch_landscape',
    }]);

    await act(async () => {
      jest.runOnlyPendingTimers();
      await confirmation;
    });

    expect(onConfirm).toHaveBeenCalledWith([{
      id: 'cheki-1',
      uri: 'file:///cheki-1.jpg',
      spec: 'five_inch_landscape',
      width: 3,
      height: 4,
    }]);
  });
});

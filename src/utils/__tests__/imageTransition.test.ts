import { measureImageTransitionOrigin } from '../imageTransition';

describe('measureImageTransitionOrigin', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns the measured transition origin before the fallback fires', () => {
    const onComplete = jest.fn();
    const node = {
      measureInWindow: jest.fn((callback) => {
        callback(12, 24, 100, 160);
      }),
    };

    measureImageTransitionOrigin(node, 8, onComplete);
    jest.advanceTimersByTime(150);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      x: 12,
      y: 24,
      width: 100,
      height: 160,
      borderRadius: 8,
    });
  });

  test('falls back without a transition when native measurement never responds', () => {
    const onComplete = jest.fn();
    const node = {
      measureInWindow: jest.fn(),
    };

    measureImageTransitionOrigin(node, 8, onComplete);
    jest.advanceTimersByTime(150);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(null);
  });

  test('ignores a native measurement callback that arrives after the fallback', () => {
    const onComplete = jest.fn();
    let measurementCallback:
      | ((x: number, y: number, width: number, height: number) => void)
      | undefined;
    const node = {
      measureInWindow: jest.fn((callback) => {
        measurementCallback = callback;
      }),
    };

    measureImageTransitionOrigin(node, 8, onComplete);
    jest.advanceTimersByTime(150);
    measurementCallback?.(12, 24, 100, 160);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(null);
  });
});

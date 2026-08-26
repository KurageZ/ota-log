import React from 'react';
import { Image } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ThemeColors } from '../../theme/appTheme';
import { ChekiGridThumbnail } from '../ChekiAlbumThumbnail';

const colors = {
  card: '#ffffff',
  cardAlt: '#eeeeee',
  shadow: '#000000',
} as ThemeColors;

describe('ChekiGridThumbnail landscape rotation', () => {
  let renderer: ReactTestRenderer | undefined;
  const originalGetSize = Image.getSize;

  afterEach(() => {
    act(() => renderer?.unmount());
    Image.getSize = originalGetSize;
    jest.clearAllMocks();
  });

  test('swaps the image frame and reports a clockwise rotation after resolving a landscape image', async () => {
    Image.getSize = jest.fn(() => Promise.resolve({ width: 1080, height: 720 })) as typeof Image.getSize;
    const onRotationChange = jest.fn();

    await act(async () => {
      renderer = create(
        <ChekiGridThumbnail
          uri="file:///clockwise-landscape.jpg"
          width={90}
          height={144}
          colors={colors}
          variant="portrait"
          spec="three_inch_landscape"
          landscapeRotation="clockwise"
          onRotationChange={onRotationChange}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const image = renderer!.root.findByType(Image);
    expect(image.props.style).toEqual(expect.objectContaining({
      width: 144,
      height: 90,
      opacity: 1,
      transform: [{ rotate: '90deg' }],
    }));
    expect(onRotationChange).toHaveBeenLastCalledWith(true);
  });

  test('keeps the original image direction when reading its size fails', async () => {
    Image.getSize = jest.fn(() => Promise.reject(new Error('unavailable'))) as typeof Image.getSize;
    const onRotationChange = jest.fn();

    await act(async () => {
      renderer = create(
        <ChekiGridThumbnail
          uri="file:///unavailable-landscape.jpg"
          width={90}
          height={144}
          colors={colors}
          variant="portrait"
          spec="five_inch_landscape"
          landscapeRotation="counterclockwise"
          onRotationChange={onRotationChange}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const image = renderer!.root.findByType(Image);
    expect(image.props.style).toEqual(expect.objectContaining({
      width: '100%',
      height: '100%',
      opacity: 1,
    }));
    expect(image.props.style.transform).toBeUndefined();
    expect(onRotationChange).toHaveBeenLastCalledWith(false);
  });

  test('does not resolve or rotate images in the square grid', () => {
    Image.getSize = jest.fn(originalGetSize) as unknown as typeof Image.getSize;

    act(() => {
      renderer = create(
        <ChekiGridThumbnail
          uri="file:///square-grid.jpg"
          width={90}
          height={90}
          colors={colors}
          variant="original"
          spec="three_inch_landscape"
          landscapeRotation="clockwise"
        />,
      );
    });

    expect(Image.getSize).not.toHaveBeenCalled();
    const image = renderer!.root.findByType(Image);
    expect(image.props.style.transform).toBeUndefined();
  });
});

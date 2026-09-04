import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import { OshiAvatar } from '../Oshi';

jest.mock('../../theme/appTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
  }),
}));

jest.mock('../AppIcon', () => ({
  AppIcon: () => null,
}));

describe('OshiAvatar', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  test('shows the artist initial when no image is available', () => {
    act(() => {
      renderer = create(<OshiAvatar source={null} size={40} isOshi={false} name="  星野爱  " />);
    });

    expect(renderer.root.findByType(Text).props.children).toBe('星');
  });

  test('falls back to the artist initial when the image fails to load', () => {
    act(() => {
      renderer = create(
        <OshiAvatar source={{ uri: 'file:///missing-avatar.jpg' }} size={40} isOshi={false} name="星野爱" />,
      );
    });

    act(() => renderer.root.findByType(Image).props.onError());

    expect(renderer.root.findByType(Text).props.children).toBe('星');
  });
});

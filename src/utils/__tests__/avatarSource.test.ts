import { resolveAvatarSource } from '../avatarSource';

describe('resolveAvatarSource', () => {
  test('returns null for a missing URI', () => {
    expect(resolveAvatarSource(null)).toBeNull();
  });

  test('returns a normal URI source unchanged', () => {
    expect(resolveAvatarSource('file:///artist-avatar.jpg')).toEqual({ uri: 'file:///artist-avatar.jpg' });
  });

  test('falls back cleanly when a public build has no bundled avatar', () => {
    expect(resolveAvatarSource('preset://6596154111')).toBeNull();
  });
});

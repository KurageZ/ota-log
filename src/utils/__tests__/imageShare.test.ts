import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as failureAlert from '../failureAlert';
import { saveImageToAlbum, shareImageFile } from '../imageShare';

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  Asset: { create: jest.fn() },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('../failureAlert', () => ({
  showFailureAlert: jest.fn(),
}));

const mockRequestPermissions = MediaLibrary.requestPermissionsAsync as jest.Mock;
const mockCreateAsset = MediaLibrary.Asset.create as jest.Mock;
const mockIsShareAvailable = Sharing.isAvailableAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;
const mockShowFailureAlert = failureAlert.showFailureAlert as jest.Mock;

describe('saveImageToAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saves the image when the album permission is granted', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockCreateAsset.mockResolvedValue({});

    await expect(saveImageToAlbum('file:///cache/poster.jpg')).resolves.toBe(true);
    expect(mockRequestPermissions).toHaveBeenCalledWith(true);
    expect(mockCreateAsset).toHaveBeenCalledWith('file:///cache/poster.jpg');
    expect(mockShowFailureAlert).not.toHaveBeenCalled();
  });

  test('reports a failure alert and returns false when the permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false });

    await expect(saveImageToAlbum('file:///cache/poster.jpg')).resolves.toBe(false);
    expect(mockCreateAsset).not.toHaveBeenCalled();
    expect(mockShowFailureAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: '无法保存到相册' }),
    );
  });

  test('reports a failure alert and returns false when creating the asset throws', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockCreateAsset.mockRejectedValue(new Error('disk full'));

    await expect(saveImageToAlbum('file:///cache/poster.jpg')).resolves.toBe(false);
    expect(mockShowFailureAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: '保存失败' }),
    );
  });
});

describe('shareImageFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens the system share sheet and returns true when sharing is available', async () => {
    mockIsShareAvailable.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue({});

    await expect(shareImageFile('file:///cache/poster.jpg', '分享活动')).resolves.toBe(true);
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/poster.jpg', {
      dialogTitle: '分享活动',
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
    expect(mockShowFailureAlert).not.toHaveBeenCalled();
  });

  test('reports a failure alert and returns false when sharing is unavailable', async () => {
    mockIsShareAvailable.mockResolvedValue(false);

    await expect(shareImageFile('file:///cache/poster.jpg', '分享活动')).resolves.toBe(false);
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(mockShowFailureAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: '分享失败' }),
    );
  });

  test('reports a failure alert and returns false when the share sheet rejects', async () => {
    mockIsShareAvailable.mockResolvedValue(true);
    mockShareAsync.mockRejectedValue(new Error('share cancelled'));

    await expect(shareImageFile('file:///cache/poster.jpg', '分享活动')).resolves.toBe(false);
    expect(mockShowFailureAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: '分享失败' }),
    );
  });
});

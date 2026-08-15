import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { showFailureAlert } from './failureAlert';

/** 将本地图片保存到系统相册；成功返回 true，失败时已弹出提示。 */
export async function saveImageToAlbum(uri: string): Promise<boolean> {
  try {
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) {
      showFailureAlert({
        title: '无法保存到相册',
        reason: 'ota log 没有添加照片的权限。',
        nextStep: '请在系统设置中允许添加照片后再试。',
      });
      return false;
    }
    await MediaLibrary.Asset.create(uri);
    return true;
  } catch (error) {
    showFailureAlert({
      title: '保存失败',
      reason: '无法将图片保存到系统相册。',
      nextStep: '请稍后重新保存。',
      details: error,
    });
    return false;
  }
}

/** 通过系统分享面板分享本地图片；成功返回 true，失败或设备不支持时已弹出提示。 */
export async function shareImageFile(uri: string, dialogTitle: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      showFailureAlert({
        title: '分享失败',
        reason: '当前设备不支持系统分享。',
        nextStep: '请稍后重新尝试。',
      });
      return false;
    }
    await Sharing.shareAsync(uri, {
      dialogTitle,
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
    return true;
  } catch (error) {
    showFailureAlert({
      title: '分享失败',
      reason: '无法分享这张图片。',
      nextStep: '请稍后重新尝试。',
      details: error,
    });
    return false;
  }
}

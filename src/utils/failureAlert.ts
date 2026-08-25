import { Alert, AlertButton } from 'react-native';
import { hapticError } from './haptics';

interface FailureAlertOptions {
  title: string;
  reason: string;
  nextStep: string;
  details?: unknown;
  buttons?: AlertButton[];
}

function formatDetails(details: unknown): string {
  if (!__DEV__ || details == null) return '';
  const text = details instanceof Error ? details.message : String(details);
  return text.trim() ? `\n\n调试信息：${text}` : '';
}

export function showFailureAlert({
  title,
  reason,
  nextStep,
  details,
  buttons,
}: FailureAlertOptions) {
  Alert.alert(
    title,
    `${reason}\n\n${nextStep}${formatDetails(details)}`,
    buttons ?? [{ text: '知道了' }],
  );
}

export function showPhotoLibraryPermissionAlert() {
  showFailureAlert({
    title: '需要相册权限',
    reason: '无法读取相册。',
    nextStep: '请前往系统设置允许访问相册后再试一次。',
  });
}

export function showCameraPermissionAlert() {
  showFailureAlert({
    title: '需要相机权限',
    reason: '无法调用相机。',
    nextStep: '请前往系统设置允许访问相机后再试一次。',
  });
}

export function showSaveFailedAlert(details?: unknown) {
  hapticError();
  showFailureAlert({
    title: '保存失败',
    reason: '保存失败',
    nextStep: '请稍后重试；如果问题持续出现，再检查输入内容是否完整。',
    details,
  });
}

export function showArtistCreateFailedAlert(details?: unknown) {
  hapticError();
  showFailureAlert({
    title: '新建艺人失败',
    reason: '未能创建该艺人。',
    nextStep: '请确认艺人名称后再试一次；如果问题持续出现，请稍后重试。',
    details,
  });
}

export function showDeleteFailedAlert(details?: unknown) {
  showFailureAlert({
    title: '删除失败',
    reason: '删除失败',
    nextStep: '请稍后再试一次。',
    details,
  });
}

export function showOperationFailedAlert(reason: string, nextStep: string, details?: unknown) {
  showFailureAlert({
    title: '操作失败',
    reason,
    nextStep,
    details,
  });
}

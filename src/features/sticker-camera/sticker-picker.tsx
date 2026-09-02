import { Image } from 'react-native';
import {
  ChekiPickerScreen,
  type ChekiPickerItem,
} from '../../components/ChekiPickerScreen';
import { showFailureAlert } from '../../utils/failureAlert';
import type { StickerAsset } from './sticker-overlay';

const MAX_STICKERS = 9;
const IMAGE_SIZE_TIMEOUT_MS = 1500;
const FALLBACK_IMAGE_SIZE = { width: 3, height: 4 } as const;

function readImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (size: { width: number; height: number }) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(size);
    };
    timeout = setTimeout(() => finish(FALLBACK_IMAGE_SIZE), IMAGE_SIZE_TIMEOUT_MS);

    try {
      Image.getSize(
        uri,
        (width, height) => finish({ width, height }),
        () => finish(FALLBACK_IMAGE_SIZE),
      );
    } catch {
      finish(FALLBACK_IMAGE_SIZE);
    }
  });
}

export function StickerPicker({
  initialSelection,
  onCancel,
  onConfirm,
}: {
  initialSelection: StickerAsset[];
  onCancel: () => void;
  onConfirm: (assets: StickerAsset[]) => void | Promise<void>;
}) {
  const confirm = async (items: ChekiPickerItem[]) => {
    let assets: StickerAsset[];
    try {
      assets = await Promise.all(items.map(async (item) => ({
        ...item,
        ...await readImageSize(item.uri),
      })));
      if (assets.length === 0) throw new Error('所选拍立得已经不可用');
    } catch (error) {
      showFailureAlert({
        title: '无法使用所选拍立得',
        reason: '读取拍立得照片时遇到问题。',
        nextStep: '请取消异常项目或重新进入选择器后再试。',
        details: error,
      });
      return;
    }

    await onConfirm(assets);
  };

  return (
    <ChekiPickerScreen
      initialSelectedIds={initialSelection.map(({ id }) => id)}
      maxSelection={MAX_STICKERS}
      minSelection={1}
      presentation="embedded"
      showSelectionSummary={false}
      onCancel={onCancel}
      onConfirm={confirm}
    />
  );
}

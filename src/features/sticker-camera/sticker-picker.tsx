import { Image } from 'react-native';
import {
  ChekiPickerScreen,
  type ChekiPickerItem,
} from '../../components/ChekiPickerScreen';
import { showFailureAlert } from '../../utils/failureAlert';
import type { StickerAsset } from './sticker-overlay';

const MAX_STICKERS = 9;

function readImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 3, height: 4 }),
    );
  });
}

export function StickerPicker({
  initialSelection,
  onCancel,
  onConfirm,
}: {
  initialSelection: StickerAsset[];
  onCancel: () => void;
  onConfirm: (assets: StickerAsset[]) => Promise<void>;
}) {
  const confirm = async (items: ChekiPickerItem[]) => {
    try {
      const assets = await Promise.all(items.map(async (item) => ({
        ...item,
        ...await readImageSize(item.uri),
      })));
      if (assets.length === 0) throw new Error('所选拍立得已经不可用');
      await onConfirm(assets);
    } catch (error) {
      showFailureAlert({
        title: '无法使用所选拍立得',
        reason: '读取拍立得正面照片时遇到问题。',
        nextStep: '请取消异常项目或重新进入选择器后再试。',
        details: error,
      });
    }
  };

  return (
    <ChekiPickerScreen
      initialSelectedIds={initialSelection.map(({ id }) => id)}
      maxSelection={MAX_STICKERS}
      minSelection={1}
      onCancel={onCancel}
      onConfirm={confirm}
    />
  );
}

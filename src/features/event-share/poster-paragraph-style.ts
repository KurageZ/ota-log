import type { SkParagraphStyle } from '@shopify/react-native-skia';

export function buildPosterParagraphStyle(
  maxLines: number | undefined,
  textAlign: SkParagraphStyle['textAlign'],
): SkParagraphStyle {
  if (maxLines == null) return { textAlign };
  return { ellipsis: '…', maxLines, textAlign };
}

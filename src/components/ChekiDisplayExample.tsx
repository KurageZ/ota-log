import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '../theme/appTheme';
import type { ChekiDisplayStyle } from '../theme/config';
import type { ChekiSpec } from '../domain/chekiSpec';
import { chunkChekiPhysicalRows, getChekiAlbumFrame, getChekiJustifiedRowHeight } from '../utils/cheki';

const examples = (['three_inch_portrait', 'three_inch_portrait', 'five_inch_landscape', 'three_inch_portrait', 'three_inch_landscape', 'five_inch_portrait'] as ChekiSpec[])
  .map((spec, index) => ({ spec, id: index + 1 }));

/** Numbered fictional photos rendered with the same layout rules as the album. */
export function ChekiDisplayExample({ style, fillGaps }: { style: ChekiDisplayStyle; fillGaps: boolean }) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(280);
  const gap = 8;
  const base = 54;
  const rows = chunkChekiPhysicalRows(examples, 3, style === 'square' ? 'original' : 'portrait', base, gap, style === 'justified', fillGaps);
  let y = 0;
  const frames = rows.flatMap((row, index) => {
    const height = style === 'justified' ? getChekiJustifiedRowHeight(row, 3, base, gap, index === rows.length - 1) : undefined;
    const sizes = row.map((item) => style === 'square' ? { width: base, height: base } : getChekiAlbumFrame(item.spec, base, height));
    const rowHeight = Math.max(...sizes.map((size) => size.height));
    let x = 0;
    const result = row.map((item, i) => {
      const frame = { ...sizes[i], x, y: y + (rowHeight - sizes[i].height) / 2, item };
      x += sizes[i].width + gap;
      return frame;
    });
    y += rowHeight + gap;
    return result;
  });
  const scale = Math.min((width - 24) / 178, 156 / (y - gap));
  return <View accessible accessibilityLabel="同一组六张虚构拍立得，编号表示原始排序" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    style={{ height: 180, borderRadius: 12, backgroundColor: colors.cardAlt, marginTop: 12 }}>
    {frames.map((frame) => {
      const physical = getChekiAlbumFrame(frame.item.spec, base);
      const fit = Math.min((frame.width - 6) / physical.width, (frame.height - 6) / physical.height);
      return <View key={frame.item.id} style={{ position: 'absolute', left: (width - 178 * scale) / 2 + frame.x * scale,
        top: 12 + frame.y * scale, width: frame.width * scale, height: frame.height * scale,
        backgroundColor: colors.card, borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: physical.width * fit * scale, height: physical.height * fit * scale,
          backgroundColor: frame.item.id % 2 ? colors.accentSoft : colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{frame.item.id}</Text>
        </View>
      </View>;
    })}
  </View>;
}

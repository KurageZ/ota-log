import { chunkChekiAlbumRows, getChekiAlbumColumnSpan } from '../utils/cheki';
import type { ReactElement } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import type { ResolvedChekiWidgetItem } from '../types/chekiWidgetGroups';
import { useAppTheme } from '../theme/appTheme';
import {
  ChekiGridThumbnail,
  CHEKI_GRID_GAP,
  useChekiAlbumGridLayout,
} from './ChekiAlbumThumbnail';

export function ChekiWidgetGroupPreviewGrid({
  items,
  header,
  footer,
  scrollEnabled = true,
}: {
  items: ResolvedChekiWidgetItem[];
  header?: ReactElement;
  footer?: ReactElement;
  scrollEnabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.max(1, Math.min(width, 960) - 32);
  const { columns, itemWidth, itemHeight } = useChekiAlbumGridLayout({
    density: 'medium',
    availableWidth: contentWidth,
    availableHeight: height,
    displayMode: 'portrait',
  });
  return (
    <FlatList
      key={`cheki-widget-preview-${columns}`}
      accessibilityRole="list"
      contentInsetAdjustmentBehavior="automatic"
      data={chunkChekiAlbumRows(items, columns, 'portrait')}
      keyExtractor={(row) => row[0].id}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
        gap: CHEKI_GRID_GAP,
      }}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollEnabled}
      ListHeaderComponent={header}
      ListHeaderComponentStyle={{ marginBottom: items.length > 0 ? 8 : 0 }}
      ListFooterComponent={footer}
      ListFooterComponentStyle={{ marginTop: 14 }}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      renderItem={({ item: row }) => (
        <View style={{ flexDirection: 'row', gap: CHEKI_GRID_GAP }}>
          {row.map((item) => (
            <View key={item.id} accessibilityRole="image" accessibilityLabel="拍立得正面照片">
              <ChekiGridThumbnail
                uri={item.frontPhotoUri}
                width={getChekiAlbumColumnSpan(item.spec, 'portrait') === 2
                  ? itemWidth * 2 + CHEKI_GRID_GAP : itemWidth}
                height={itemHeight}
                colors={colors}
                variant="portrait"
                spec={item.spec}
                fiveInchLandscape
              />
            </View>
          ))}
        </View>
      )}
    />
  );
}

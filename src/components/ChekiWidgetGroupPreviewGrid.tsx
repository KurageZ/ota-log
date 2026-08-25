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
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? { gap: CHEKI_GRID_GAP } : undefined}
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
      renderItem={({ item }) => (
        <View accessibilityRole="image" accessibilityLabel="拍立得正面照片">
          <ChekiGridThumbnail
            uri={item.frontPhotoUri}
            width={itemWidth}
            height={itemHeight}
            colors={colors}
            variant="portrait"
          />
        </View>
      )}
    />
  );
}

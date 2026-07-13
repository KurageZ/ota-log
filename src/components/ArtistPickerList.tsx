import { ReactElement, useCallback, useMemo } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { Artist } from '../types/models';
import { ArtistDisplayMode } from '../utils/artistDisplay';
import { useAppTheme } from '../theme/appTheme';
import { ArtistOptionRow, ARTIST_OPTION_ROW_HEIGHT, ArtistOptionTrailing } from './ArtistOptionRow';

type SelectedIndicator = 'check' | 'remove';

export function ArtistPickerList({
  artists,
  selectedIds,
  oshiArtistId,
  isDark,
  maxHeight,
  onPressArtist,
  emptyComponent,
  usePlainScroll = false,
  renderLimit,
  overflowHint,
  parentNameMap,
  displayMode = 'compact',
  selectedIndicator = 'check',
}: {
  artists: Artist[];
  selectedIds?: Set<string> | string[];
  oshiArtistId?: string | null;
  isDark: boolean;
  maxHeight: number;
  onPressArtist: (artist: Artist) => void;
  emptyComponent: ReactElement;
  usePlainScroll?: boolean;
  renderLimit?: number;
  overflowHint?: string;
  parentNameMap?: Record<string, string>;
  displayMode?: ArtistDisplayMode;
  selectedIndicator?: SelectedIndicator;
}) {
  const { colors } = useAppTheme();
  const selectedSet = useMemo(
    () => selectedIds instanceof Set ? selectedIds : new Set(selectedIds ?? []),
    [selectedIds],
  );
  const visibleArtists = useMemo(
    () => usePlainScroll && renderLimit ? artists.slice(0, renderLimit) : artists,
    [artists, renderLimit, usePlainScroll],
  );
  const hiddenCount = artists.length - visibleArtists.length;

  const renderRow = useCallback((artist: Artist, index: number, total = visibleArtists.length) => {
    const selected = selectedSet.has(artist.id);
    const trailing: ArtistOptionTrailing = selected ? selectedIndicator : 'none';
    return (
      <ArtistOptionRow
        key={artist.id}
        artist={artist}
        selected={selected}
        isDark={isDark}
        isLast={index === total - 1 && hiddenCount === 0}
        isOshi={artist.id === oshiArtistId}
        parentName={artist.parent_id ? parentNameMap?.[artist.parent_id] : undefined}
        colors={colors}
        displayMode={displayMode}
        trailing={trailing}
        onPress={onPressArtist}
      />
    );
  }, [displayMode, hiddenCount, isDark, onPressArtist, oshiArtistId, parentNameMap, selectedIndicator, selectedSet, visibleArtists.length, colors]);

  const renderItem = useCallback(({ item, index }: { item: Artist; index: number }) => (
    renderRow(item, index, artists.length)
  ), [artists.length, renderRow]);

  return (
    <View style={{
      height: artists.length === 0 ? undefined : Math.min(
        maxHeight,
        Math.max(ARTIST_OPTION_ROW_HEIGHT, artists.length * ARTIST_OPTION_ROW_HEIGHT),
      ),
      maxHeight,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.inputBorder,
    }}>
      {usePlainScroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {artists.length === 0 ? emptyComponent : visibleArtists.map((artist, index) => renderRow(artist, index))}
          {hiddenCount > 0 ? (
            <View style={{ padding: 12, alignItems: 'center', backgroundColor: colors.card }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
                {overflowHint ?? `还有 ${hiddenCount} 位艺人，输入关键词继续筛选`}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          data={artists}
          keyExtractor={(artist) => artist.id}
          renderItem={renderItem}
          ListEmptyComponent={emptyComponent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews
          getItemLayout={(_, index) => ({
            length: ARTIST_OPTION_ROW_HEIGHT,
            offset: ARTIST_OPTION_ROW_HEIGHT * index,
            index,
          })}
        />
      )}
    </View>
  );
}

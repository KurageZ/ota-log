import { ReactNode, useMemo, useState } from 'react';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Artist } from '../types/models';
import { filterArtistsByQuery } from '../utils/filter';
import { ArtistDisplayMode } from '../utils/artistDisplay';
import { useAppTheme } from '../theme/appTheme';
import { AppIcon } from './AppIcon';
import { ArtistOptionRow } from './ArtistOptionRow';
import { ArtistPickerList } from './ArtistPickerList';

const DEFAULT_VISIBLE_SELECTED_ARTISTS = 5;

export function ArtistSearchPicker({
  artists,
  selectedIds,
  selectedArtists,
  oshiArtistId,
  isDark,
  searchValue,
  onSearchChange,
  onSelectArtist,
  onRemoveArtist,
  parentNameMap,
  placeholder = '搜索艺人...',
  maxHeight = 220,
  usePlainScroll = true,
  renderLimit,
  emptyText,
  idleEmptyText,
  selectedLabel,
  maxVisibleSelected = DEFAULT_VISIBLE_SELECTED_ARTISTS,
  selectedOverflowLabel,
  extraContentAfterSearch,
  hideSelectedFromCandidates = true,
  displayMode = 'compact',
  inputVariant = 'plain',
}: {
  artists: Artist[];
  selectedIds?: Set<string> | string[];
  selectedArtists?: Artist[];
  oshiArtistId?: string | null;
  isDark: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelectArtist: (artist: Artist) => void;
  onRemoveArtist: (artist: Artist) => void;
  parentNameMap?: Record<string, string>;
  placeholder?: string;
  maxHeight?: number;
  usePlainScroll?: boolean;
  renderLimit?: number;
  emptyText?: string;
  idleEmptyText?: string;
  selectedLabel?: string;
  maxVisibleSelected?: number;
  selectedOverflowLabel?: (hiddenCount: number, totalCount: number) => string;
  extraContentAfterSearch?: ReactNode;
  hideSelectedFromCandidates?: boolean;
  displayMode?: ArtistDisplayMode;
  inputVariant?: 'plain' | 'bottomSheet';
}) {
  const { colors } = useAppTheme();
  const [showAllSelected, setShowAllSelected] = useState(false);
  const SearchInput = inputVariant === 'bottomSheet' ? BottomSheetTextInput : TextInput;
  const selectedSet = useMemo(
    () => selectedIds instanceof Set ? selectedIds : new Set(selectedIds ?? []),
    [selectedIds],
  );
  const resolvedSelectedArtists = useMemo(() => {
    if (selectedArtists) return selectedArtists;
    return artists.filter((artist) => selectedSet.has(artist.id));
  }, [artists, selectedArtists, selectedSet]);
  const filteredArtists = useMemo(
    () => filterArtistsByQuery(artists, searchValue, oshiArtistId),
    [artists, oshiArtistId, searchValue],
  );
  const candidateArtists = useMemo(
    () => hideSelectedFromCandidates
      ? filteredArtists.filter((artist) => !selectedSet.has(artist.id))
      : filteredArtists,
    [filteredArtists, hideSelectedFromCandidates, selectedSet],
  );
  const visibleSelectedArtists = showAllSelected
    ? resolvedSelectedArtists
    : resolvedSelectedArtists.slice(0, maxVisibleSelected);
  const hiddenSelectedCount = resolvedSelectedArtists.length - visibleSelectedArtists.length;
  const trimmedSearch = searchValue.trim();
  const candidateRenderLimit = renderLimit ?? (trimmedSearch ? 80 : 32);

  return (
    <View>
      {resolvedSelectedArtists.length > 0 ? (
        <View style={{ marginBottom: 10 }}>
          {selectedLabel ? (
            <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
              {selectedLabel}
            </Text>
          ) : null}
          <View style={{
            borderRadius: 10,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}>
            {visibleSelectedArtists.map((artist, index) => (
              <ArtistOptionRow
                key={artist.id}
                artist={artist}
                selected
                isDark={isDark}
                isLast={index === visibleSelectedArtists.length - 1 && hiddenSelectedCount === 0}
                isOshi={artist.id === oshiArtistId}
                parentName={artist.parent_id ? parentNameMap?.[artist.parent_id] : undefined}
                colors={colors}
                displayMode={displayMode}
                trailing="remove"
                onTrailingPress={onRemoveArtist}
              />
            ))}
            {hiddenSelectedCount > 0 ? (
              <TouchableOpacity
                onPress={() => setShowAllSelected(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: colors.accentPress,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
                  {selectedOverflowLabel?.(hiddenSelectedCount, resolvedSelectedArtists.length)
                    ?? `展开全部 ${resolvedSelectedArtists.length} 位艺人`}
                </Text>
                <AppIcon name="disclosure" variant="down" size={14} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: isDark ? colors.input : colors.cardMuted,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        paddingHorizontal: 10,
        height: 44,
        marginBottom: 8,
      }}>
        <AppIcon name="search" size={14} color={colors.placeholder} />
        <SearchInput
          style={{ flex: 1, fontSize: 13, color: colors.text }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={searchValue}
          onChangeText={onSearchChange}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      {extraContentAfterSearch}

      <ArtistPickerList
        artists={candidateArtists}
        selectedIds={hideSelectedFromCandidates ? [] : selectedSet}
        oshiArtistId={oshiArtistId}
        isDark={isDark}
        maxHeight={maxHeight}
        usePlainScroll={usePlainScroll}
        renderLimit={candidateRenderLimit}
        parentNameMap={parentNameMap}
        displayMode={displayMode}
        onPressArtist={onSelectArtist}
        emptyComponent={
          <View style={{ padding: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              {trimmedSearch ? (emptyText ?? '没有找到匹配的艺人') : (idleEmptyText ?? '输入关键词搜索艺人')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

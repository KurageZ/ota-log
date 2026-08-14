import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import {
  CHEKI_BARE_THUMBNAIL_RADIUS,
  CHEKI_GRID_GAP,
  ChekiGridThumbnail,
  useChekiAlbumGridLayout,
} from '../../components/ChekiAlbumThumbnail';
import { useDB } from '../../context/DBContext';
import { useAppTheme } from '../../theme/appTheme';
import { showFailureAlert } from '../../utils/failureAlert';
import type { StickerAsset } from './sticker-overlay';
import {
  sortStickerCandidates,
  type StickerCandidate,
  type StickerSortMode,
} from './sticker-selection';

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

function SortControl({
  mode,
  oshiAvailable,
  onChange,
}: {
  mode: StickerSortMode;
  oshiAvailable: boolean;
  onChange: (mode: StickerSortMode) => void;
}) {
  const { colors } = useAppTheme();
  const options: Array<{ value: StickerSortMode; label: string; disabled?: boolean }> = [
    { value: 'none', label: '无优先' },
    { value: 'oshi', label: '单推优先', disabled: !oshiAvailable },
    { value: 'favorite', label: '收藏优先' },
  ];

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 3,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: colors.cardAlt,
      }}
    >
      {options.map((option) => {
        const selected = option.value === mode;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled: option.disabled }}
            activeOpacity={0.72}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 9,
              borderCurve: 'continuous',
              backgroundColor: selected ? colors.card : 'transparent',
              opacity: option.disabled ? 0.38 : 1,
              boxShadow: selected ? '0 1px 3px rgba(0, 0, 0, 0.08)' : undefined,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: selected ? colors.text : colors.textMuted,
                fontSize: 12,
                fontWeight: '800',
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
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
  const db = useDB();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [candidates, setCandidates] = useState<StickerCandidate[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<StickerSortMode>('none');
  const [selectedIds, setSelectedIds] = useState(() => initialSelection.map(({ id }) => id));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      db.chekiRecords.findBrowseItems(),
      db.userConfig.getConfig(),
    ]).then(([items, config]) => {
      if (!active) return;
      const frontCandidates = items.flatMap<StickerCandidate>((item) => {
        const front = item.images.find(({ side }) => side === 'front');
        if (!front) return [];
        return [{
          id: item.id,
          uri: front.photo_uri,
          artistId: item.record.artist_id,
          isFavorite: item.is_favorite === 1,
        }];
      });
      setCandidates(frontCandidates);
      setOshiArtistId(config.oshi_artist_id);
      setSelectedIds((current) => current.filter((id) => (
        frontCandidates.some((candidate) => candidate.id === id)
      )));
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [db, reloadKey]);

  const sortedCandidates = useMemo(
    () => sortStickerCandidates(candidates, sortMode, oshiArtistId),
    [candidates, oshiArtistId, sortMode],
  );
  const selectedIndexById = useMemo(
    () => new Map(selectedIds.map((id, index) => [id, index])),
    [selectedIds],
  );
  const horizontalPadding = Math.max(16, (windowWidth - 720) / 2);
  const galleryContentWidth = Math.max(1, Math.min(windowWidth, 720) - 32);
  const gridLayout = useChekiAlbumGridLayout({
    // 与切册页面的「小」密度一致。
    density: 'small',
    availableWidth: galleryContentWidth,
    // calculateChekiGridLayout 目前不使用 availableHeight，占位传窗口高度即可。
    availableHeight: windowHeight,
    // 与电子切册相册模式默认一致：统一比例。
    useSpecAspectRatio: false,
  });
  const columns = gridLayout.columns;
  const chekiW = gridLayout.itemWidth;
  const chekiH = gridLayout.itemHeight;
  const canConfirm = selectedIds.length > 0 && !loading && !loadError && !submitting;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidateId) => candidateId !== id);
      if (current.length >= MAX_STICKERS) return current;
      return [...current, id];
    });
  }, []);

  const confirm = useCallback(async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const selectedCandidates = selectedIds.flatMap((id) => {
        const candidate = byId.get(id);
        return candidate ? [candidate] : [];
      });
      const assets = await Promise.all(selectedCandidates.map(async (candidate) => ({
        id: candidate.id,
        uri: candidate.uri,
        ...await readImageSize(candidate.uri),
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
    } finally {
      setSubmitting(false);
    }
  }, [candidates, onConfirm, selectedIds, submitting]);

  const header = (
    <View
      style={{ gap: 12, paddingHorizontal: horizontalPadding, paddingBottom: 12 }}
    >
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="取消选择"
          activeOpacity={0.65}
          disabled={submitting}
          onPress={onCancel}
          style={{ minWidth: 64, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>取消</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '800' }}>选择拍立得</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`完成，已选择 ${selectedIds.length} 张`}
          accessibilityState={{ disabled: !canConfirm }}
          activeOpacity={0.65}
          disabled={!canConfirm}
          onPress={() => void confirm()}
          style={{ minWidth: 64, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text
              style={{
                color: canConfirm ? colors.accent : colors.textMuted,
                fontSize: 15,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}
            >
              完成（{selectedIds.length}）
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <SortControl mode={sortMode} oshiAvailable={oshiArtistId != null} onChange={setSortMode} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <View style={{ paddingTop: insets.top }}>
        {header}
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>正在读取拍立得…</Text>
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingBottom: insets.bottom + 28, gap: 12 }}>
          <AppIcon name="alert" size={34} color={colors.danger} />
          <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '800' }}>无法读取拍立得</Text>
          <Text selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
            {loadError}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.72}
            onPress={() => setReloadKey((value) => value + 1)}
            style={{ minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent }}
          >
            <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>重新加载</Text>
          </TouchableOpacity>
        </View>
      ) : sortedCandidates.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingBottom: insets.bottom + 28, gap: 12 }}>
          <AppIcon name="images" size={40} color={colors.textMuted} />
          <Text style={{ color: colors.heading, fontSize: 18, fontWeight: '800' }}>还没有正面照片</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
            请先在电子切册中为拍立得添加正面照片。
          </Text>
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="never"
          data={sortedCandidates}
          keyExtractor={({ id }) => id}
          numColumns={columns}
          columnWrapperStyle={{ gap: CHEKI_GRID_GAP }}
          contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24, gap: CHEKI_GRID_GAP }}
          initialNumToRender={18}
          maxToRenderPerBatch={18}
          windowSize={7}
          renderItem={({ item }) => {
            const selectedIndex = selectedIndexById.get(item.id);
            const selected = selectedIndex != null;
            const disabled = !selected && selectedIds.length >= MAX_STICKERS;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={selected ? `已选第 ${selectedIndex + 1} 张拍立得` : '选择拍立得'}
                accessibilityState={{ selected, disabled }}
                activeOpacity={0.72}
                disabled={disabled}
                onPress={() => toggleSelection(item.id)}
                style={{
                  width: chekiW,
                  height: chekiH,
                  overflow: 'hidden',
                  borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
                  borderCurve: 'continuous',
                  opacity: disabled ? 0.32 : 1,
                }}
              >
                <ChekiGridThumbnail
                  uri={item.uri}
                  width={chekiW}
                  height={chekiH}
                  colors={colors}
                  aspectRatio={null}
                />
                {selected ? (
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderWidth: 3,
                      borderColor: colors.accent,
                      borderRadius: CHEKI_BARE_THUMBNAIL_RADIUS,
                      borderCurve: 'continuous',
                    }}
                  />
                ) : null}
                {selected ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      width: 27,
                      height: 27,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.accent,
                      boxShadow: '0 2px 7px rgba(0, 0, 0, 0.24)',
                    }}
                  >
                    <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                      {selectedIndex + 1}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

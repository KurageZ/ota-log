import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Keyboard,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDB } from '../context/DBContext';
import { Artist, Event } from '../types/models';
import type { ChekiRecordWithItems } from '../repositories/ChekiRecordRepository';
import { toISODate } from '../utils/date';
import { copyToDocuments } from '../utils/copyToDocuments';
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';
import {
  showCameraPermissionAlert,
  showPhotoLibraryPermissionAlert,
  showSaveFailedAlert,
} from '../utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../utils/safeArea';
import { getArtistPrimaryName } from '../utils/artistDisplay';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { AppIcon } from './AppIcon';
import { ArtistSearchPicker } from './ArtistSearchPicker';
import { FormCard, FormFieldLabel, FormSectionLabel } from './FormPrimitives';
import { NativeTextToolbar } from './native-text-toolbar';
import {
  CHEKI_SPECS,
  DEFAULT_CHEKI_SPEC,
  getChekiSpecAspectRatio,
  getChekiSpecLabel,
  type ChekiSpec,
} from '../domain/chekiSpec';

const PHOTO_PICKER_SELECTION_LIMIT = 20;
const CHEKI_IMPORT_MAX_DIMENSION = Platform.OS === 'android' ? 1600 : 2000;

type ArtistDecision = 'unconfirmed' | 'selected' | 'none';

interface ChekiRecordFormProps {
  mode: 'create' | 'edit';
  recordId?: string;
  initialArtistId?: string;
  initialEventId?: string;
  initialDate?: string;
  focusImages?: boolean;
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForInteractionsToFinish(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => setTimeout(resolve, 0));
  });
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function parseQuantity(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

function parseUnitPrice(raw: string): number | null {
  if (!raw.trim()) return 0;
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function getItemPreviewUri(item: ChekiRecordWithItems['items'][number]): string | null {
  return item.images.find((image) => image.side === 'front')?.photo_uri
    ?? item.images.find((image) => image.side === 'back')?.photo_uri
    ?? null;
}

export function ChekiRecordForm({
  mode,
  recordId,
  initialArtistId,
  initialEventId,
  initialDate,
  focusImages = false,
}: ChekiRecordFormProps) {
  const db = useDB();
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const pendingImportedPhotoUrisRef = useRef(new Set<string>());
  const initialSnapshotRef = useRef('');
  const allowNavigationRef = useRef(false);
  const priceTouchedRef = useRef(false);
  const lastPriceRequestRef = useRef(0);
  const initialPriceAppliedRef = useRef(false);

  const [loading, setLoading] = useState(mode === 'edit');
  const [record, setRecord] = useState<ChekiRecordWithItems | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>([]);
  const [pendingRemovedItemIds, setPendingRemovedItemIds] = useState<string[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(initialArtistId ?? null);
  const [artistDecision, setArtistDecision] = useState<ArtistDecision>(
    initialArtistId ? 'selected' : 'unconfirmed',
  );
  const [artistSearch, setArtistSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId ?? null);
  const [eventSearch, setEventSearch] = useState('');
  const [date, setDate] = useState(initialDate ?? toISODate(new Date()));
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [newItemSpec, setNewItemSpec] = useState<ChekiSpec>(DEFAULT_CHEKI_SPEC);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [photoPickerPending, setPhotoPickerPending] = useState(false);
  const [photoImportProgress, setPhotoImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const existingItemCount = record?.items.length ?? 0;
  const pendingRemovedItemIdSet = useMemo(
    () => new Set(pendingRemovedItemIds),
    [pendingRemovedItemIds],
  );
  const retainedExistingItems = useMemo(
    () => record?.items.filter((item) => !pendingRemovedItemIdSet.has(item.id)) ?? [],
    [pendingRemovedItemIdSet, record?.items],
  );
  const retainedExistingItemCount = retainedExistingItems.length;
  const retainedEmptyItemCount = retainedExistingItems.filter((item) => item.images.length === 0).length;
  const retainedImageItemCount = retainedExistingItemCount - retainedEmptyItemCount;
  const parsedQuantity = parseQuantity(quantity);
  const requiredItemCount = retainedExistingItemCount
    + Math.max(0, pendingPhotoUris.length - retainedEmptyItemCount);
  const addedPhotoCount = retainedImageItemCount + pendingPhotoUris.length;
  const hasAddedPhotos = addedPhotoCount > 0;
  const isHandlingPhotos = photoPickerPending || photoImportProgress != null;

  useEffect(() => {
    let active = true;
    Promise.all([
      db.artists.findAll(),
      db.events.findAll(),
      db.userConfig.getConfig(),
      mode === 'edit' && recordId
        ? db.chekiRecords.findRecordById(recordId)
        : Promise.resolve(null),
    ]).then(([artistRows, eventRows, config, existingRecord]) => {
      if (!active) return;
      setArtists(artistRows);
      setEvents(eventRows);
      setOshiArtistId(config.oshi_artist_id);
      if (mode === 'edit') {
        if (!existingRecord) {
          Alert.alert('记录不存在', '这条拍立得记录可能已被删除。', [
            { text: '返回', onPress: () => router.back() },
          ]);
          return;
        }
        setRecord(existingRecord);
        setQuantity(String(existingRecord.quantity));
        setSelectedArtistId(existingRecord.artist_id);
        setArtistDecision(existingRecord.artist_id ? 'selected' : 'none');
        setSelectedEventId(existingRecord.event_id);
        setDate(existingRecord.date ?? '');
        const existingPrices = new Set(existingRecord.items.map((item) => item.unit_price));
        setUnitPrice(existingPrices.size === 1 ? String(existingRecord.items[0]?.unit_price ?? 0) : '');
        priceTouchedRef.current = true;
        setNotes(existingRecord.notes ?? '');
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      Alert.alert('读取失败', '暂时无法读取拍立得记录，请稍后重试。');
    });
    return () => {
      active = false;
    };
  }, [db, mode, recordId]);

  const stateSnapshot = useMemo(() => JSON.stringify({
    quantity,
    pendingPhotoUris,
    pendingRemovedItemIds,
    selectedArtistId,
    artistDecision,
    selectedEventId,
    date,
    unitPrice,
    notes,
    newItemSpec,
  }), [
    artistDecision,
    date,
    notes,
    newItemSpec,
    pendingPhotoUris,
    pendingRemovedItemIds,
    quantity,
    selectedArtistId,
    selectedEventId,
    unitPrice,
  ]);

  useEffect(() => {
    if (loading || initialSnapshotRef.current) return;
    initialSnapshotRef.current = stateSnapshot;
  }, [loading, stateSnapshot]);

  const isDirty = initialSnapshotRef.current !== '' && initialSnapshotRef.current !== stateSnapshot;

  const cleanupPendingImportedPhotos = useCallback(async (uris?: string[]) => {
    const targets = uris ?? Array.from(pendingImportedPhotoUrisRef.current);
    for (const uri of new Set(targets)) {
      pendingImportedPhotoUrisRef.current.delete(uri);
      await deleteLocalFileIfUnreferenced(db.rawDb, uri);
    }
  }, [db]);

  useEffect(() => () => {
    void cleanupPendingImportedPhotos();
  }, [cleanupPendingImportedPhotos]);

  const leaveForm = useCallback(() => {
    const leave = () => {
      allowNavigationRef.current = true;
      void cleanupPendingImportedPhotos();
      router.back();
    };
    if (!isDirty) {
      leave();
      return;
    }
    Alert.alert('放弃本次修改？', '尚未保存的内容将会丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: leave },
    ]);
  }, [cleanupPendingImportedPhotos, isDirty]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!isDirty || allowNavigationRef.current) return;
    event.preventDefault();
    Alert.alert('放弃本次修改？', '尚未保存的内容将会丢失。', [
      { text: '继续编辑', style: 'cancel' },
      {
        text: '放弃',
        style: 'destructive',
        onPress: () => {
          allowNavigationRef.current = true;
          void cleanupPendingImportedPhotos();
          navigation.dispatch(event.data.action);
        },
      },
    ]);
  }), [cleanupPendingImportedPhotos, isDirty, navigation]);

  const importPhotos = useCallback(async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (assets.length === 0) return;
    setPhotoImportProgress({ current: 0, total: assets.length });
    await waitForNextFrame();
    await waitForInteractionsToFinish();
    let failedCount = 0;
    const importedUris: string[] = [];
    try {
      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        try {
          const permanentUri = await copyToDocuments(asset.uri, {
            filenamePrefix: 'cheki',
            maxDimension: CHEKI_IMPORT_MAX_DIMENSION,
            sourceSize: asset.width > 0 && asset.height > 0
              ? { width: asset.width, height: asset.height }
              : null,
          });
          pendingImportedPhotoUrisRef.current.add(permanentUri);
          importedUris.push(permanentUri);
        } catch {
          failedCount += 1;
        } finally {
          setPhotoImportProgress({ current: index + 1, total: assets.length });
          await waitForNextFrame();
        }
      }
    } finally {
      setPhotoImportProgress(null);
    }
    if (importedUris.length > 0) {
      setPendingPhotoUris((current) => {
        const next = [...current, ...importedUris];
        const nextItemCount = retainedExistingItemCount
          + Math.max(0, next.length - retainedEmptyItemCount);
        setQuantity((currentQuantity) => {
          const currentValue = parseQuantity(currentQuantity);
          return currentValue == null || currentValue < nextItemCount
            ? String(nextItemCount)
            : currentQuantity;
        });
        return next;
      });
    }
    if (failedCount > 0) {
      Alert.alert(
        failedCount === assets.length ? '导入失败' : '部分图片未导入',
        failedCount === assets.length
          ? '图片过大或格式异常，未能完成处理。'
          : `有 ${failedCount} 张图片未能完成处理。`,
      );
    }
  }, [retainedEmptyItemCount, retainedExistingItemCount]);

  const handlePickPhotos = useCallback(async () => {
    if (isHandlingPhotos) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      showPhotoLibraryPermissionAlert();
      return;
    }
    setPhotoPickerPending(true);
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        selectionLimit: PHOTO_PICKER_SELECTION_LIMIT,
      });
    } finally {
      setPhotoPickerPending(false);
    }
    if (!result.canceled) {
      await importPhotos(result.assets.slice(0, PHOTO_PICKER_SELECTION_LIMIT));
    }
  }, [importPhotos, isHandlingPhotos]);

  const handleTakePhoto = useCallback(async () => {
    if (isHandlingPhotos) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      showCameraPermissionAlert();
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) await importPhotos(result.assets.slice(0, 1));
  }, [importPhotos, isHandlingPhotos]);

  const removePendingPhoto = useCallback((uri: string) => {
    setPendingPhotoUris((current) => current.filter((value) => value !== uri));
    void cleanupPendingImportedPhotos([uri]);
  }, [cleanupPendingImportedPhotos]);

  const removeExistingItem = useCallback((itemId: string) => {
    if ((parsedQuantity ?? 1) <= 1) {
      Alert.alert('至少保留一张拍立得', '如需移除整条记录，请在记录详情中删除。');
      return;
    }
    Alert.alert(
      '移除这张拍立得？',
      '保存后会同时减少记录数量。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '移除',
          style: 'destructive',
          onPress: () => {
            setPendingRemovedItemIds((current) => (
              current.includes(itemId) ? current : [...current, itemId]
            ));
            setQuantity((current) => String(Math.max(1, (parseQuantity(current) ?? 1) - 1)));
          },
        },
      ],
    );
  }, [parsedQuantity]);

  const restoreExistingItem = useCallback((itemId: string) => {
    setPendingRemovedItemIds((current) => current.filter((value) => value !== itemId));
    setQuantity((current) => String((parseQuantity(current) ?? 0) + 1));
  }, []);

  const minimumQuantity = Math.max(1, requiredItemCount);
  const changeQuantity = useCallback((next: string) => {
    const digits = next.replace(/\D/g, '');
    const value = parseQuantity(digits);
    if (value != null && value < requiredItemCount) {
      Alert.alert(
        '数量不能减少',
        `当前操作至少需要保留 ${requiredItemCount} 张拍立得。`,
      );
      return;
    }
    setQuantity(digits);
  }, [requiredItemCount]);

  const selectedArtist = useMemo(
    () => artists.find((artist) => artist.id === selectedArtistId) ?? null,
    [artists, selectedArtistId],
  );
  const applyLatestArtistPrice = useCallback(async (artistId: string) => {
    if (priceTouchedRef.current) return;
    const requestId = ++lastPriceRequestRef.current;
    try {
      const latestUnitPrice = await db.chekiRecords.findLatestUnitPriceByArtistId(artistId);
      if (requestId !== lastPriceRequestRef.current || priceTouchedRef.current) return;
      setUnitPrice(latestUnitPrice == null ? '' : String(latestUnitPrice));
    } catch {
      // 上次价格只用于辅助输入，查询失败不阻塞当前记录。
    }
  }, [db]);

  useEffect(() => {
    if (
      loading
      || mode !== 'create'
      || !initialArtistId
      || initialPriceAppliedRef.current
    ) return;
    initialPriceAppliedRef.current = true;
    void applyLatestArtistPrice(initialArtistId);
  }, [applyLatestArtistPrice, initialArtistId, loading, mode]);

  const confirmNoArtist = useCallback(() => {
    const applyDecision = () => {
      lastPriceRequestRef.current += 1;
      setSelectedArtistId(null);
      setArtistDecision('none');
      setArtistSearch('');
    };

    const focusedInput = TextInput.State.currentlyFocusedInput?.() ?? null;
    if (!Keyboard.isVisible() && !focusedInput) {
      applyDecision();
      return;
    }

    let completed = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (completed) return;
      completed = true;
      keyboardHiddenSubscription.remove();
      if (fallbackTimer != null) clearTimeout(fallbackTimer);
      applyDecision();
    };
    const keyboardHiddenSubscription = Keyboard.addListener('keyboardDidHide', finish);
    Keyboard.dismiss();
    fallbackTimer = setTimeout(finish, 300);
  }, []);
  const artistNameMap = useMemo(
    () => Object.fromEntries(artists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [artists],
  );
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const filteredEvents = useMemo(
    () => eventSearch.trim()
      ? events.filter((event) => (
        event.event_date.includes(eventSearch.trim())
        || event.title.toLowerCase().includes(eventSearch.trim().toLowerCase())
      )).slice(0, 30)
      : [],
    [eventSearch, events],
  );

  useEffect(() => {
    if (!selectedEventId && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setEventSearch(date);
    }
  }, [date, selectedEventId]);

  const parsedUnitPrice = parseUnitPrice(unitPrice);
  const retainedTotalPrice = retainedExistingItems.reduce(
    (sum, item) => sum + item.unit_price,
    0,
  );
  const newItemCount = parsedQuantity == null
    ? 0
    : Math.max(0, parsedQuantity - retainedExistingItemCount);
  const calculatedTotal = parsedQuantity != null && parsedUnitPrice != null
    ? retainedTotalPrice + newItemCount * parsedUnitPrice
    : null;
  const unitPriceValid = parsedUnitPrice != null;
  const dateValid = date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date);
  const artistValid = artistDecision !== 'unconfirmed'
    && (artistDecision !== 'selected' || selectedArtist != null);
  const canSave = !loading
    && !saving
    && !isHandlingPhotos
    && parsedQuantity != null
    && parsedQuantity >= requiredItemCount
    && artistValid
    && dateValid
    && unitPriceValid;

  const handleSave = useCallback(async () => {
    if (!canSave || parsedQuantity == null) return;
    setSaving(true);
    try {
      const input = {
        artist_id: artistDecision === 'selected' ? selectedArtistId : null,
        event_id: selectedEventId,
        date: date || null,
        quantity: parsedQuantity,
        notes: notes.trim() || null,
      };
      if (mode === 'create') {
        const created = await db.chekiRecords.createRecordWithItems({
          ...input,
          unit_price: parsedUnitPrice ?? 0,
          spec: newItemSpec,
          items: pendingPhotoUris.map((frontUri) => ({ frontUri, spec: newItemSpec })),
        });
        pendingImportedPhotoUrisRef.current.clear();
        allowNavigationRef.current = true;
        router.replace(`/cheki/records/${created.id}`);
      } else if (recordId) {
        await db.chekiRecords.updateRecordWithItemChanges(
          recordId,
          input,
          {
            add: pendingPhotoUris.map((frontUri) => ({ frontUri, spec: newItemSpec })),
            removeItemIds: pendingRemovedItemIds,
            defaultUnitPrice: parsedUnitPrice ?? 0,
            defaultSpec: newItemSpec,
          },
        );
        pendingImportedPhotoUrisRef.current.clear();
        allowNavigationRef.current = true;
        router.back();
      }
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setSaving(false);
    }
  }, [
    artistDecision,
    canSave,
    date,
    db,
    mode,
    notes,
    newItemSpec,
    parsedQuantity,
    parsedUnitPrice,
    pendingPhotoUris,
    pendingRemovedItemIds,
    recordId,
    selectedArtistId,
    selectedEventId,
  ]);

  const thumbnailSize = Math.floor((screenWidth - 64 - 16) / 3);
  const photoStatus = photoImportProgress
    ? `正在处理 ${photoImportProgress.current} / ${photoImportProgress.total} 张图片`
    : photoPickerPending ? '正在读取所选图片' : null;

  if (loading) {
    return (
      <SafeAreaView
        edges={SCROLL_SCREEN_SAFE_AREA_EDGES}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}
      >
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          title: mode === 'create' ? '添加拍立得记录' : '编辑拍立得记录',
          headerShadowVisible: false,
          headerLeft: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={leaveForm} disabled={saving}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={handleSave} disabled={!canSave}>
              {saving ? <ActivityIndicator size="small" color={colors.accent} /> : (
                <Text style={{ color: canSave ? colors.accent : colors.chevron, fontSize: 16, fontWeight: '700' }}>
                  保存
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        left={{ label: '取消', onPress: leaveForm, disabled: saving || isHandlingPhotos }}
        right={{ label: saving ? '保存中' : '保存', onPress: handleSave, disabled: !canSave, variant: 'done' }}
      />

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'android' ? 180 : 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        enableAutomaticScroll
        extraHeight={140}
        onLayout={() => {
          if (focusImages) {
            requestAnimationFrame(() => scrollRef.current?.scrollToPosition(0, 180, false));
          }
        }}
      >
        <FormSectionLabel label="拍立得" />
        <FormCard>
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              已添加 {addedPhotoCount}{parsedQuantity == null ? '' : ` / ${parsedQuantity}`} 张图片
            </Text>
          </View>

          {hasAddedPhotos ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {record?.items.map((item) => {
                const uri = getItemPreviewUri(item);
                const isRemoved = pendingRemovedItemIdSet.has(item.id);
                return uri ? (
                  <View key={item.id}>
                    <Image
                      source={{ uri }}
                      resizeMethod="resize"
                      resizeMode="contain"
                      style={{
                        width: thumbnailSize,
                        height: thumbnailSize / getChekiSpecAspectRatio(item.spec),
                        borderRadius: 10,
                        opacity: isRemoved ? 0.28 : 1,
                        backgroundColor: colors.cardAlt,
                      }}
                    />
                    {isRemoved ? (
                      <TouchableOpacity
                        onPress={() => restoreExistingItem(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel="撤销移除这张拍立得"
                        style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.scrim }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onAccent }}>撤销移除</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => removeExistingItem(item.id)}
                        disabled={isHandlingPhotos}
                        accessibilityRole="button"
                        accessibilityLabel="移除已有图片"
                        style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim }}
                      >
                        <AppIcon name="close" size={13} color={colors.onAccent} />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null;
              })}
              {pendingPhotoUris.map((uri) => (
                <View key={uri}>
                  <Image
                    source={{ uri }}
                    resizeMethod="resize"
                    resizeMode="contain"
                    style={{ width: thumbnailSize, height: thumbnailSize / getChekiSpecAspectRatio(newItemSpec), borderRadius: 10, backgroundColor: colors.cardAlt }}
                  />
                  <TouchableOpacity
                    onPress={() => removePendingPhoto(uri)}
                    disabled={isHandlingPhotos}
                    accessibilityLabel="移除本次添加的图片"
                    style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim }}
                  >
                    <AppIcon name="close" size={13} color={colors.onAccent} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingVertical: 26, alignItems: 'center' }}>
              <AppIcon name="image" size={30} color={colors.textMuted} />
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
                每张图片对应一张拍立得。
              </Text>
            </View>
          )}

          {photoStatus ? (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{photoStatus}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              onPress={handleTakePhoto}
              disabled={isHandlingPhotos}
              style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: colors.accent, opacity: isHandlingPhotos ? 0.5 : 1 }}
            >
              <AppIcon name="camera" size={16} color={colors.onAccent} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.onAccent }}>拍摄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickPhotos}
              disabled={isHandlingPhotos}
              style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: colors.cardAlt, opacity: isHandlingPhotos ? 0.5 : 1 }}
            >
              <AppIcon name="image" size={16} color={colors.accent} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>从相册选择</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 1, marginTop: 20, marginBottom: 16, backgroundColor: colors.divider }} />

          <FormFieldLabel required>拍立得数量</FormFieldLabel>
          <View style={{
            height: 46,
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: quantity !== '' && parsedQuantity == null ? colors.danger : colors.inputBorder,
            borderRadius: 10,
            backgroundColor: colors.input,
          }}>
            <TouchableOpacity
              onPress={() => changeQuantity(String(Math.max(minimumQuantity, (parsedQuantity ?? minimumQuantity) - 1)))}
              disabled={parsedQuantity == null || parsedQuantity <= minimumQuantity}
              style={{ width: 46, height: '100%', alignItems: 'center', justifyContent: 'center', opacity: parsedQuantity == null || parsedQuantity <= minimumQuantity ? 0.4 : 1 }}
            >
              <AppIcon name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              value={quantity}
              onChangeText={changeQuantity}
              keyboardType="number-pad"
              returnKeyType="done"
              selectTextOnFocus
              style={{ flex: 1, height: '100%', textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.inputBorder }}
            />
            <TouchableOpacity
              onPress={() => changeQuantity(String((parsedQuantity ?? Math.max(0, requiredItemCount)) + 1))}
              style={{ width: 46, height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
            {hasAddedPhotos ? '数量可多于图片数。' : '可直接填写数量。'}
          </Text>
        </FormCard>

        <FormSectionLabel label="记录信息" />
        <FormCard>
          <FormFieldLabel required>艺人</FormFieldLabel>
          {artistDecision === 'none' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: colors.cardMuted }}>
              <AppIcon name="artists" size={18} color={colors.textMuted} />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>未关联艺人</Text>
              <TouchableOpacity onPress={() => setArtistDecision('unconfirmed')}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>取消</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ArtistSearchPicker
                artists={artists}
                selectedIds={selectedArtistId ? [selectedArtistId] : []}
                selectedArtists={selectedArtist ? [selectedArtist] : []}
                oshiArtistId={oshiArtistId}
                isDark={isDark}
                typePreference="person"
                searchValue={artistSearch}
                onSearchChange={setArtistSearch}
                onSelectArtist={(artist) => {
                  setSelectedArtistId(artist.id);
                  setArtistDecision('selected');
                  setArtistSearch('');
                  void applyLatestArtistPrice(artist.id);
                }}
                onRemoveArtist={() => {
                  lastPriceRequestRef.current += 1;
                  setSelectedArtistId(null);
                  setArtistDecision('unconfirmed');
                }}
                parentNameMap={artistNameMap}
                maxHeight={220}
                emptyText="没有找到匹配的艺人"
                idleEmptyText="输入关键词搜索艺人"
              />
              {artistDecision === 'unconfirmed' ? (
                <TouchableOpacity
                  onPress={confirmNoArtist}
                  style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>暂不关联艺人</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          <View style={{ marginTop: 14 }}>
            <FormFieldLabel>日期</FormFieldLabel>
            <TextInput
              value={date}
              onChangeText={(value) => setDate(formatDateInput(value))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              returnKeyType="done"
              style={{ height: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: dateValid ? colors.inputBorder : colors.danger, backgroundColor: colors.input, fontSize: 15, color: colors.text }}
            />
            {!dateValid ? <Text style={{ marginTop: 6, fontSize: 12, color: colors.danger }}>日期格式应为 YYYY-MM-DD</Text> : null}
          </View>

          <View style={{ marginTop: 14 }}>
            <FormFieldLabel>活动</FormFieldLabel>
            {selectedEvent ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: colors.accentSofter }}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>{selectedEvent.title}</Text>
                  <Text style={{ marginTop: 2, fontSize: 11, color: withAlpha(colors.accent, 0.68) }}>{selectedEvent.event_date}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedEventId(null)} hitSlop={8}>
                  <AppIcon name="closeCircle" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.cardMuted }}>
                  <AppIcon name="search" size={14} color={colors.placeholder} />
                  <TextInput
                    value={eventSearch}
                    onChangeText={setEventSearch}
                    placeholder="搜索日期或活动名称"
                    placeholderTextColor={colors.placeholder}
                    returnKeyType="search"
                    style={{ flex: 1, fontSize: 13, color: colors.text }}
                  />
                </View>
                {eventSearch.trim() ? (
                  <View style={{ marginTop: 8, maxHeight: 220, overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder }}>
                    {filteredEvents.length > 0 ? filteredEvents.map((event, index) => (
                      <TouchableOpacity
                        key={event.id}
                        onPress={() => {
                          setSelectedEventId(event.id);
                          setEventSearch('');
                        }}
                        style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: index === filteredEvents.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 14, color: colors.text }}>{event.title}</Text>
                        <Text style={{ marginTop: 2, fontSize: 11, color: colors.textMuted }}>{event.event_date}</Text>
                      </TouchableOpacity>
                    )) : (
                      <Text style={{ padding: 14, textAlign: 'center', fontSize: 13, color: colors.textMuted }}>没有找到匹配的活动</Text>
                    )}
                  </View>
                ) : null}
              </>
            )}
          </View>
        </FormCard>

        <FormSectionLabel label="价格" />
        <FormCard>
          <FormFieldLabel>
            {mode === 'create' ? '单价（每张）' : '新增拍立得默认单价'}
          </FormFieldLabel>
          <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: unitPriceValid ? colors.inputBorder : colors.danger, backgroundColor: colors.input }}>
            <Text style={{ marginRight: 6, fontSize: 15, color: colors.textMuted }}>¥</Text>
            <TextInput
              value={unitPrice}
              onChangeText={(value) => {
                priceTouchedRef.current = true;
                setUnitPrice(value.replace(/\D/g, ''));
              }}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              returnKeyType="done"
              style={{ flex: 1, fontSize: 15, color: colors.text }}
            />
          </View>
          {calculatedTotal != null ? (
            <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
              {mode === 'create'
                ? `¥${parsedUnitPrice ?? 0} × ${parsedQuantity ?? 0} 张，合计 ¥${calculatedTotal}`
                : newItemCount > 0
                  ? `现有 ¥${retainedTotalPrice} + 新增 ${newItemCount} 张，合计 ¥${calculatedTotal}`
                  : `现有拍立得合计 ¥${calculatedTotal}`}
            </Text>
          ) : null}
          {mode === 'edit' ? (
            <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 18, color: colors.textMuted }}>
              这里只设置本次新增拍立得的单价；已有单价请在单张编辑页修改。
            </Text>
          ) : null}
        </FormCard>

        <FormSectionLabel label="备注" />
        <FormCard>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="记录这次拍摄或购买的信息"
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 100, padding: 12, borderRadius: 10, backgroundColor: colors.input, fontSize: 14, lineHeight: 21, color: colors.text }}
          />
        </FormCard>

        <FormSectionLabel label="高级信息" />
        <TouchableOpacity
          onPress={() => setAdvancedExpanded((current) => !current)}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedExpanded }}
          style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
              {mode === 'create' ? '拍立得规格' : '新增拍立得规格'}
            </Text>
            <Text style={{ marginTop: 3, fontSize: 12, color: colors.textSecondary }}>
              {getChekiSpecLabel(newItemSpec)}
            </Text>
          </View>
          <AppIcon name="disclosure" variant={advancedExpanded ? 'down' : 'forward'} size={16} color={colors.chevron} />
        </TouchableOpacity>
        {advancedExpanded ? (
          <FormCard style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CHEKI_SPECS.map((option) => {
                const selected = option.id === newItemSpec;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setNewItemSpec(option.id)}
                    activeOpacity={0.72}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={{ minHeight: 44, paddingHorizontal: 13, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.cardAlt, borderWidth: 1, borderColor: selected ? colors.accent : colors.inputBorder }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? colors.onAccent : colors.text }}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {mode === 'edit' ? (
              <Text style={{ marginTop: 10, fontSize: 12, lineHeight: 18, color: colors.textMuted }}>
                只应用于本次新增的拍立得，不修改已有规格。
              </Text>
            ) : null}
          </FormCard>
        ) : null}

        <View style={{ paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
            共 {parsedQuantity ?? 0} 张
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary }}>
            已添加 {addedPhotoCount} 张图片
            {pendingRemovedItemIds.length > 0 ? `，待移除 ${pendingRemovedItemIds.length} 张` : ''}
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

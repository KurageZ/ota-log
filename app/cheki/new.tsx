import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Platform,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { AppIcon } from '../../src/components/AppIcon';
import { FormCard, FormFieldLabel, FormSectionLabel } from '../../src/components/FormPrimitives';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDB } from '../../src/context/DBContext';
import { Artist, Event } from '../../src/types/models';
import { toISODate } from '../../src/utils/date';
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { getArtistDisplayText, getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { copyToDocuments } from '../../src/utils/copyToDocuments';
import { deleteLocalFileIfUnreferenced } from '../../src/utils/localMedia';
import { calculateManualChekiTotalPrice } from '../../src/utils/cheki';
import { OshiAvatar, OshiBadge } from '../../src/components/Oshi';
import { ArtistSearchPicker } from '../../src/components/ArtistSearchPicker';
import {
  showCameraPermissionAlert,
  showPhotoLibraryPermissionAlert,
  showSaveFailedAlert,
} from '../../src/utils/failureAlert';
import { useAppTheme } from '../../src/theme/appTheme';
import { withAlpha } from '../../src/utils/color';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const MAX_MULTI_PHOTOS = 9;
const CHEKI_IMPORT_MAX_DIMENSION = Platform.OS === 'android' ? 1600 : 2000;

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function waitForInteractionsToFinish(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, 0);
    });
  });
}

function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

function parseManualEntryCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function parseNonNegativeAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export default function NewChekiScreen() {
  const {
    artist_id: prefilledArtistId,
    event_id: prefilledEventId,
    source,
    mode,
    date: prefilledDate,
  } = useLocalSearchParams<{
    artist_id?: string;
    event_id?: string;
    source?: 'camera' | 'library';
    mode?: 'manual';
    date?: string;
  }>();
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [lockedArtist, setLockedArtist] = useState<Artist | null>(null);
  const [lockedEvent, setLockedEvent] = useState<Event | null>(null);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState('');
  const [date, setDate] = useState(prefilledDate ?? toISODate(new Date()));
  const [unitPrice, setUnitPrice] = useState('');
  const [count, setCount] = useState('1');
  const [manualUnitPrice, setManualUnitPrice] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isManualMode, setIsManualMode] = useState(mode === 'manual');
  const [photoPickerPending, setPhotoPickerPending] = useState(false);
  const [photoImportProgress, setPhotoImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const isImportingPhotos = photoImportProgress != null;
  const isHandlingPhotoSelection = photoPickerPending || isImportingPhotos;
  const pendingImportedPhotoUrisRef = useRef<Set<string>>(new Set());
  const photoPriceTouchedRef = useRef(false);
  const manualPriceTouchedRef = useRef(false);
  const lastPriceRequestRef = useRef(0);
  const manualCountRef = useRef(count);
  manualCountRef.current = count;

  useEffect(() => {
    if (prefilledArtistId) {
      db.artists.findById(prefilledArtistId).then(setLockedArtist);
    }
    if (prefilledEventId) {
      db.events.findById(prefilledEventId).then(setLockedEvent);
    }
    Promise.all([
      prefilledArtistId ? Promise.resolve([] as Artist[]) : db.artists.findAll(),
      db.events.findAll(),
      db.userConfig.getConfig(),
    ]).then(([artists, events, config]) => {
      setAllArtists(artists);
      setAllEvents(events);
      setOshiArtistId(config.oshi_artist_id);
    });
  }, [db, prefilledArtistId, prefilledEventId]);

  useEffect(() => {
    if (!selectedEventId && !prefilledEventId) {
      setEventSearch(date);
    }
  }, [date, selectedEventId, prefilledEventId]);

  const appendPhotoUris = useCallback((newUris: string[]) => {
    setPhotoUris((prev) => {
      const remaining = MAX_MULTI_PHOTOS - prev.length;
      if (remaining <= 0) return prev;
      return [...prev, ...newUris.slice(0, remaining)];
    });
  }, []);

  const cleanupPendingImportedPhotos = useCallback(async (uris?: string[]) => {
    const targets = uris ?? Array.from(pendingImportedPhotoUrisRef.current);
    const uniqueTargets = Array.from(new Set(targets));

    for (const uri of uniqueTargets) {
      pendingImportedPhotoUrisRef.current.delete(uri);
      await deleteLocalFileIfUnreferenced(db.rawDb, uri);
    }
  }, [db]);

  useEffect(() => () => {
    void cleanupPendingImportedPhotos();
  }, [cleanupPendingImportedPhotos]);

  const importChekiPhotos = useCallback(async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (assets.length === 0) return;

    setPhotoImportProgress({ current: 0, total: assets.length });
    await waitForNextFrame();
    await waitForInteractionsToFinish();

    let failedCount = 0;
    try {
      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        try {
          const permanentUri = await copyToDocuments(asset.uri, {
            filenamePrefix: 'cheki',
            maxDimension: CHEKI_IMPORT_MAX_DIMENSION,
            sourceSize: (
              typeof asset.width === 'number'
              && asset.width > 0
              && typeof asset.height === 'number'
              && asset.height > 0
            ) ? { width: asset.width, height: asset.height } : null,
          });
          pendingImportedPhotoUrisRef.current.add(permanentUri);
          appendPhotoUris([permanentUri]);
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

    if (failedCount > 0) {
      Alert.alert(
        failedCount === assets.length ? '导入失败' : '部分图片未导入',
        failedCount === assets.length
          ? '图片过大或格式异常，未能完成处理。建议先在系统相册中压缩或裁剪后再试。'
          : `有 ${failedCount} 张图片过大或格式异常，未能完成处理。`,
      );
    }
  }, [appendPhotoUris]);

  const handleTakePhoto = useCallback(async () => {
    if (isManualMode || isHandlingPhotoSelection) return;
    if (photoUris.length >= MAX_MULTI_PHOTOS) {
      Alert.alert('最多选择 9 张', `一次最多保留 ${MAX_MULTI_PHOTOS} 张拍立得。`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showCameraPermissionAlert();
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    await importChekiPhotos(result.assets.slice(0, 1));
  }, [importChekiPhotos, isHandlingPhotoSelection, isManualMode, photoUris.length]);

  const handlePickFromLibrary = useCallback(async () => {
    if (isManualMode || isHandlingPhotoSelection) return;
    const remaining = MAX_MULTI_PHOTOS - photoUris.length;
    if (remaining <= 0) {
      Alert.alert('最多选择 9 张', `一次最多保留 ${MAX_MULTI_PHOTOS} 张拍立得。`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showPhotoLibraryPermissionAlert();
      return;
    }
    setPhotoPickerPending(true);
    await waitForNextFrame();

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
    } finally {
      setPhotoPickerPending(false);
    }
    if (result.canceled) return;

    const assetsToCopy = result.assets.slice(0, remaining);
    if (result.assets.length > remaining) {
      Alert.alert('最多选择 9 张', `最多还能再添加 ${remaining} 张拍立得。`);
    }

    await importChekiPhotos(assetsToCopy);
  }, [importChekiPhotos, isHandlingPhotoSelection, isManualMode, photoUris.length]);

  const handleRemovePhoto = useCallback((uri: string) => {
    if (isHandlingPhotoSelection) return;
    setPhotoUris((prev) => prev.filter((item) => item !== uri));
    void cleanupPendingImportedPhotos([uri]);
  }, [cleanupPendingImportedPhotos, isHandlingPhotoSelection]);

  const applyLastPrice = useCallback(async (artistId: string, targetMode: 'photo' | 'manual') => {
    if (targetMode === 'photo' && photoPriceTouchedRef.current) return;
    if (targetMode === 'manual' && manualPriceTouchedRef.current) return;

    const requestId = lastPriceRequestRef.current + 1;
    lastPriceRequestRef.current = requestId;
    const chekis = await db.cheki.findByArtistId(artistId);
    if (requestId !== lastPriceRequestRef.current) return;

    const lastPrice = chekis[0]?.price;

    if (targetMode === 'photo') {
      if (photoPriceTouchedRef.current) return;
      setUnitPrice(lastPrice != null ? String(lastPrice) : '');
      return;
    }
    if (manualPriceTouchedRef.current) return;

    if (lastPrice == null) {
      setManualUnitPrice('');
      setTotalPrice('');
      return;
    }

    const priceText = String(lastPrice);
    setManualUnitPrice(priceText);
    const parsedCount = parseManualEntryCount(manualCountRef.current);
    if (parsedCount != null) {
      const calculatedTotal = calculateManualChekiTotalPrice(parsedCount, lastPrice);
      if (calculatedTotal != null) {
        setTotalPrice(String(calculatedTotal));
      }
    }
  }, [db]);

  const autoLaunched = useRef(false);
  useEffect(() => {
    if (autoLaunched.current) return;
    if (isManualMode) {
      if (source === 'camera' || source === 'library') {
        autoLaunched.current = true;
      }
      return;
    }
    autoLaunched.current = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (source === 'camera') {
      timeoutId = setTimeout(handleTakePhoto, 300);
    } else if (source === 'library') {
      timeoutId = setTimeout(handlePickFromLibrary, 300);
    }
    return () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    };
  }, [handlePickFromLibrary, handleTakePhoto, isManualMode, source]);

  useEffect(() => {
    if (!prefilledArtistId) return;

    if (isManualMode) {
      if (manualUnitPrice === '' && totalPrice === '') {
        void applyLastPrice(prefilledArtistId, 'manual');
      }
    } else if (unitPrice === '') {
      void applyLastPrice(prefilledArtistId, 'photo');
    }
  }, [
    applyLastPrice,
    isManualMode,
    manualUnitPrice,
    prefilledArtistId,
    totalPrice,
    unitPrice,
  ]);

  const selectedArtist = useMemo(
    () => allArtists.find((artist) => artist.id === selectedArtistId) ?? null,
    [allArtists, selectedArtistId],
  );
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const filteredEvents = useMemo(
    () => eventSearch.trim()
      ? allEvents.filter((event) => event.event_date.includes(eventSearch.trim()))
      : [],
    [allEvents, eventSearch],
  );
  const selectedEvent = useMemo(
    () => allEvents.find((event) => event.id === selectedEventId) ?? null,
    [allEvents, selectedEventId],
  );

  const switchToManualMode = useCallback(() => {
    if (isHandlingPhotoSelection) return;
    const applySwitch = () => {
      const urisToCleanup = [...photoUris];
      setPhotoUris([]);
      setIsManualMode(true);
      void cleanupPendingImportedPhotos(urisToCleanup);
      const artistId = prefilledArtistId ?? selectedArtistId;
      if (artistId) {
        void applyLastPrice(artistId, 'manual');
      }
    };
    if (photoUris.length > 0) {
      Alert.alert(
        '切换为无图模式',
        '切换模式会清空已选择的图片，是否继续？',
        [
          { text: '取消', style: 'cancel' },
          { text: '继续', style: 'destructive', onPress: applySwitch },
        ],
      );
      return;
    }
    applySwitch();
  }, [
    applyLastPrice,
    cleanupPendingImportedPhotos,
    isHandlingPhotoSelection,
    photoUris,
    prefilledArtistId,
    selectedArtistId,
  ]);

  const switchToPhotoMode = useCallback(() => {
    if (isHandlingPhotoSelection) return;
    setIsManualMode(false);
  }, [isHandlingPhotoSelection]);
  const updateCalculatedTotalPrice = useCallback((nextCount: string, nextUnitPrice: string) => {
    const parsedCount = parseManualEntryCount(nextCount);
    const parsedUnitPrice = parseNonNegativeAmount(nextUnitPrice);
    if (parsedCount == null || parsedUnitPrice == null || Number.isNaN(parsedUnitPrice)) return;

    const calculatedTotal = calculateManualChekiTotalPrice(parsedCount, parsedUnitPrice);
    if (calculatedTotal != null) {
      setTotalPrice(String(calculatedTotal));
    }
  }, []);
  const handleManualCountChange = useCallback((value: string) => {
    const nextCount = value.replace(/\D/g, '');
    setCount(nextCount);
    updateCalculatedTotalPrice(nextCount, manualUnitPrice);
  }, [manualUnitPrice, updateCalculatedTotalPrice]);
  const handleManualUnitPriceChange = useCallback((value: string) => {
    manualPriceTouchedRef.current = true;
    setManualUnitPrice(value);
    updateCalculatedTotalPrice(count, value);
  }, [count, updateCalculatedTotalPrice]);
  const handleManualTotalPriceChange = useCallback((value: string) => {
    manualPriceTouchedRef.current = true;
    setTotalPrice(value);
    setManualUnitPrice('');
  }, []);
  const handlePhotoUnitPriceChange = useCallback((value: string) => {
    photoPriceTouchedRef.current = true;
    setUnitPrice(value);
  }, []);
  const handleDecreaseCount = useCallback(() => {
    const nextValue = Math.max(1, (parseManualEntryCount(count) ?? 1) - 1);
    setCount(String(nextValue));
    updateCalculatedTotalPrice(String(nextValue), manualUnitPrice);
  }, [count, manualUnitPrice, updateCalculatedTotalPrice]);
  const handleIncreaseCount = useCallback(() => {
    const nextValue = (parseManualEntryCount(count) ?? 0) + 1;
    setCount(String(nextValue));
    updateCalculatedTotalPrice(String(nextValue), manualUnitPrice);
  }, [count, manualUnitPrice, updateCalculatedTotalPrice]);

  const handleSave = async () => {
    if (isHandlingPhotoSelection) {
      return;
    }

    const finalArtistId = prefilledArtistId ?? selectedArtistId;
    const parsedCount = parseManualEntryCount(count);
    const parsedTotalPrice = parseNonNegativeAmount(totalPrice);
    const parsedUnitPrice = parseNonNegativeAmount(unitPrice);
    const parsedManualUnitPrice = parseNonNegativeAmount(manualUnitPrice);

    if (!finalArtistId) {
      Alert.alert('请选择关联艺人');
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('日期格式应为 YYYY-MM-DD');
      return;
    }
    if (isManualMode) {
      if (parsedCount == null) {
        Alert.alert('数量至少为 1');
        return;
      }
      if (Number.isNaN(parsedManualUnitPrice)) {
        Alert.alert('请输入有效的单价');
        return;
      }
      if (parsedManualUnitPrice != null && parsedManualUnitPrice < 0) {
        Alert.alert('单价不能为负数');
        return;
      }
      if (Number.isNaN(parsedTotalPrice)) {
        Alert.alert('请输入有效的总价');
        return;
      }
      if (parsedTotalPrice != null && parsedTotalPrice < 0) {
        Alert.alert('总价不能为负数');
        return;
      }
    } else {
      if (photoUris.length === 0) {
        Alert.alert('请先添加拍立得');
        return;
      }
      if (Number.isNaN(parsedUnitPrice)) {
        Alert.alert('请输入有效的单价');
        return;
      }
      if (parsedUnitPrice != null && parsedUnitPrice < 0) {
        Alert.alert('单价不能为负数');
        return;
      }
    }

    setSaving(true);
    try {
      if (isManualMode) {
        await db.chekiManualEntries.create({
          artist_id: finalArtistId,
          event_id: prefilledEventId ?? selectedEventId ?? null,
          date: date || null,
          count: parsedCount!,
          total_price: parsedTotalPrice != null && !Number.isNaN(parsedTotalPrice) ? parsedTotalPrice : null,
        });
      } else {
        const finalPrice = parsedUnitPrice != null && !Number.isNaN(parsedUnitPrice) ? parsedUnitPrice : null;
        for (const uri of photoUris) {
          await db.cheki.create({
            photo_uri: uri,
            artist_id: finalArtistId,
            event_id: prefilledEventId ?? selectedEventId ?? null,
            date: date || null,
            price: finalPrice,
            notes: notes.trim() || null,
          });
        }
        pendingImportedPhotoUrisRef.current.clear();
      }
      router.back();
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setSaving(false);
    }
  };

  const bg = colors.screen;
  const cardBg = colors.card;
  const parsedCount = parseManualEntryCount(count);
  const parsedTotalPrice = parseNonNegativeAmount(totalPrice);
  const parsedUnitPrice = parseNonNegativeAmount(unitPrice);
  const parsedManualUnitPrice = parseNonNegativeAmount(manualUnitPrice);
  const showCountError = isManualMode && count.trim() !== '' && parsedCount == null;
  const showTotalPriceError = isManualMode && totalPrice.trim() !== '' && (Number.isNaN(parsedTotalPrice) || (parsedTotalPrice != null && parsedTotalPrice < 0));
  const showManualUnitPriceError = isManualMode && manualUnitPrice.trim() !== '' && (Number.isNaN(parsedManualUnitPrice) || (parsedManualUnitPrice != null && parsedManualUnitPrice < 0));
  const showUnitPriceError = !isManualMode && unitPrice.trim() !== '' && (Number.isNaN(parsedUnitPrice) || (parsedUnitPrice != null && parsedUnitPrice < 0));
  const showDateError = date.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date);
  const canSave = isManualMode
    ? !!(prefilledArtistId ?? selectedArtistId) && parsedCount != null && !showManualUnitPriceError && !showTotalPriceError && !showDateError && !saving
    : photoUris.length > 0 && !!(prefilledArtistId ?? selectedArtistId) && !showUnitPriceError && !showDateError && !saving && !isHandlingPhotoSelection;
  const saveLabel = isManualMode ? '保存' : (photoUris.length > 1 ? `保存 ${photoUris.length} 张` : '保存');

  const lockedAvatarSrc = lockedArtist ? resolveAvatarSource(lockedArtist.avatar_uri) : null;
  const lockedIsOshi = lockedArtist?.id === oshiArtistId;
  const lockedDisplay = lockedArtist ? getArtistDisplayText({
    artist: lockedArtist,
    parentName: lockedArtist.parent_id ? artistNameMap[lockedArtist.parent_id] : null,
  }) : null;
  const thumbSize = Math.floor((screenWidth - 64 - 16) / 3);
  const photoModeTotal = (parsedUnitPrice != null && !Number.isNaN(parsedUnitPrice) && parsedUnitPrice >= 0)
    ? parsedUnitPrice * photoUris.length
    : 0;
  const photoImportStatusText = photoImportProgress
    ? (photoImportProgress.current === 0
      ? `正在准备 ${photoImportProgress.total} 张图片`
      : `正在处理第 ${photoImportProgress.current} / ${photoImportProgress.total} 张图片`)
    : null;
  const photoFlowStatusText = photoPickerPending ? '正在读取所选图片…' : photoImportStatusText;
  const photoImportProgressRatio = photoImportProgress
    ? Math.max(0.08, Math.min(photoImportProgress.current / photoImportProgress.total, 1))
    : 0;
  const dateSection = (
    <View style={{ marginTop: 14 }}>
      <FormFieldLabel>日期</FormFieldLabel>
      <TextInput
        style={{
          backgroundColor: colors.input,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: showDateError ? colors.danger : colors.inputBorder,
          paddingHorizontal: 14,
          height: 44,
          fontSize: 15,
          color: colors.text,
        }}
        value={date}
        onChangeText={(value) => setDate(formatDateInput(value))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.placeholder}
        keyboardType="number-pad"
        returnKeyType="done"
      />
      {showDateError ? (
        <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
          日期格式应为 YYYY-MM-DD
        </Text>
      ) : null}
    </View>
  );
  const eventSection = prefilledEventId && lockedEvent ? (
    <>
      <FormFieldLabel>活动</FormFieldLabel>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.input,
        borderRadius: 10,
        padding: 12,
      }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}>
          <AppIcon name="music" size={18} color={colors.accent} />
        </View>
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 }}
          numberOfLines={1}
        >
          {lockedEvent.title}
        </Text>
        <AppIcon name="locked" size={14} color={colors.chevron} />
      </View>
    </>
  ) : !prefilledEventId ? (
    <>
      <FormFieldLabel>活动</FormFieldLabel>
      {selectedEvent ? (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.accentSofter,
          borderRadius: 10,
          padding: 12,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }} numberOfLines={1}>
              {selectedEvent.title}
            </Text>
            <Text style={{ fontSize: 11, color: withAlpha(colors.accent, 0.6), marginTop: 1 }}>
              {selectedEvent.event_date}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedEventId(null);
              setEventSearch('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppIcon name="closeCircle" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
            <AppIcon name="calendar" size={14} color={colors.placeholder} />
            <TextInput
              style={{ flex: 1, fontSize: 13, color: colors.text }}
              placeholder="输入日期搜索关联活动，如 2025-03"
              placeholderTextColor={colors.placeholder}
              value={eventSearch}
              onChangeText={(value) => setEventSearch(formatDateInput(value))}
              clearButtonMode="while-editing"
              keyboardType="number-pad"
              returnKeyType="search"
            />
          </View>
          {eventSearch.trim() ? (
            <View style={{
              borderRadius: 10,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}>
              {filteredEvents.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: isDark ? colors.textMuted : colors.placeholder }}>
                    该日期没有匹配的活动
                  </Text>
                </View>
              ) : filteredEvents.map((event, index) => {
                const isLast = index === filteredEvents.length - 1;
                return (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => {
                      setSelectedEventId(event.id);
                      setEventSearch('');
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: colors.card,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: isDark ? withAlpha(colors.accent, 0.22) : colors.cardAlt,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: isDark ? colors.textMuted : colors.placeholder, marginTop: 1 }}>
                        {event.event_date}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </>
  ) : null;

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: bg }}>
      <Stack.Screen
        options={{
          title: '添加拍立得',
          headerStyle: { backgroundColor: isDark ? colors.screen : colors.card },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (!saving && !isHandlingPhotoSelection) {
                  void cleanupPendingImportedPhotos([...photoUris]);
                  router.back();
                }
              }}
              disabled={saving || isHandlingPhotoSelection}
              style={{ paddingLeft: 4, opacity: saving || isHandlingPhotoSelection ? 0.45 : 1 }}
            >
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={!canSave} style={{ paddingRight: 4 }}>
              {saving || isHandlingPhotoSelection ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={{ color: canSave ? colors.accent : colors.chevron, fontSize: 16, fontWeight: '700' }}>
                  {saveLabel}
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'android' ? 200 : 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableAutomaticScroll
        extraHeight={140}
        extraScrollHeight={20}
      >
        <FormSectionLabel label="图片" />
        <FormCard>
          <FormFieldLabel>拍立得</FormFieldLabel>

          {isManualMode ? (
            <View style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              borderStyle: 'dashed',
              paddingVertical: 30,
              alignItems: 'center',
            }}>
              <AppIcon name="document" size={28} color={colors.textSecondary} />
              <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '600', color: isDark ? colors.heading : colors.textSecondary }}>
                无图模式
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, color: isDark ? colors.textMuted : colors.placeholder }}>
                当前改为记录数量与总价，不需要上传图片
              </Text>
            </View>
          ) : photoUris.length === 0 ? (
            <>
              <View
                style={{
                  paddingVertical: 40,
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: colors.inputBorder,
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              >
                <AppIcon name="camera" size={32} color={isDark ? colors.textMuted : colors.placeholder} style={{ marginBottom: 8 }} />
                <Text style={{ fontSize: 14, color: isDark ? colors.textMuted : colors.placeholder }}>拍摄或从相册选择图片，最多 9 张</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={handleTakePhoto}
                  disabled={isHandlingPhotoSelection}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: colors.accent,
                    opacity: isHandlingPhotoSelection ? 0.5 : 1,
                  }}
                >
                  <AppIcon name="camera" size={16} color={colors.onAccent} />
                  <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 14 }}>拍摄</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePickFromLibrary}
                  disabled={isHandlingPhotoSelection}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: isDark ? colors.input : colors.cardAlt,
                    opacity: isHandlingPhotoSelection ? 0.5 : 1,
                  }}
                >
                  <AppIcon name="image" size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>相册</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                  已选 {photoUris.length} / {MAX_MULTI_PHOTOS} 张
                </Text>
                <Text style={{ fontSize: 12, color: isDark ? colors.textMuted : colors.placeholder }}>
                  批量添加共用同一组信息
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {photoUris.map((uri) => (
                  <View key={uri} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri }}
                      resizeMethod="resize"
                      style={{
                        width: thumbSize,
                        height: thumbSize,
                        borderRadius: 8,
                        backgroundColor: isDark ? colors.inputBorder : colors.cardAlt,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(uri)}
                      disabled={isHandlingPhotoSelection}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        backgroundColor: colors.scrim,
                        borderRadius: 12,
                        padding: 5,
                        opacity: isHandlingPhotoSelection ? 0.45 : 1,
                      }}
                    >
                      <AppIcon name="close" size={12} color={colors.onAccent} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={handleTakePhoto}
                  disabled={photoUris.length >= MAX_MULTI_PHOTOS || isHandlingPhotoSelection}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: photoUris.length >= MAX_MULTI_PHOTOS || isHandlingPhotoSelection ? colors.inputBorder : colors.accent,
                  }}
                >
                  <AppIcon name="camera" size={16} color={photoUris.length >= MAX_MULTI_PHOTOS || isHandlingPhotoSelection ? colors.textSecondary : colors.onAccent} />
                  <Text style={{ color: photoUris.length >= MAX_MULTI_PHOTOS || isHandlingPhotoSelection ? colors.textSecondary : colors.onAccent, fontWeight: '700', fontSize: 14 }}>
                    继续拍摄
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePickFromLibrary}
                  disabled={photoUris.length >= MAX_MULTI_PHOTOS || isHandlingPhotoSelection}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: isDark ? colors.input : colors.cardAlt,
                    opacity: photoUris.length >= MAX_MULTI_PHOTOS || isHandlingPhotoSelection ? 0.5 : 1,
                  }}
                >
                  <AppIcon name="image" size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>继续选择</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </FormCard>

        <TouchableOpacity
          onPress={isManualMode ? switchToPhotoMode : switchToManualMode}
          disabled={isHandlingPhotoSelection}
          activeOpacity={0.75}
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: isHandlingPhotoSelection ? 0.55 : 1,
          }}
        >
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: isManualMode ? withAlpha(colors.accent, 0.18) : withAlpha(colors.accent, 0.1),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AppIcon
              name={isManualMode ? 'statusCompleted' : 'document'}
              size={20}
              color={colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
              {isManualMode ? '已启用无图模式' : '无图模式'}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }}>
              {isManualMode ? '切换回有图模式后，可继续拍摄或从相册加入图片' : '没有图片时，可直接记录数量与总价'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
            {isManualMode ? '关闭' : '开启'}
          </Text>
        </TouchableOpacity>

        <FormSectionLabel label="拍立得信息" />
        <FormCard>
          <FormFieldLabel required>艺人</FormFieldLabel>

          {lockedArtist ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.input,
              borderRadius: 10,
              padding: 12,
            }}>
              <View style={{ marginRight: 10 }}>
                <OshiAvatar source={lockedAvatarSrc} size={36} isOshi={lockedIsOshi} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>
                    {lockedDisplay?.title}
                  </Text>
                  {lockedIsOshi ? <OshiBadge /> : null}
                </View>
                {lockedDisplay?.subtitle ? (
                  <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }}>
                    {lockedDisplay.subtitle}
                  </Text>
                ) : null}
              </View>
              <AppIcon name="locked" size={14} color={colors.chevron} />
            </View>
          ) : (
            <ArtistSearchPicker
              artists={allArtists}
              selectedArtists={selectedArtist ? [selectedArtist] : []}
              selectedIds={selectedArtistId ? [selectedArtistId] : []}
              oshiArtistId={oshiArtistId}
              isDark={isDark}
              searchValue={artistSearch}
              onSearchChange={setArtistSearch}
              placeholder="搜索艺人..."
              maxHeight={240}
              parentNameMap={artistNameMap}
              emptyText={allArtists.length === 0 ? '还没有艺人，请先在「我的」添加艺人' : '没有找到匹配的艺人'}
              onSelectArtist={(artist) => {
                setSelectedArtistId(artist.id);
                void applyLastPrice(artist.id, isManualMode ? 'manual' : 'photo');
              }}
              onRemoveArtist={() => setSelectedArtistId(null)}
            />
          )}

          {isManualMode ? (
            <View style={{ marginTop: 14 }}>
              <FormFieldLabel required>数量</FormFieldLabel>
              <View
                style={{
                  backgroundColor: colors.input,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: showCountError ? colors.danger : colors.inputBorder,
                  height: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}
              >
                <TouchableOpacity
                  onPress={handleDecreaseCount}
                  activeOpacity={0.75}
                  style={{
                    width: 44,
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRightWidth: 1,
                    borderRightColor: colors.inputBorder,
                    opacity: (parseManualEntryCount(count) ?? 1) <= 1 ? 0.45 : 1,
                  }}
                >
                  <AppIcon name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <TextInput
                  style={{
                    flex: 1,
                    height: '100%',
                    textAlign: 'center',
                    fontSize: 15,
                    color: colors.text,
                    paddingHorizontal: 12,
                  }}
                  value={count}
                  onChangeText={handleManualCountChange}
                  placeholder="1"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={handleIncreaseCount}
                  activeOpacity={0.75}
                  style={{
                    width: 44,
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderLeftWidth: 1,
                    borderLeftColor: colors.inputBorder,
                  }}
                >
                  <AppIcon name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              {showCountError ? (
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                  数量至少为 1
                </Text>
              ) : null}
            </View>
          ) : null}
          {dateSection}
        </FormCard>

        {isManualMode ? (
          <>
            <FormSectionLabel label="价格" />
            <FormCard>
              <FormFieldLabel>单价（每张）</FormFieldLabel>
              <Text style={{ marginTop: -4, marginBottom: 10, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                填写后将根据数量自动计算总价
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.input,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: showManualUnitPriceError ? colors.danger : colors.inputBorder,
                paddingHorizontal: 14,
                height: 44,
              }}>
                <Text style={{ fontSize: 15, color: colors.textMuted, marginRight: 6 }}>¥</Text>
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: colors.text }}
                  value={manualUnitPrice}
                  onChangeText={handleManualUnitPriceChange}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              {showManualUnitPriceError ? (
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                  {Number.isNaN(parsedManualUnitPrice) ? '请输入有效的单价' : '单价不能为负数'}
                </Text>
              ) : null}

              <View style={{ marginTop: 14 }}>
              <FormFieldLabel>总价</FormFieldLabel>
              <Text style={{ marginTop: -4, marginBottom: 10, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                {manualUnitPrice.trim() ? '已按单价和数量自动计算；直接修改可改为手动总价' : '可直接填写总价'}
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.input,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: showTotalPriceError ? colors.danger : colors.inputBorder,
                paddingHorizontal: 14,
                height: 44,
              }}>
                <Text style={{ fontSize: 15, color: colors.textMuted, marginRight: 6 }}>¥</Text>
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: colors.text }}
                  value={totalPrice}
                  onChangeText={handleManualTotalPriceChange}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              </View>
              {showTotalPriceError ? (
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                  {Number.isNaN(parsedTotalPrice) ? '请输入有效的总价' : '总价不能为负数'}
                </Text>
              ) : null}
            </FormCard>
            {eventSection ? (
              <>
                <FormSectionLabel label="关联活动" />
                <FormCard>
                  {eventSection}
                </FormCard>
              </>
            ) : null}
          </>
        ) : (
          <>
            <FormSectionLabel label="价格" />
            <FormCard>
              <FormFieldLabel>{photoUris.length > 1 ? '单价（每张）' : '单价'}</FormFieldLabel>
              <Text style={{ marginTop: -4, marginBottom: 10, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                {photoUris.length} 张拍立得，共计 {photoModeTotal} 元
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.input,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: showUnitPriceError ? colors.danger : colors.inputBorder,
                paddingHorizontal: 14,
                height: 44,
              }}>
                <Text style={{ fontSize: 15, color: colors.textMuted, marginRight: 6 }}>¥</Text>
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: colors.text }}
                  value={unitPrice}
                  onChangeText={handlePhotoUnitPriceChange}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              {showUnitPriceError ? (
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                  {Number.isNaN(parsedUnitPrice) ? '请输入有效的单价' : '单价不能为负数'}
                </Text>
              ) : null}
            </FormCard>
            {eventSection ? (
              <>
                <FormSectionLabel label="关联活动" />
                <FormCard>
                  {eventSection}
                </FormCard>
              </>
            ) : null}

            <FormSectionLabel label="备注" />
            <FormCard>
              <TextInput
                style={{
                  backgroundColor: colors.input,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: colors.text,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                value={notes}
                onChangeText={setNotes}
                placeholder="添加备注..."
                placeholderTextColor={colors.placeholder}
                multiline
                returnKeyType="default"
              />
            </FormCard>
          </>
        )}
      </KeyboardAwareScrollView>

      {photoFlowStatusText ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: isDark ? withAlpha(colors.screen, 0.72) : withAlpha(colors.screen, 0.76),
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 320,
              borderRadius: 20,
              paddingHorizontal: 20,
              paddingVertical: 18,
              backgroundColor: colors.card,
              shadowColor: colors.shadow,
              shadowOpacity: isDark ? 0.28 : 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>
                {photoPickerPending ? '正在读取图片' : '正在导入图片'}
              </Text>
            </View>
            {photoImportStatusText ? (
              <View
                style={{
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: isDark ? withAlpha(colors.accent, 0.28) : withAlpha(colors.accent, 0.18),
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${photoImportProgressRatio * 100}%`,
                    height: '100%',
                    borderRadius: 999,
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
            ) : null}
            <Text style={{ marginTop: 12, fontSize: 13, color: isDark ? colors.accentBorder : colors.accentStrong }}>
              {photoFlowStatusText}
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../../../src/components/AppIcon';
import { FormCard, FormFieldLabel, FormSectionLabel } from '../../../../src/components/FormPrimitives';
import { useDB } from '../../../../src/context/DBContext';
import {
  CHEKI_SPECS,
  DEFAULT_CHEKI_SPEC,
  getChekiSpecAspectRatio,
  type ChekiSpec,
} from '../../../../src/domain/chekiSpec';
import { NativeTextToolbar } from '../../../../src/components/native-text-toolbar';
import type { ChekiImageSide } from '../../../../src/types/models';
import type { ChekiItemWithImages } from '../../../../src/repositories/ChekiRecordRepository';
import { useAppTheme } from '../../../../src/theme/appTheme';
import { copyToDocuments } from '../../../../src/utils/copyToDocuments';
import {
  showCameraPermissionAlert,
  showPhotoLibraryPermissionAlert,
  showSaveFailedAlert,
} from '../../../../src/utils/failureAlert';
import { deleteLocalFileIfUnreferenced } from '../../../../src/utils/localMedia';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../../../src/utils/safeArea';
import { withAlpha } from '../../../../src/utils/color';

const CHEKI_IMPORT_MAX_DIMENSION = Platform.OS === 'android' ? 1600 : 2000;

function sideLabel(side: ChekiImageSide): string {
  return side === 'front' ? '正面' : '背面';
}

export default function EditChekiItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const pendingImportedUrisRef = useRef(new Set<string>());
  const initialSnapshotRef = useRef('');
  const allowNavigationRef = useRef(false);

  const [item, setItem] = useState<ChekiItemWithImages | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingSide, setImportingSide] = useState<ChekiImageSide | null>(null);
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [unitPrice, setUnitPrice] = useState('0');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [spec, setSpec] = useState<ChekiSpec>(DEFAULT_CHEKI_SPEC);

  const cleanupPendingImports = useCallback(async (uris?: string[]) => {
    const targets = uris ?? Array.from(pendingImportedUrisRef.current);
    for (const uri of new Set(targets)) {
      pendingImportedUrisRef.current.delete(uri);
      await deleteLocalFileIfUnreferenced(db.rawDb, uri);
    }
  }, [db]);

  useEffect(() => () => {
    void cleanupPendingImports();
  }, [cleanupPendingImports]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const nextItem = await db.chekiRecords.findItemById(id);
      if (!active) return;
      if (!nextItem) {
        setItem(null);
        setLoading(false);
        return;
      }
      const nextFront = nextItem.images.find((image) => image.side === 'front')?.photo_uri ?? null;
      const nextBack = nextItem.images.find((image) => image.side === 'back')?.photo_uri ?? null;
      setItem(nextItem);
      setFrontUri(nextFront);
      setBackUri(nextBack);
      setUnitPrice(String(nextItem.unit_price));
      setNotes(nextItem.notes ?? '');
      setIsFavorite(nextItem.is_favorite === 1);
      setSpec(nextItem.spec);
      initialSnapshotRef.current = JSON.stringify({
        frontUri: nextFront,
        backUri: nextBack,
        unitPrice: String(nextItem.unit_price),
        notes: nextItem.notes ?? '',
        isFavorite: nextItem.is_favorite === 1,
        spec: nextItem.spec,
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [db, id]);

  const effectiveAspectRatio = getChekiSpecAspectRatio(spec);
  const snapshot = JSON.stringify({
    frontUri,
    backUri,
    unitPrice,
    notes,
    isFavorite,
    spec,
  });
  const isDirty = !loading && initialSnapshotRef.current !== snapshot;
  const parsedUnitPrice = unitPrice.trim() === ''
    ? 0
    : /^\d+$/.test(unitPrice) ? Number(unitPrice) : null;
  const unitPriceValid = parsedUnitPrice != null && Number.isSafeInteger(parsedUnitPrice);

  const leave = useCallback(() => {
    const performLeave = () => {
      allowNavigationRef.current = true;
      void cleanupPendingImports();
      router.back();
    };
    if (!isDirty) {
      performLeave();
      return;
    }
    Alert.alert('放弃本次修改？', '尚未保存的内容将会丢失。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: performLeave },
    ]);
  }, [cleanupPendingImports, isDirty]);

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
          void cleanupPendingImports();
          navigation.dispatch(event.data.action);
        },
      },
    ]);
  }), [cleanupPendingImports, isDirty, navigation]);

  const importImage = useCallback(async (
    side: ChekiImageSide,
    source: 'library' | 'camera',
  ) => {
    if (importingSide || saving) return;
    if (source === 'library') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        showPhotoLibraryPermissionAlert();
        return;
      }
    } else {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        showCameraPermissionAlert();
        return;
      }
    }
    const result = source === 'library'
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    setImportingSide(side);
    try {
      const asset = result.assets[0];
      const uri = await copyToDocuments(asset.uri, {
        filenamePrefix: `cheki-${side}`,
        maxDimension: CHEKI_IMPORT_MAX_DIMENSION,
        sourceSize: asset.width > 0 && asset.height > 0
          ? { width: asset.width, height: asset.height }
          : null,
      });
      pendingImportedUrisRef.current.add(uri);
      const previous = side === 'front' ? frontUri : backUri;
      if (side === 'front') setFrontUri(uri);
      else setBackUri(uri);
      if (previous && pendingImportedUrisRef.current.has(previous)) {
        void cleanupPendingImports([previous]);
      }
    } catch {
      Alert.alert('导入失败', '图片过大或格式异常，未能完成处理。');
    } finally {
      setImportingSide(null);
    }
  }, [backUri, cleanupPendingImports, frontUri, importingSide, saving]);

  const chooseImageSource = useCallback((side: ChekiImageSide) => {
    Alert.alert(`${sideLabel(side)}图片`, '选择图片来源', [
      { text: '取消', style: 'cancel' },
      { text: '从相册选择', onPress: () => void importImage(side, 'library') },
      { text: '拍照', onPress: () => void importImage(side, 'camera') },
    ]);
  }, [importImage]);

  const removeSide = useCallback((side: ChekiImageSide) => {
    if (side === 'front') return;
    const currentUri = backUri;
    if (!currentUri) return;
    Alert.alert(`移除${sideLabel(side)}？`, '确定移除这张图片吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: () => {
          setBackUri(null);
          if (pendingImportedUrisRef.current.has(currentUri)) {
            void cleanupPendingImports([currentUri]);
          }
        },
      },
    ]);
  }, [backUri, cleanupPendingImports]);

  const save = useCallback(async () => {
    if (!item || saving) return;
    if (!unitPriceValid || parsedUnitPrice == null) {
      Alert.alert('请输入有效的单价', '单价只支持大于或等于 0 的整数。');
      return;
    }
    setSaving(true);
    try {
      const originalFront = item.images.find((image) => image.side === 'front')?.photo_uri ?? null;
      const originalBack = item.images.find((image) => image.side === 'back')?.photo_uri ?? null;
      await db.chekiRecords.updateItemWithImages(item.id, {
        unitPrice: parsedUnitPrice,
        spec,
        isFavorite,
        notes: notes.trim() || null,
        images: {
          ...(frontUri !== originalFront ? { front: frontUri } : {}),
          ...(backUri !== originalBack ? { back: backUri } : {}),
        },
      });
      for (const uri of [frontUri, backUri]) {
        if (uri) pendingImportedUrisRef.current.delete(uri);
      }
      allowNavigationRef.current = true;
      router.back();
    } catch {
      showSaveFailedAlert();
    } finally {
      setSaving(false);
    }
  }, [backUri, db, frontUri, isFavorite, item, notes, parsedUnitPrice, saving, spec, unitPriceValid]);

  const deleteItem = useCallback(() => {
    if (!item || saving) return;
    Alert.alert(
      '删除这张拍立得？',
      '删除后无法恢复，并会减少记录数量。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const record = await db.chekiRecords.findRecordById(item.record_id);
              await db.chekiRecords.deleteItem(item.id);
              allowNavigationRef.current = true;
              await cleanupPendingImports();
              router.replace(record?.quantity === 1 ? '/cheki' : `/cheki/records/${item.record_id}`);
            } catch {
              Alert.alert('删除失败', '暂时无法删除这张拍立得，请稍后重试。');
            }
          },
        },
      ],
    );
  }, [cleanupPendingImports, db, item, saving]);

  if (loading) {
    return (
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.screen }}>
        <AppIcon name="alert" size={34} color={colors.textMuted} />
        <Text style={{ marginTop: 12, fontSize: 17, fontWeight: '700', color: colors.heading }}>拍立得不存在</Text>
        <Text style={{ marginTop: 6, fontSize: 13, textAlign: 'center', color: colors.textSecondary }}>这张拍立得可能已经被删除。</Text>
      </SafeAreaView>
    );
  }

  const renderImageCard = (side: ChekiImageSide, uri: string | null) => (
    <View style={{ marginBottom: side === 'front' ? 12 : 0 }}>
      <FormFieldLabel>{sideLabel(side)}</FormFieldLabel>
      {uri ? (
        <View>
          <Image
            source={{ uri }}
            resizeMethod="resize"
            resizeMode="contain"
            style={{ width: '100%', aspectRatio: effectiveAspectRatio, borderRadius: 12, backgroundColor: colors.cardAlt }}
          />
          {importingSide === side ? (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.scrim }}>
              <ActivityIndicator color={colors.onAccent} />
            </View>
          ) : null}
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => chooseImageSource(side)}
              activeOpacity={0.72}
              style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: colors.accentSofter }}
            >
              <AppIcon name="refresh" size={16} color={colors.accent} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>替换</Text>
            </TouchableOpacity>
            {side === 'back' ? (
              <TouchableOpacity
                onPress={() => removeSide(side)}
                activeOpacity={0.72}
                style={{ minWidth: 96, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: colors.dangerSoft }}
              >
                <AppIcon name="trash" size={15} color={colors.danger} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>移除</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => chooseImageSource(side)}
          activeOpacity={0.75}
          style={{ minHeight: 132, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt }}
        >
          {importingSide === side ? <ActivityIndicator color={colors.accent} /> : <AppIcon name="add" size={24} color={colors.accent} />}
          <Text style={{ marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.accent }}>添加{sideLabel(side)}</Text>
          <Text style={{ marginTop: 3, fontSize: 12, color: colors.textSecondary }}>相册或拍照</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          title: '编辑拍立得',
          headerBackVisible: false,
          headerLeft: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={leave} hitSlop={8} accessibilityRole="button" accessibilityLabel="取消编辑">
              <Text style={{ fontSize: 16, color: colors.textSecondary }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => void save()} disabled={saving} hitSlop={8} accessibilityRole="button" accessibilityLabel="保存拍立得">
              <Text style={{ fontSize: 16, fontWeight: '700', color: saving ? colors.textMuted : colors.accent }}>{saving ? '保存中' : '保存'}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        left={{ label: '取消', onPress: leave, disabled: saving }}
        right={{
          label: saving ? '保存中' : '保存',
          onPress: () => void save(),
          disabled: saving,
          variant: 'done',
        }}
      />
      <KeyboardAwareScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <FormSectionLabel label="图片" />
        <FormCard>
          {renderImageCard('front', frontUri)}
          {renderImageCard('back', backUri)}
        </FormCard>

        <FormSectionLabel label="价格" />
        <FormCard>
          <FormFieldLabel>单价（每张）</FormFieldLabel>
          <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: unitPriceValid ? colors.inputBorder : colors.danger, backgroundColor: colors.input }}>
            <Text style={{ marginRight: 6, fontSize: 15, color: colors.textMuted }}>¥</Text>
            <TextInput
              value={unitPrice}
              onChangeText={(value) => setUnitPrice(value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              style={{ flex: 1, fontSize: 15, color: colors.text }}
            />
          </View>
        </FormCard>

        <FormSectionLabel label="备注" />
        <FormCard>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="记录签名、姿势或其他信息"
            placeholderTextColor={colors.placeholder}
            style={{ minHeight: 112, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.input, fontSize: 14, lineHeight: 21, color: colors.text }}
          />
        </FormCard>

        <FormSectionLabel label="更多" />
        <FormCard>
          <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>收藏这张拍立得</Text>
            </View>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.inputBorder, true: withAlpha(colors.accent, 0.38) }}
              thumbColor={isFavorite ? colors.accent : colors.card}
              style={{ alignSelf: 'center' }}
            />
          </View>
        </FormCard>
        <FormCard>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>拍立得规格</Text>
          <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CHEKI_SPECS.map((option) => {
              const selected = option.id === spec;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setSpec(option.id)}
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
        </FormCard>

        <TouchableOpacity
          onPress={deleteItem}
          activeOpacity={0.7}
          style={{ marginTop: 12, minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card }}
        >
          <AppIcon name="trash" size={16} color={colors.danger} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>删除这张拍立得</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

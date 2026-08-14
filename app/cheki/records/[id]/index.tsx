import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDB } from '../../../../src/context/DBContext';
import type { Artist, Event } from '../../../../src/types/models';
import type { ChekiRecordWithItems } from '../../../../src/repositories/ChekiRecordRepository';
import type { ChekiViewerItem } from '../../../../src/types/chekiViewer';
import { useAppTheme } from '../../../../src/theme/appTheme';
import { formatChineseDateWithWeekday } from '../../../../src/utils/date';
import { getArtistPrimaryName } from '../../../../src/utils/artistDisplay';
import { resolveAvatarSource } from '../../../../src/utils/avatarSource';
import { AppIcon } from '../../../../src/components/AppIcon';
import { EventCard } from '../../../../src/components/EventCard';
import { ChekiViewerModal } from '../../../../src/components/ChekiViewerModal';
import { FormSectionLabel } from '../../../../src/components/FormPrimitives';
import { NativeTextToolbar } from '../../../../src/components/native-text-toolbar';
import { OshiAvatar } from '../../../../src/components/Oshi';
import { getEventCardOshiBadge } from '../../../../src/utils/oshiMatch';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../../../src/utils/safeArea';
import {
  DEFAULT_CHEKI_SPEC,
  getChekiSpecAspectRatio,
} from '../../../../src/domain/chekiSpec';

const ARTIST_AVATAR_SIZE = 48;
const ARTIST_TITLE_GAP = 14;

function getItemPreviewUri(item: ChekiRecordWithItems['items'][number]): string | null {
  return item.images.find((image) => image.side === 'front')?.photo_uri
    ?? item.images.find((image) => image.side === 'back')?.photo_uri
    ?? null;
}

function getItemPreviewSide(item: ChekiRecordWithItems['items'][number]): 'front' | 'back' | null {
  if (item.images.some((image) => image.side === 'front')) return 'front';
  if (item.images.some((image) => image.side === 'back')) return 'back';
  return null;
}

function formatPrice(value: number | null): string {
  return value == null ? '未记录' : `¥${value}`;
}

export default function ChekiRecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [record, setRecord] = useState<ChekiRecordWithItems | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const nextRecord = await db.chekiRecords.findRecordById(id);
    if (!nextRecord) {
      setRecord(null);
      setLoading(false);
      return;
    }
    const [nextArtist, nextEvent] = await Promise.all([
      nextRecord.artist_id ? db.artists.findById(nextRecord.artist_id) : Promise.resolve(null),
      nextRecord.event_id ? db.events.findById(nextRecord.event_id) : Promise.resolve(null),
    ]);
    setRecord(nextRecord);
    setArtist(nextArtist);
    setEvent(nextEvent);
    setLoading(false);
  }, [db, id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const viewerItems = useMemo<ChekiViewerItem[]>(() => {
    if (!record) return [];
    return record.items.flatMap((item) => {
      const frontPhotoUri = item.images.find((image) => image.side === 'front')?.photo_uri ?? null;
      const backPhotoUri = item.images.find((image) => image.side === 'back')?.photo_uri ?? null;
      const photoUri = frontPhotoUri ?? backPhotoUri;
      if (!photoUri) return [];
      return [{
        id: item.id,
        itemId: item.id,
        photoUri,
        frontPhotoUri,
        backPhotoUri,
        side: frontPhotoUri ? 'front' as const : 'back' as const,
        isFavorite: item.is_favorite === 1,
        spec: item.spec,
        date: record.date,
        price: item.unit_price,
        notes: item.notes,
        artistId: record.artist_id,
        artistName: artist ? getArtistPrimaryName(artist) : null,
        eventId: record.event_id,
        eventTitle: event?.title ?? null,
      }];
    });
  }, [artist, event, record]);

  const handleDeleteItem = useCallback((viewerItem: ChekiViewerItem) => {
    const itemId = viewerItem.itemId ?? viewerItem.id;
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
              await db.chekiRecords.deleteItem(itemId);
              setSelectedItemId(null);
              if (record?.quantity === 1) router.back();
              else await load();
            } catch {
              Alert.alert('删除失败', '暂时无法删除这张拍立得，请稍后重试。');
            }
          },
        },
      ],
    );
  }, [db, load, record?.quantity]);

  const handleToggleFavorite = useCallback(async (viewerItem: ChekiViewerItem) => {
    const itemId = viewerItem.itemId ?? viewerItem.id;
    const nextFavorite = !viewerItem.isFavorite;
    setRecord((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId
        ? { ...item, is_favorite: nextFavorite ? 1 : 0 }
        : item),
    } : current);
    try {
      await db.chekiRecords.setItemFavorite(itemId, nextFavorite);
    } catch {
      await load();
      Alert.alert('收藏失败', '暂时无法更新收藏状态，请稍后重试。');
    }
  }, [db, load]);

  const handleDelete = useCallback(() => {
    if (!record) return;
    const savedCount = record.items.length;
    Alert.alert(
      '删除拍立得记录',
      `将删除这条记录及其中的 ${savedCount} 张拍立得。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.chekiRecords.deleteRecord(record.id);
              router.back();
            } catch {
              Alert.alert('删除失败', '暂时无法删除这条记录，请稍后重试。');
            }
          },
        },
      ],
    );
  }, [db, record]);

  if (loading) {
    return (
      <SafeAreaView
        edges={SCROLL_SCREEN_SAFE_AREA_EDGES}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}
      >
        <Stack.Screen
          options={{
            title: '拍立得记录',
            headerStyle: { backgroundColor: colors.screen },
            headerShadowVisible: false,
          }}
        />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView
        edges={SCROLL_SCREEN_SAFE_AREA_EDGES}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.screen }}
      >
        <Stack.Screen
          options={{
            title: '拍立得记录',
            headerStyle: { backgroundColor: colors.screen },
            headerShadowVisible: false,
          }}
        />
        <AppIcon name="alert" size={34} color={colors.textMuted} />
        <Text style={{ marginTop: 12, fontSize: 17, fontWeight: '700', color: colors.heading }}>记录不存在</Text>
        <Text style={{ marginTop: 6, fontSize: 13, textAlign: 'center', color: colors.textSecondary }}>
          这条拍立得记录可能已经被删除。
        </Text>
      </SafeAreaView>
    );
  }

  const itemWidth = Math.floor((width - 32 - 16) / 3);
  const photoItems = record.items.filter((item) => item.images.length > 0);
  const hasMissingImages = photoItems.length < record.quantity;
  const totalPrice = record.items.reduce((sum, item) => sum + item.unit_price, 0);
  const artistName = artist ? getArtistPrimaryName(artist) : '未关联艺人';

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          title: '拍立得记录',
          headerStyle: { backgroundColor: colors.screen },
          headerShadowVisible: false,
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="编辑拍立得记录"
              onPress={() => router.push(`/cheki/records/${record.id}/edit`)}
              style={{
                minWidth: 44,
                height: 44,
                paddingRight: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>编辑</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        right={{
          label: '编辑',
          accessibilityLabel: '编辑拍立得记录',
          onPress: () => router.push(`/cheki/records/${record.id}/edit`),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingVertical: 28, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.card }}>
          <TouchableOpacity
            activeOpacity={artist ? 0.7 : 1}
            onPress={artist ? () => router.push(`/artists/${artist.id}`) : undefined}
            accessibilityRole={artist ? 'button' : undefined}
            accessibilityLabel={artist ? `查看艺人 ${artistName}` : undefined}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <OshiAvatar
              source={artist ? resolveAvatarSource(artist.avatar_uri) : null}
              size={ARTIST_AVATAR_SIZE}
              isOshi={false}
            />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                marginLeft: ARTIST_TITLE_GAP,
                fontSize: 18,
                lineHeight: 24,
                fontWeight: '800',
                color: colors.heading,
              }}
            >
              {artistName}
            </Text>
            {artist ? <AppIcon name="disclosure" variant="forward" size={16} color={colors.chevron} /> : null}
          </TouchableOpacity>

          <View style={{ marginTop: 12, marginLeft: ARTIST_AVATAR_SIZE + ARTIST_TITLE_GAP, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="calendar" size={16} color={colors.accent} />
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                lineHeight: 24,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: colors.text,
              }}
            >
              {record.date ? formatChineseDateWithWeekday(record.date) : '日期未填写'}
            </Text>
          </View>

          <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.divider, flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 11, lineHeight: 15, color: colors.textSecondary }}>总数量</Text>
              <Text style={{ marginTop: 4, fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.text }}>{record.quantity} 张</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.divider }} />
            <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 11, lineHeight: 15, color: colors.textSecondary }}>有图</Text>
              <Text style={{ marginTop: 4, fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.text }}>{photoItems.length} 张</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.divider }} />
            <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 11, lineHeight: 15, color: colors.textSecondary }}>总价</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4, fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.text }}>
                {formatPrice(totalPrice)}
              </Text>
            </View>
          </View>
        </View>

        {event ? (
          <View style={{ marginTop: 20 }}>
            <FormSectionLabel label="关联活动" />
            <EventCard
              event={event}
              oshiBadge={getEventCardOshiBadge(event.status, null)}
              variant="compact"
              style={{
                marginBottom: 0,
                backgroundColor: colors.cardAlt,
                borderWidth: 1,
                borderColor: colors.divider,
                borderRadius: 15,
              }}
            />
          </View>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <FormSectionLabel label="拍立得" />
          {photoItems.length > 0 || hasMissingImages ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {photoItems.map((item) => {
                const uri = getItemPreviewUri(item);
                const previewSide = getItemPreviewSide(item);
                if (!uri || !previewSide) return null;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedItemId(item.id)}
                    activeOpacity={0.82}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`查看第 ${item.sort_order + 1} 张拍立得`}
                  >
                    <Image
                      source={{ uri }}
                      resizeMethod="resize"
                      resizeMode="contain"
                      style={{
                        width: itemWidth,
                        height: itemWidth / getChekiSpecAspectRatio(item.spec),
                        borderRadius: 10,
                        backgroundColor: colors.cardAlt,
                      }}
                    />
                    {item.notes?.trim() ? (
                      <View style={{ position: 'absolute', left: 6, bottom: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim }}>
                        <AppIcon name="document" size={12} color={colors.onAccent} />
                      </View>
                    ) : null}
                    {item.is_favorite === 1 ? (
                      <View style={{ position: 'absolute', right: 6, top: 6 }}>
                        <AppIcon name="favorite" size={18} color={colors.danger} />
                      </View>
                    ) : null}
                    {item.images.length > 1 ? (
                      <View style={{ position: 'absolute', right: 5, bottom: 5, paddingHorizontal: 7, minHeight: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.onAccent }}>双面</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              {hasMissingImages ? (
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/cheki/records/[id]/edit',
                    params: { id: record.id, focus: 'images' },
                  })}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel="添加图片"
                  style={{
                    width: itemWidth,
                    height: itemWidth / getChekiSpecAspectRatio(DEFAULT_CHEKI_SPEC),
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: colors.divider,
                    backgroundColor: colors.cardAlt,
                  }}
                >
                  <AppIcon name="add" size={24} color={colors.accent} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={{ paddingVertical: 28, alignItems: 'center', borderRadius: 16, backgroundColor: colors.card }}>
              <AppIcon name="image" size={30} color={colors.textMuted} />
              <Text style={{ marginTop: 10, fontSize: 15, fontWeight: '700', color: colors.text }}>尚未添加图片</Text>
            </View>
          )}

        </View>

        {record.notes?.trim() ? (
          <View style={{ marginTop: 20 }}>
            <FormSectionLabel label="备注" />
            <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.card }}>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.text }}>{record.notes}</Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.7}
          style={{ marginTop: 28, minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card }}
        >
          <AppIcon name="trash" size={16} color={colors.danger} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>删除记录</Text>
        </TouchableOpacity>
      </ScrollView>

      <ChekiViewerModal
        visible={selectedItemId != null}
        items={viewerItems}
        selectedId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
        onEdit={(item) => {
          const itemId = item.itemId ?? item.id;
          setSelectedItemId(null);
          router.push(`/cheki/items/${itemId}/edit`);
        }}
        onDelete={handleDeleteItem}
        onToggleFavorite={(item) => void handleToggleFavorite(item)}
      />
    </SafeAreaView>
  );
}

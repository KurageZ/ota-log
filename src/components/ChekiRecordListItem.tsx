import { Image, Text, TouchableOpacity, View } from 'react-native';
import type { Artist, Event } from '../types/models';
import type { ChekiRecordWithItems } from '../repositories/ChekiRecordRepository';
import { resolveAvatarSource } from '../utils/avatarSource';
import { getArtistDisplayText } from '../utils/artistDisplay';
import { useAppTheme } from '../theme/appTheme';
import { OshiAvatar, OshiBadge } from './Oshi';
import { AppIcon } from './AppIcon';

const RECORD_PREVIEW_WIDTH = 58;
const PREVIEW_STACK_OFFSET = 3;
const PREVIEW_STACK_LIMIT = 3;

export function ChekiRecordListItem({
  record,
  artist,
  parentName,
  event,
  isOshi,
  showThumbnail,
  onPress,
}: {
  record: ChekiRecordWithItems;
  artist: Artist | null;
  parentName: string | null;
  event: Event | null;
  isOshi: boolean;
  showThumbnail: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const display = artist ? getArtistDisplayText({ artist, parentName }) : null;
  const previewWidth = RECORD_PREVIEW_WIDTH;
  const previewHeight = Math.round(previewWidth * 86 / 54);
  const photoItems = record.items.filter((item) => item.images.length > 0);
  const previews = photoItems
    .map((item) => {
      const image = item.images.find((candidate) => candidate.side === 'front') ?? item.images[0];
      return image ? { item, image } : null;
    })
    .filter((preview): preview is NonNullable<typeof preview> => preview !== null);
  const visiblePreviews = previews.slice(0, PREVIEW_STACK_LIMIT);
  const additionalPreviewCount = Math.max(0, previews.length - 1);
  const addedCount = Math.min(photoItems.length, record.quantity);
  const imageSummary = addedCount === 0
    ? '无图片'
    : addedCount < record.quantity ? `${addedCount} 张有图` : null;
  const effectiveDate = record.date ?? record.created_at.slice(0, 10);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${effectiveDate}，${display?.title ?? '未关联艺人'}，共${record.quantity}张`}
      style={{
        marginBottom: 12,
        paddingHorizontal: showThumbnail ? 14 : 12,
        paddingVertical: 14,
        borderRadius: showThumbnail ? 18 : 16,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: showThumbnail ? 12 : 10 }}>
        {showThumbnail ? (
          <View style={{ width: previewWidth + 6, height: previewHeight + 6 }}>
            {visiblePreviews.length > 0 ? (
              [...visiblePreviews].reverse().map(({ item, image }, reverseIndex) => {
                const originalIndex = visiblePreviews.length - reverseIndex - 1;
                const offset = originalIndex * PREVIEW_STACK_OFFSET;
                return (
                  <View
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: offset,
                      left: offset,
                      width: previewWidth,
                      height: previewHeight,
                      borderRadius: 10,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: colors.divider,
                      backgroundColor: colors.cardAlt,
                    }}
                  >
                    <Image
                      source={{ uri: image.photo_uri }}
                      resizeMode="cover"
                      style={{ width: '100%', height: '100%' }}
                    />
                    {originalIndex === 0 && additionalPreviewCount > 0 ? (
                      <View
                        style={{
                          position: 'absolute',
                          right: 5,
                          bottom: 5,
                          minWidth: 24,
                          paddingHorizontal: 6,
                          paddingVertical: 3,
                          alignItems: 'center',
                          borderRadius: 99,
                          backgroundColor: colors.scrim,
                        }}
                      >
                        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '800', color: colors.onAccent }}>
                          +{additionalPreviewCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <View
                style={{
                  width: previewWidth,
                  height: previewHeight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: colors.cardAlt,
                }}
              >
                <AppIcon name="image" size={22} color={colors.textMuted} />
              </View>
            )}
          </View>
        ) : (
          <OshiAvatar
            source={artist ? resolveAvatarSource(artist.avatar_uri) : null}
            size={isOshi ? 44 : 42}
            isOshi={isOshi}
          />
        )}

        <View style={{ flex: 1, minWidth: 0, minHeight: showThumbnail ? previewHeight : 64, paddingVertical: showThumbnail ? 2 : 0 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text
                  numberOfLines={1}
                  style={{ flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.heading }}
                >
                  {display?.title ?? '未关联艺人'}
                </Text>
                {isOshi ? <OshiBadge /> : null}
              </View>
              <AppIcon name="disclosure" variant="forward" size={14} color={colors.chevron} />
            </View>

            {showThumbnail && display?.subtitle ? (
              <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
                {display.subtitle}
              </Text>
            ) : null}

            <View style={{ marginTop: showThumbnail && display?.subtitle ? 4 : showThumbnail ? 3 : 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <AppIcon name="music" size={12} color={colors.textMuted} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                {event?.title ?? '未关联活动'}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 'auto', paddingTop: showThumbnail ? 8 : 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="calendar" size={12} color={colors.textMuted} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
              {effectiveDate}{imageSummary ? ` · ${imageSummary}` : ''}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 17, fontWeight: '800', color: colors.text }}>
              {record.quantity} 张
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Cheki } from '../types/models';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';
import { calculateChekiStackPreview } from '../utils/cheki';
import { AppIcon } from './AppIcon';
import { OshiAvatar } from './Oshi';
import { resolveAvatarSource } from '../utils/avatarSource';

const CHEKI_ASPECT_RATIO = 86 / 54;
const CHEKI_DETAIL_PREVIEW_LIMIT = 3;
const CHEKI_STACK_VISIBLE_LIMIT = 10;
const CHEKI_DETAIL_GAP = 8;
const CHEKI_STACK_CARD_PADDING_X = 15;
const MANUAL_AVATAR_SIZE = 28;
const MANUAL_AVATAR_OVERLAP = 10;

type ChekiStackPreviewHeader = {
  title: string;
  countLabel: string;
  actionLabel: string;
  actionIconVariant: 'up' | 'down';
};

type ChekiStackPreviewArtistSummary = {
  id: string;
  name: string;
  avatarUri: string | null;
  isOshi?: boolean;
  count?: number;
};

type Props = {
  chekis: Cheki[];
  manualCount: number;
  areaWidth: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  header?: ChekiStackPreviewHeader;
  manualSummary?: string;
  manualArtistSummaries?: ChekiStackPreviewArtistSummary[];
  activeOpacity?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  columns?: number;
  chrome?: 'card' | 'bare';
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ChekiStackPreviewCard({
  chekis,
  manualCount,
  areaWidth,
  onPress,
  accessibilityLabel,
  header,
  manualSummary,
  manualArtistSummaries,
  activeOpacity = 0.78,
  thumbnailWidth,
  thumbnailHeight,
  columns,
  chrome = 'card',
}: Props) {
  const { colors, isDark } = useAppTheme();
  const hasCardChrome = chrome === 'card';
  const thumbnailShadow = {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 1,
  };
  const canPress = typeof onPress === 'function';
  const fallbackCardWidth = Math.max(
    48,
    (areaWidth - CHEKI_DETAIL_GAP * (CHEKI_DETAIL_PREVIEW_LIMIT - 1)) / CHEKI_DETAIL_PREVIEW_LIMIT,
  );
  const cardWidth = thumbnailWidth ?? fallbackCardWidth;
  const cardHeight = Math.round(cardWidth * CHEKI_ASPECT_RATIO);
  const resolvedCardHeight = thumbnailHeight ?? cardHeight;
  const fitColumns = Math.max(
    1,
    columns ?? Math.floor((areaWidth + CHEKI_DETAIL_GAP) / (cardWidth + CHEKI_DETAIL_GAP)),
  );
  const { shouldStack, visibleCount: previewCount, hiddenCount } = calculateChekiStackPreview({
    total: chekis.length,
    columns: fitColumns,
    visibleLimit: CHEKI_STACK_VISIBLE_LIMIT,
  });
  const stackStep = previewCount > 1
    ? (() => {
        const widthLimitedStep = Math.max(1, (areaWidth - cardWidth) / Math.max(1, previewCount - 1));
        const minStep = Math.min(18, cardWidth * 0.22, widthLimitedStep);
        return clamp(widthLimitedStep, minStep, cardWidth + CHEKI_DETAIL_GAP);
      })()
    : 0;
  const stackWidth = cardWidth + stackStep * Math.max(previewCount - 1, 0);
  const stackStart = Math.max((areaWidth - stackWidth) / 2, 0);
  const manualText = manualSummary ?? `已记录 ${manualCount} 张`;
  const manualArtistCount = manualArtistSummaries?.length ?? 0;
  const visibleManualArtists = manualArtistSummaries?.slice(0, 3) ?? [];
  const extraManualArtistCount = Math.max(0, manualArtistCount - visibleManualArtists.length);
  const avatarStackWidth = visibleManualArtists.length > 0
    ? MANUAL_AVATAR_SIZE + Math.max(0, visibleManualArtists.length - 1) * (MANUAL_AVATAR_SIZE - MANUAL_AVATAR_OVERLAP)
    : MANUAL_AVATAR_SIZE;

  const cardContent = (
    <>
      {header ? (
        <View style={{ paddingHorizontal: CHEKI_STACK_CARD_PADDING_X, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: '900', color: colors.heading }}>
            {header.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.accentSofter }}>
              <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '900', color: colors.accent }}>
                {header.countLabel}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '800', color: colors.accent }}>
                {header.actionLabel}
              </Text>
              <AppIcon name="chevron" variant={header.actionIconVariant} size={16} color={colors.accent} />
            </View>
          </View>
        </View>
      ) : null}

      {chekis.length > 0 ? (
        shouldStack ? (
          <View style={{ width: areaWidth, alignSelf: 'center', height: resolvedCardHeight + 20, position: 'relative', overflow: 'hidden' }}>
            {chekis.slice(0, previewCount).map((cheki, index) => {
              const isLastVisible = index === previewCount - 1;
              return (
                <View
                  key={cheki.id}
                  style={{
                    position: 'absolute',
                    left: stackStart + index * stackStep,
                    top: 4,
                    width: cardWidth,
                    height: resolvedCardHeight,
                    borderRadius: 10,
                    zIndex: index + 1,
                    ...thumbnailShadow,
                  }}
                >
                  <Image
                    source={{ uri: cheki.photo_uri }}
                    resizeMethod="resize"
                    resizeMode="contain"
                    style={{ width: '100%', height: '100%', borderRadius: 10, backgroundColor: colors.cardAlt }}
                  />
                  {isLastVisible && hiddenCount > 0 ? (
                    <View style={{
                      position: 'absolute',
                      right: 5,
                      bottom: 6,
                      borderRadius: 999,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      backgroundColor: isDark ? withAlpha(colors.heading, 0.82) : withAlpha(colors.text, 0.82),
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: colors.card }}>
                        {chekis.length} 张
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View
            style={{
              width: areaWidth,
              alignSelf: 'center',
              height: resolvedCardHeight,
              flexDirection: 'row',
              gap: CHEKI_DETAIL_GAP,
              justifyContent: 'center',
            }}
          >
            {chekis.slice(0, previewCount).map((cheki) => (
              <View
                key={cheki.id}
                style={{
                  width: cardWidth,
                  height: resolvedCardHeight,
                  borderRadius: 10,
                  ...thumbnailShadow,
                }}
              >
                <Image
                  source={{ uri: cheki.photo_uri }}
                  resizeMethod="resize"
                  resizeMode="contain"
                  style={{ width: '100%', height: '100%', borderRadius: 10, backgroundColor: colors.cardAlt }}
                />
              </View>
            ))}
          </View>
        )
      ) : null}

      {manualCount > 0 ? (
        <>
          <View
            style={{
              marginHorizontal: CHEKI_STACK_CARD_PADDING_X,
              marginTop: chekis.length > 0 ? 12 : 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              borderRadius: 14,
              backgroundColor: colors.accentSofter,
            }}
          >
            <View
              style={{
                width: avatarStackWidth,
                height: MANUAL_AVATAR_SIZE,
                position: 'relative',
              }}
            >
              {visibleManualArtists.length > 0 ? visibleManualArtists.map((artist, index) => (
                <View
                  key={artist.id}
                  style={{
                    position: 'absolute',
                    left: index * (MANUAL_AVATAR_SIZE - MANUAL_AVATAR_OVERLAP),
                    top: 0,
                  }}
                >
                  <OshiAvatar
                    source={resolveAvatarSource(artist.avatarUri)}
                    size={MANUAL_AVATAR_SIZE}
                    isOshi={artist.isOshi ?? false}
                  />
                </View>
              )) : (
                <View
                  style={{
                    width: MANUAL_AVATAR_SIZE,
                    height: MANUAL_AVATAR_SIZE,
                    borderRadius: 999,
                    backgroundColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon name="cheki" size={16} color={colors.accent} />
                </View>
              )}
              {extraManualArtistCount > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: -4,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 999,
                    paddingHorizontal: 5,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: colors.accentSofter,
                  }}
                >
                  <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: '900', color: colors.card }}>
                    +{extraManualArtistCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '900', color: colors.accentText }}>
                共计 {manualCount} 张
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.accent }}>
                {manualArtistCount > 0 ? `共计 ${manualArtistCount} 人` : manualText}
              </Text>
            </View>
          </View>
        </>
      ) : null}
    </>
  );

  const containerStyle = {
    marginBottom: 12,
    ...(hasCardChrome
      ? {
          borderRadius: 18,
          paddingVertical: 14,
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.18 : 0.08,
          shadowRadius: 14,
          elevation: 3,
        }
      : {
          borderRadius: 0,
          paddingVertical: 0,
          backgroundColor: 'transparent',
          shadowOpacity: 0,
          elevation: 0,
        }),
  } as const;

  if (canPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={activeOpacity}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={containerStyle}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{cardContent}</View>;
}

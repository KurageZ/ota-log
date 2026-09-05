import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from './AppIcon';
import { useAppTheme } from '../theme/appTheme';
import { withAlpha } from '../utils/color';

const STORAGE_KEY = 'ota-log.onboarding-guide-seen.v2';
const INTERACTION_UNLOCK_DELAY_MS = 300;

type GuidePageKey = 'homeEvents' | 'artists' | 'cheki' | 'dataStats' | 'features';

interface GuidePage {
  key: GuidePageKey;
  title: string;
  body: string;
  entry: string;
}

const FEATURES_BODY = Platform.select({
  android:
    '拍立得贴纸相机选择拍立得作贴纸，拍摄合成后保存分享。设置支持自定义外观、首页和统计展示等内容。',
  default:
    '拍立得贴纸相机选择拍立得作贴纸，拍摄合成后保存分享。桌面小组件可展示拍立得和下一场活动。设置支持自定义外观、首页和统计展示等内容。',
})!;

const FEATURES_ENTRY = Platform.select({
  android: '拍立得贴纸相机：我的 → 工具箱',
  default: '拍立得贴纸相机：我的 → 工具箱；小组件：设置 → 小组件',
})!;

const OnboardingGuideContext = createContext<{ showHelp: () => void } | null>(null);

const GUIDE_PAGES: GuidePage[] = [
  {
    key: 'homeEvents',
    title: '首页与活动',
    body: '支持自定义首页，展示未来活动等信息。创建活动，从公告或链接中自动解析活动信息。',
    entry: '首页右上角「新建」开始记录；右上角设置可自定义首页内容。',
  },
  {
    key: 'artists',
    title: '艺人管理',
    body: '支持记录个人和团体，包括成员和所属关系。支持设置全屏背景图。设置单推后，在 app 内各处优先展示。',
    entry: '在「我的」页管理艺人、设置单推。',
  },
  {
    key: 'cheki',
    title: '电子切册',
    body: '添加拍立得记录，可自由选择是否添加图片，并以相册和记录模式进行浏览。',
    entry: '在底部导航「切册」添加拍立得。',
  },
  {
    key: 'dataStats',
    title: '数据与统计',
    body: '所有数据只保存在本地，支持从外部导入和备份、恢复功能。统计页汇总活动、艺人和拍立得等数据，可自定义展示内容。',
    entry: '「我的 → 设置」可备份和恢复数据；「统计」右上角可自定义内容。',
  },
  {
    key: 'features',
    title: '更多功能',
    body: FEATURES_BODY,
    entry: FEATURES_ENTRY,
  },
];

function HomeEventsIllustration() {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
      <View
        style={{
          borderRadius: 22,
          paddingHorizontal: 14,
          paddingVertical: 14,
          backgroundColor: colors.heroBg,
          overflow: 'hidden',
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.26 : 0.12,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        <View style={{ position: 'absolute', top: -24, right: -18, width: 116, height: 116, borderRadius: 58, backgroundColor: colors.heroDecor }} />
        <View style={{ position: 'absolute', bottom: -44, left: 34, width: 96, height: 96, borderRadius: 48, backgroundColor: colors.heroDecorWeak }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 72,
              minHeight: 72,
              borderRadius: 16,
              backgroundColor: colors.heroCalloutBg,
              borderWidth: 1,
              borderColor: colors.heroCalloutBorder,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: colors.heroText,
                fontSize: 32,
                lineHeight: 34,
                fontWeight: '900',
                letterSpacing: -1.8,
                fontVariant: ['tabular-nums'],
              }}
            >
              12
            </Text>
            <Text
              style={{
                color: colors.heroSubtext,
                fontSize: 10.5,
                lineHeight: 13,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              天后
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text style={{ color: colors.heroEyebrow, fontSize: 10, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8 }}>
              最近活动
            </Text>
            <Text numberOfLines={2} style={{ color: colors.heroText, fontSize: 14, lineHeight: 19, fontWeight: '800' }}>
              XXX ONE MAN LIVE
            </Text>
            <Text numberOfLines={1} style={{ color: colors.heroSubtext, fontSize: 11.5, lineHeight: 15, fontWeight: '500' }}>
              05-23 · 18:30 · Live house
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
        <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: colors.accent }} />
        <Text style={{ fontSize: 12.5, lineHeight: 15, fontWeight: '800', color: colors.accent }}>创建活动</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.accentSoft }} />
      </View>

      <View
        style={{
          borderRadius: 13,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.12 : 0.07,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 9.5, lineHeight: 12, fontWeight: '700', color: colors.textMuted }}>活动名称</Text>
            <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13.5, lineHeight: 17, fontWeight: '700', color: colors.text }}>
              XXX ONE MAN LIVE
            </Text>
          </View>
          <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
            <AppIcon name="add" size={16} color={colors.accent} />
          </View>
        </View>

        <View style={{ height: 0.5, marginVertical: 8, backgroundColor: colors.divider }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <AppIcon name="eventDate" size={11} color={colors.textMuted} />
            <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
              2026-05-23
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <AppIcon name="time" size={11} color={colors.textMuted} />
            <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>
              18:30
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ArtistsIllustration() {
  const { colors, isDark } = useAppTheme();
  const tileBg = isDark ? colors.cardMuted : colors.cardAlt;
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
      <View
        style={{
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.1 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.oshiAvatarBg,
              marginRight: 12,
            }}
          >
            <AppIcon name="oshi" size={18} color={colors.oshiBadgeBg} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, lineHeight: 19, fontWeight: '600', color: colors.text }}>
                示例艺人
              </Text>
              <View style={{ height: 18, borderRadius: 99, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.oshiBadgeBg }}>
                <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: '700', color: colors.oshiBadgeText }}>个人</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, color: colors.textSecondary, marginTop: 2 }}>
              3 场活动
            </Text>
          </View>
          <AppIcon name="favorite" variant="active" size={18} color={colors.danger} />
        </View>

        <View style={{ height: 0.5, backgroundColor: colors.divider, marginLeft: 68, marginRight: 16 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tileBg,
              marginRight: 12,
            }}
          >
            <AppIcon name="artist" size={18} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 19, fontWeight: '600', color: colors.text }}>
              示例团体
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 15, color: colors.textSecondary, marginTop: 2 }}>
              团体 · 3 名成员
            </Text>
          </View>
          <AppIcon name="favorite" variant="inactive" size={18} color={colors.chevron} />
        </View>
      </View>

      <View
        style={{
          borderRadius: 18,
          padding: 12,
          backgroundColor: colors.heroBg,
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', top: -30, right: -18, width: 104, height: 104, borderRadius: 52, backgroundColor: colors.heroDecorOshi }} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 14,
            paddingHorizontal: 11,
            paddingVertical: 10,
            backgroundColor: colors.heroCalloutBg,
            borderWidth: 1,
            borderColor: colors.heroCalloutBorder,
          }}
        >
          <AppIcon name="oshi" size={16} color={colors.oshiBadgeBg} />
          <Text numberOfLines={1} style={{ flex: 1, marginLeft: 9, fontSize: 12.5, lineHeight: 16, fontWeight: '700', color: colors.heroText }}>
            这场活动有你推参加哦
          </Text>
        </View>
      </View>
    </View>
  );
}

function ChekiIllustration() {
  const { colors, isDark } = useAppTheme();
  const chekiPalette = [
    colors.oshiBadgeBg,
    colors.accent,
    colors.warning,
    colors.success,
    colors.oshiBadgeBg,
    colors.info,
  ].map((accent) => ({
    bg: withAlpha(accent, isDark ? 0.18 : 0.14),
    accent,
  }));
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View
        style={{
          borderRadius: 20,
          padding: 16,
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.1 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '900', color: colors.heading }}>电子切册</Text>
          <Text style={{ fontSize: 12, lineHeight: 15, fontWeight: '800', color: colors.oshiBadgeBg }}>12 张</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {chekiPalette.slice(0, 5).map((item, index) => (
            <View
              key={index}
              style={{
                width: '18%',
                aspectRatio: 54 / 86,
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: item.bg,
              }}
            >
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', padding: 7 }}>
                <View style={{ width: '72%', height: 4, borderRadius: 999, backgroundColor: item.accent, opacity: 0.55 }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function StatsDataIllustration() {
  const { colors, isDark } = useAppTheme();
  const tileBg = isDark ? colors.cardMuted : colors.cardAlt;
  const cards = [
    {
      title: '活动',
      value: '24',
      unit: '场活动',
      summary: '已完成 18 · 计划中 4',
      bars: [0.38, 0.72, 0.54, 0.9],
      accent: colors.accent,
    },
    {
      title: '拍立得',
      value: '86',
      unit: '张拍立得',
      summary: '关联艺人 12 位',
      bars: [0.46, 0.82, 0.64, 0.76],
      accent: colors.oshiBadgeBg,
    },
  ];

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {cards.map((card) => (
          <View key={card.title} style={{ flex: 1, borderRadius: 20, padding: 14, backgroundColor: colors.card }}>
            <Text style={{ fontSize: 13, lineHeight: 17, fontWeight: '900', color: colors.heading }}>{card.title}</Text>
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 28, lineHeight: 31, fontWeight: '900', color: card.accent, fontVariant: ['tabular-nums'] }}>
                {card.value}
              </Text>
              <Text style={{ marginLeft: 4, fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>{card.unit}</Text>
            </View>
            <Text numberOfLines={1} style={{ marginTop: 7, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: colors.textSecondary }}>
              {card.summary}
            </Text>
            <View style={{ height: 42, marginTop: 13, flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}>
              {card.bars.map((value, index) => (
                <View key={index} style={{ flex: 1, height: 38, justifyContent: 'flex-end' }}>
                  <View style={{ height: Math.max(7, value * 38), borderRadius: 4, backgroundColor: card.accent }} />
                  <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1, backgroundColor: tileBg }} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function FeaturesIllustration() {
  const { colors, isDark } = useAppTheme();
  const tileBg = isDark ? colors.cardMuted : colors.cardAlt;
  const features: { icon: AppIconName; label: string; subtitle: string }[] = [
    { icon: 'camera', label: '拍立得贴纸相机', subtitle: '选择拍立得作贴纸，拍摄合成后保存分享' },
    { icon: 'settings', label: '个性化设置', subtitle: '自定义外观、首页和统计展示内容' },
  ];
  const featuresForPlatform = Platform.OS === 'android'
    ? features
    : [features[0], { icon: 'widget' as const, label: '桌面小组件', subtitle: '展示拍立得回忆和下一场活动' }, features[1]];

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.1 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {featuresForPlatform.map((feature, index) => (
          <View key={feature.label}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tileBg,
                  marginRight: 12,
                }}
              >
                <AppIcon name={feature.icon} size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '700', color: colors.text }}>{feature.label}</Text>
                <Text numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 15, fontWeight: '500', color: colors.textSecondary, marginTop: 2 }}>
                  {feature.subtitle}
                </Text>
              </View>
            </View>
            {index < featuresForPlatform.length - 1 ? (
              <View style={{ height: 0.5, backgroundColor: colors.divider, marginLeft: 68, marginRight: 16 }} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function GuideIllustration({ pageKey }: { pageKey: GuidePageKey }) {
  if (pageKey === 'homeEvents') return <HomeEventsIllustration />;
  if (pageKey === 'artists') return <ArtistsIllustration />;
  if (pageKey === 'cheki') return <ChekiIllustration />;
  if (pageKey === 'dataStats') return <StatsDataIllustration />;
  return <FeaturesIllustration />;
}

function OnboardingGuideOverlay({
  manualVisible,
  onManualClose,
}: {
  manualVisible: boolean;
  onManualClose: () => void;
}) {
  const { colors, isDark, isHydrated } = useAppTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isAutoVisible, setIsAutoVisible] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!isHydrated) return;
    let isActive = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!isActive) return;
        setIsAutoVisible(value !== 'true');
      })
      .catch(() => {
        if (!isActive) return;
        setIsAutoVisible(true);
      })
      .finally(() => {
        if (!isActive) return;
        setIsChecking(false);
      });

    return () => {
      isActive = false;
    };
  }, [isHydrated]);

  useEffect(() => () => {
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
  }, []);

  useEffect(() => {
    if (!manualVisible && !isAutoVisible) return;
    setPageIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [isAutoVisible, manualVisible, width]);

  const handleModalShow = () => {
    setIsInteractive(false);
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);

    unlockTimerRef.current = setTimeout(() => {
      unlockTimerRef.current = null;
      setIsInteractive(true);
    }, INTERACTION_UNLOCK_DELAY_MS);
  };

  const completeGuide = async () => {
    if (!isInteractive) return;

    setIsInteractive(false);
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }

    if (manualVisible) {
      onManualClose();
      return;
    }

    setIsAutoVisible(false);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // The guide should not trap users if storage is temporarily unavailable.
    }
  };

  const goNext = () => {
    if (!isInteractive) return;
    if (pageIndex >= GUIDE_PAGES.length - 1) {
      void completeGuide();
      return;
    }
    const nextIndex = pageIndex + 1;
    setPageIndex(nextIndex);
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setPageIndex(Math.max(0, Math.min(nextIndex, GUIDE_PAGES.length - 1)));
  };

  const isVisible = manualVisible || isAutoVisible;

  if ((!manualVisible && isChecking) || !isVisible) return null;

  const imageHeight = Math.min(310, Math.max(238, width * 0.72));
  const isLastPage = pageIndex === GUIDE_PAGES.length - 1;

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onShow={handleModalShow}
      onRequestClose={() => { void completeGuide(); }}
    >
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.screen }}>
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: colors.textMuted }}>OTA LOG</Text>
                  <Text style={{ marginTop: 3, fontSize: 18, fontWeight: '900', color: colors.heading }}>你的偶活记录本</Text>
                </View>
                <TouchableOpacity
                  disabled={!isInteractive}
                  onPress={() => { void completeGuide(); }}
                  accessibilityRole="button"
                  accessibilityLabel="跳过引导"
                  accessibilityState={{ disabled: !isInteractive }}
                  hitSlop={12}
                  style={{ paddingVertical: 4, paddingLeft: 12 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>跳过</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              scrollEnabled={isInteractive}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              onMomentumScrollEnd={handleMomentumEnd}
              scrollEventThrottle={16}
            >
              {GUIDE_PAGES.map((page) => (
                <View key={page.key} style={{ width, paddingHorizontal: 20 }}>
                  <View
                    style={{
                      height: imageHeight,
                      borderRadius: 26,
                      padding: 18,
                      backgroundColor: isDark ? colors.card : colors.white,
                      overflow: 'hidden',
                    }}
                  >
                    <GuideIllustration pageKey={page.key} />
                  </View>
                  <View style={{ paddingTop: 24 }}>
                    <Text style={{ fontSize: 24, lineHeight: 31, fontWeight: '900', color: colors.heading }}>{page.title}</Text>
                    <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 23, color: colors.textSecondary }}>{page.body}</Text>
                    <View
                      style={{
                        marginTop: 16,
                        flexDirection: 'row',
                        gap: 8,
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: isDark ? colors.card : colors.accentSofter,
                      }}
                    >
                      <AppIcon name="navigate" size={18} color={colors.accent} />
                      <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700', color: colors.text }}>{page.entry}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 18 }}>
                {GUIDE_PAGES.map((page, index) => (
                  <View
                    key={page.key}
                    style={{
                      width: index === pageIndex ? 22 : 7,
                      height: 7,
                      borderRadius: 999,
                      backgroundColor: index === pageIndex ? colors.accent : colors.accentSoft,
                    }}
                  />
                ))}
              </View>
              <TouchableOpacity
                disabled={!isInteractive}
                onPress={goNext}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={isLastPage ? '开始使用' : '下一步'}
                accessibilityState={{ disabled: !isInteractive }}
                style={{ height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}
              >
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.onAccent }}>{isLastPage ? '开始使用' : '下一步'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

export function OnboardingGuideProvider({ children }: { children: ReactNode }) {
  const [manualVisible, setManualVisible] = useState(false);

  return (
    <OnboardingGuideContext.Provider value={{ showHelp: () => setManualVisible(true) }}>
      {children}
      <OnboardingGuideOverlay manualVisible={manualVisible} onManualClose={() => setManualVisible(false)} />
    </OnboardingGuideContext.Provider>
  );
}

export function useOnboardingGuide() {
  const value = useContext(OnboardingGuideContext);
  if (!value) {
    throw new Error('useOnboardingGuide must be used within OnboardingGuideProvider');
  }
  return value;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
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

const STORAGE_KEY = 'ota-log.onboarding-guide-seen.v1';

type GuidePageKey = 'home' | 'compose' | 'oshi' | 'memory';

interface GuidePage {
  key: GuidePageKey;
  title: string;
  body: string;
  entry: string;
  label: string;
}

const OnboardingGuideContext = createContext<{ showHelp: () => void } | null>(null);

const GUIDE_PAGES: GuidePage[] = [
  {
    key: 'compose',
    title: '记录活动信息',
    body: '记录时间、场地、出演者等信息。\n使用解析功能从微博链接或文本自动提取数据。',
    entry: '从首页或所有活动右上角新建一场活动。',
    label: '新建活动',
  },
  {
    key: 'home',
    title: '下一场活动，一眼看到',
    body: '首页会展示最近计划中和已完成的活动，方便确认时间、场地和倒计时。',
    entry: '最近的一场活动将被置顶展示',
    label: '首页',
  },
  {
    key: 'oshi',
    title: '把单推放在最前面',
    body: '设置单推后，会显示专属标记，并在活动、艺人、电子切册和统计等页面优先展示。',
    entry: '进入「我的」页，点击「选择单推」设置。',
    label: '单推',
  },
  {
    key: 'memory',
    title: '回顾你参与的活动',
    body: '使用电子切册来保存你的回忆，\n或者在统计页面查看各种统计数据。',
    entry: '在底部导航「切册」添加拍立得。',
    label: '电子切册 / 统计',
  },
];

function Pill({
  icon,
  text,
  accent,
  bg,
}: {
  icon: AppIconName;
  text: string;
  accent: string;
  bg: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: bg }}>
      <AppIcon name={icon} size={12} color={accent} />
      <Text style={{ fontSize: 11, fontWeight: '800', color: accent }}>{text}</Text>
    </View>
  );
}

function MockInput({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>{label}</Text>
      <View style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: isDark ? colors.cardMuted : colors.cardAlt }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{value}</Text>
      </View>
    </View>
  );
}

function HomeIllustration() {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View
        style={{
          borderRadius: 22,
          paddingHorizontal: 14,
          paddingVertical: 14,
          marginBottom: 14,
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
            <Text
              style={{
                color: colors.heroEyebrow,
                fontSize: 10,
                lineHeight: 12,
                fontWeight: '800',
                letterSpacing: 0.8,
              }}
            >
              最近活动
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: colors.heroText,
                fontSize: 14,
                lineHeight: 19,
                fontWeight: '800',
              }}
            >
              IDOL FES
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.heroSubtext,
                fontSize: 11.5,
                lineHeight: 15,
                fontWeight: '500',
              }}
            >
              05-01 · 12:00 · Live house
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingHorizontal: 4 }}>
        <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: colors.accent }} />
        <Text style={{ fontSize: 12.5, lineHeight: 15, fontWeight: '800', color: colors.accent }}>本周</Text>
        <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '500', color: colors.textMuted }}>5月19日-5月25日</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.accentSoft }} />
      </View>

      <View style={{ position: 'relative', paddingHorizontal: 4 }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 27,
            top: 46,
            bottom: -8,
            width: 1.5,
            borderRadius: 999,
            backgroundColor: colors.accentSofter,
          }}
        />
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 13,
            flexDirection: 'row',
            overflow: 'hidden',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.12 : 0.07,
            shadowRadius: 10,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 46,
              paddingHorizontal: 4,
              paddingTop: 8,
              paddingBottom: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.status.planned.bg,
              borderRightWidth: 3,
              borderRightColor: colors.status.planned.accent,
            }}
          >
            <Text
              style={{
                color: colors.status.planned.accent,
                fontSize: 18.5,
                lineHeight: 21,
                fontWeight: '900',
                fontVariant: ['tabular-nums'],
              }}
            >
              23
            </Text>
            <Text
              style={{
                color: colors.status.planned.accent,
                opacity: isDark ? 0.9 : 0.68,
                fontSize: 8.75,
                lineHeight: 10.5,
                fontWeight: '700',
                marginTop: 1,
              }}
            >
              五月
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9 }}>
            <Text
              numberOfLines={2}
              style={{
                color: colors.text,
                fontSize: 15,
                lineHeight: 19,
                fontWeight: '700',
              }}
            >
              XXX ONE MAN LIVE
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, marginTop: 6, minHeight: 16 }}>
              <AppIcon name="time" size={11} color={colors.textMuted} />
              <Text
                style={{
                  fontSize: 12.5,
                  lineHeight: 14.5,
                  fontWeight: '800',
                  color: colors.textSecondary,
                  flexShrink: 0,
                  fontVariant: ['tabular-nums'],
                }}
              >
                18:30
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, marginTop: 5, minHeight: 16 }}>
              <AppIcon name="eventLocation" size={11} color={colors.textMuted} />
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  fontSize: 12,
                  lineHeight: 14.5,
                  fontWeight: '500',
                  color: colors.textSecondary,
                }}
              >
                Live house
              </Text>
              <View
                style={{
                  flexShrink: 0,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  backgroundColor: colors.cityBadgeBg,
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    lineHeight: 11,
                    fontWeight: '600',
                    color: colors.cityBadgeText,
                  }}
                >
                  上海
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function ComposeIllustration() {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={{ borderRadius: 22, padding: 16, backgroundColor: colors.card, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: colors.heading }}>新建活动</Text>
        </View>
        <MockInput label="标题" value="XXX ONE MAN LIVE" isDark={isDark} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2 }}>
          <View style={{ width: '47%' }}>
            <MockInput label="日期" value="2026-05-23" isDark={isDark} />
          </View>
          <View style={{ width: '47%' }}>
            <MockInput label="时间" value="18:30" isDark={isDark} />
          </View>
        </View>
        <View style={{ borderRadius: 14, padding: 12, backgroundColor: isDark ? colors.cardMuted : colors.accentSofter }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted }}>出演者</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          </View>
        </View>
      </View>
    </View>
  );
}

function OshiIllustration() {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 18,
          overflow: 'hidden',
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.oshiAvatarBg, marginRight: 12 }}>
            <AppIcon name="oshi" size={18} color={colors.oshiBadgeBg} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                numberOfLines={1}
                style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text }}
              >
                羽生萌萌香
              </Text>
              <View style={{ height: 18, borderRadius: 99, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.oshiBadgeBg }}>
                <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: '700', color: colors.oshiBadgeText }}>单推</Text>
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
            >
              前往设置页选择你的单推
            </Text>
          </View>
          <AppIcon name="disclosure" variant="forward" size={16} color={colors.chevron} />
        </View>
      </View>

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
        <View style={{ position: 'absolute', top: -24, right: -18, width: 116, height: 116, borderRadius: 58, backgroundColor: colors.heroDecorOshi }} />
        <View style={{ position: 'absolute', bottom: -44, left: 34, width: 96, height: 96, borderRadius: 48, backgroundColor: colors.heroDecorWeak }} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 16,
            paddingHorizontal: 10,
            paddingVertical: 9,
            backgroundColor: colors.heroCalloutBg,
            borderWidth: 1,
            borderColor: colors.heroCalloutBorder,
          }}
        >
          <View style={{ marginRight: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.oshiAvatarBg,
              }}
            >
              <AppIcon name="oshi" size={14} color={colors.oshiBadgeBg} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: colors.heroText,
                fontSize: 12.5,
                lineHeight: 15,
                fontWeight: '700',
                marginBottom: 2,
              }}
            >
              这场活动有你推参加哦
            </Text>
            <Text
              style={{
                color: colors.heroCalloutSubtext,
                fontSize: 11.5,
                lineHeight: 13.5,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              羽生萌萌香
            </Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <View style={{ height: 18, borderRadius: 99, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.oshiBadgeBg }}>
              <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: '700', color: colors.oshiBadgeText }}>单推</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function MemoryIllustration() {
  const { colors, isDark } = useAppTheme();
  const tileBg = isDark ? colors.cardMuted : colors.cardAlt;
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
    <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, borderRadius: 20, padding: 14, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.heading }}>电子切册</Text>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.oshiBadgeBg }}>12张</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 }}>
            {chekiPalette.map((item, index) => (
              <View
                key={index}
                style={{
                  width: '31%',
                  aspectRatio: 54 / 86,
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: item.bg,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: 7,
                  }}
                >
                  <View
                    style={{
                      width: '72%',
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: item.accent,
                      opacity: 0.55,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flex: 1, borderRadius: 20, padding: 14, backgroundColor: colors.card }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.heading }}>年度统计</Text>
          <Text style={{ marginTop: 14, fontSize: 28, fontWeight: '900', color: colors.accent }}>24</Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>场活动</Text>
          <View style={{ marginTop: 16, gap: 6 }}>
            {[0.9, 0.62, 0.42].map((value, index) => (
              <View key={index} style={{ height: 7, borderRadius: 4, backgroundColor: tileBg }}>
                <View style={{ width: `${value * 100}%`, height: 7, borderRadius: 4, backgroundColor: index === 0 ? colors.accent : colors.oshiBadgeBg }} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function GuideIllustration({ pageKey }: { pageKey: GuidePageKey }) {
  if (pageKey === 'home') return <HomeIllustration />;
  if (pageKey === 'compose') return <ComposeIllustration />;
  if (pageKey === 'oshi') return <OshiIllustration />;
  return <MemoryIllustration />;
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
  const [isChecking, setIsChecking] = useState(true);
  const [isAutoVisible, setIsAutoVisible] = useState(false);
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

  useEffect(() => {
    if (!manualVisible && !isAutoVisible) return;
    setPageIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [isAutoVisible, manualVisible, width]);

  const completeGuide = async () => {
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
    if (pageIndex >= GUIDE_PAGES.length - 1) {
      completeGuide();
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
      onRequestClose={manualVisible ? onManualClose : completeGuide}
    >
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.screen }}>
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: colors.textMuted }}>OTA LOG</Text>
                <Text style={{ marginTop: 3, fontSize: 18, fontWeight: '900', color: colors.heading }}>你的偶活记录本</Text>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              onMomentumScrollEnd={handleMomentumEnd}
              scrollEventThrottle={16}
            >
              {GUIDE_PAGES.map((page) => (
                <View key={page.key} style={{ width, paddingHorizontal: 20 }}>
                  <View style={{ height: imageHeight, borderRadius: 26, padding: 18, backgroundColor: isDark ? colors.card : colors.white, overflow: 'hidden' }}>
                    <GuideIllustration pageKey={page.key} />
                  </View>
                  <View style={{ paddingTop: 24 }}>
                    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.accentSoft, marginBottom: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: colors.accentText }}>{page.label}</Text>
                    </View>
                    <Text style={{ fontSize: 24, lineHeight: 31, fontWeight: '900', color: colors.heading }}>{page.title}</Text>
                    <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 23, color: colors.textSecondary }}>{page.body}</Text>
                    <View style={{ marginTop: 16, flexDirection: 'row', gap: 8, padding: 12, borderRadius: 16, backgroundColor: isDark ? colors.card : colors.accentSofter }}>
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
              <TouchableOpacity onPress={goNext} activeOpacity={0.72} style={{ height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
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

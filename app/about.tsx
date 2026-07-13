import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../src/components/AppIcon';
import { MenuCard, MenuItem, SectionLabel } from '../src/components/SettingsMenu';
import { useOnboardingGuide } from '../src/components/OnboardingGuide';
import { useAppTheme } from '../src/theme/appTheme';

const FEATURE_ITEMS = [
  '支持保存活动信息，包括时间、场地、出演者等，支持从微博解析',
  '在首页查看你的下一场活动',
  '单推功能，单推专属标记，置顶展示',
  '拍立得记录，保存珍贵回忆，支持关联活动、偶像、价格等',
  '自动生成统计，查看年度活动、花费和常去场地等',
];

const RELEASE_NOTES = [
  {
    version: '1.5.0',
    date: '2026-07-09',
    highlights: [
      '首页全新升级，支持多种自定义信息卡片',
      '新增倒数日/纪念日功能，支持在首页和日历快速查看',
      '电子切册功能全方面升级，新增多种浏览方式',
      '优化日历界面的显示效果，支持显示拍立得小图',
      '重新设计默认主题，全方位优化视觉效果',
      '升级图片查看组件，浏览更顺滑稳定',
      '修复已知问题',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-06-22',
    highlights: [
      '优化集章规划器',
      '修复暗色模式下文字不可读的问题',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-06-18',
    highlights: [
      '新增 Ultima 夏日集章规划工具',
      '新增活动链接长按复制功能',
      '新增主题功能',
      '修复已知问题，提升整体稳定性',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-11',
    highlights: [
      '活动、艺人和拍立得新增更完整的搜索与筛选',
      '统计支持按月份和所有时间查看',
      '支持从微博关注列表批量导入艺人',
      '资料图和拍立得支持双指缩放与全屏滑动浏览',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-28',
    highlights: [
      '新增艺人详情背景图视觉效果',
      '新增拍立得记录功能，只填张数和总价即可记录',
      '优化拍立得功能的性能和使用，浏览、图片导入时更流畅，可同时拍照和选择图片',
      '优化解析效果，提升解析准确度',
      '优化 app 各个页面的展示效果',
      '修复已知问题，提升整体稳定性',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-21',
    highlights: [
      '新增关于页面，可在应用内直接查看功能简介与版本更新',
      '新增首次使用引导浮层，帮助快速熟悉首页、新建活动、单推和电子切册入口',
      '底部导航重做为浮动式 Tab 栏，切换反馈和主入口辨识度更明确',
      '修复微博无法登录的问题',
      '新增应用图标',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-19',
    highlights: [
      '支持将活动加入系统日历',
      '优化拍立得预览界面和展示体验',
      '新增显示模式和日历默认视图设置',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-16',
    highlights: [
      '1.0 正式版发布',
    ],
  },
];

function FeatureRow({
  text,
  accent,
  textColor,
}: {
  text: string;
  accent: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 9,
      }}
    >
      <View
        style={{
          width: 18,
          paddingTop: 7,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: textColor }}>{text}</Text>
    </View>
  );
}

function ReleaseNoteCard({
  version,
  date,
  highlights,
  colors,
}: {
  version: string;
  date: string;
  highlights: string[];
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 16,
        marginBottom: 10,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{`v${version}`}</Text>
        <View
          style={{
            borderRadius: 999,
            backgroundColor: colors.accentSoft,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>{date}</Text>
        </View>
      </View>

      {highlights.map((item, index) => (
        <View
          key={`${version}-${index}`}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingTop: index === 0 ? 0 : 7,
          }}
        >
          <Text style={{ width: 18, fontSize: 13, lineHeight: 20, color: colors.textMuted }}>•</Text>
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AboutScreen() {
  const { colors, isDark } = useAppTheme();
  const { showHelp } = useOnboardingGuide();

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.screen }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: colors.heroBg,
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: 24,
            padding: 20,
            marginBottom: 20,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -14,
              right: -14,
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: colors.heroDecor,
            }}
          />
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.heroText, marginBottom: 6 }}>OTA LOG</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.heroSubtext }}>
            本地优先的演出记录 App，帮你整理活动、单推、拍立得和回顾数据。
          </Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="帮助" />
          <MenuCard>
            <MenuItem
              icon="help"
              label="重新查看帮助"
              subtitle="再次播放新用户引导"
              tint={colors.accent}
              isLast
              onPress={showHelp}
            />
          </MenuCard>
        </View>

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="应用功能" />
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 4,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {FEATURE_ITEMS.map((item) => (
              <FeatureRow key={item} text={item} accent={colors.accentText} textColor={colors.text} />
            ))}
          </View>
        </View>

        <View>
          <SectionLabel label="版本更新" />
          {RELEASE_NOTES.map((note) => (
            <ReleaseNoteCard
              key={note.version}
              version={note.version}
              date={note.date}
              highlights={note.highlights}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

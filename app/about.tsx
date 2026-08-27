import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MenuCard, MenuItem, SectionLabel } from '../src/components/SettingsMenu';
import { useAppTheme } from '../src/theme/appTheme';
import { APP_VERSION_LABEL } from '../src/utils/appInfo';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../src/utils/safeArea';

const FEATURE_ITEMS = [
  '支持保存活动信息，包括时间、场地、出演者等，支持从微博解析',
  '在首页查看你的下一场活动',
  '单推功能，单推专属标记，置顶展示',
  '拍立得记录，保存珍贵回忆，支持关联活动、偶像、价格等',
  '自动生成统计，查看年度活动、花费和常去场地等',
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

export default function AboutScreen() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
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
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 12,
              borderRadius: 999,
              backgroundColor: colors.accentSoft,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>
              {`v${APP_VERSION_LABEL}`}
            </Text>
          </View>
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

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="隐私与数据" />
          <MenuCard>
            <MenuItem
              icon="locked"
              label="隐私与数据"
              subtitle="了解本地存储、权限用途与数据删除方式"
              tint={colors.info}
              isLast
              onPress={() => router.push('/privacy')}
            />
          </MenuCard>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

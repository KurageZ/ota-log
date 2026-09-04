import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { MenuCard, MenuIconTile, MenuItem, MenuRowSeparator, SectionLabel } from '../components/SettingsMenu';
import { useAppTheme } from '../theme/appTheme';
import { APP_VERSION_LABEL } from '../utils/appInfo';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../utils/safeArea';

const PRIVACY_POLICY_URL = 'https://kuragez.github.io/ota-log/privacy/';

type PrivacyInfoItem = {
  icon: AppIconName;
  title: string;
  description: string;
};

const PERMISSION_ITEMS: PrivacyInfoItem[] = [
  {
    icon: 'images',
    title: '照片',
    description: '用于从照片库选择头像、艺人图片、活动资料图和拍立得照片，以及保存你主动生成的分享图片。',
  },
  {
    icon: 'camera',
    title: '相机',
    description: '仅在你拍摄拍立得照片或制作贴纸照片时使用，不访问麦克风。',
  },
  {
    icon: 'calendar',
    title: '日历',
    description: '仅在你选择“添加到日历”时，用于将活动信息写入系统日历。',
  },
];

function PrivacyInfoRows({ items }: { items: PrivacyInfoItem[] }) {
  const { colors } = useAppTheme();

  return (
    <MenuCard>
      {items.map((item, index) => (
        <View key={item.title}>
          <View
            style={{
              minHeight: 72,
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <MenuIconTile
              name={item.icon}
              tint={colors.info}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                {item.title}
              </Text>
              <Text
                selectable
                style={{ marginTop: 4, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}
              >
                {item.description}
              </Text>
            </View>
          </View>
          {index < items.length - 1 ? <MenuRowSeparator /> : null}
        </View>
      ))}
    </MenuCard>
  );
}

function PrivacyTextCard({ children }: { children: string }) {
  const { colors } = useAppTheme();

  return (
    <MenuCard>
      <Text
        selectable
        style={{ padding: 16, fontSize: 13, lineHeight: 21, color: colors.textSecondary }}
      >
        {children}
      </Text>
    </MenuCard>
  );
}

export default function PrivacyScreen() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView
      edges={SCROLL_SCREEN_SAFE_AREA_EDGES}
      style={{ flex: 1, backgroundColor: colors.screen }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 18,
            backgroundColor: colors.infoSoft,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.card,
              marginRight: 12,
            }}
          >
            <AppIcon name="locked" size={21} color={colors.info} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.heading }}>
              你的记录由你保管
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
              ota log 是本地优先的应用，不需要注册 ota log 账号。
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="本地存储" />
          <PrivacyTextCard>
            你的昵称、头像、活动、艺人、拍立得、重要日期、备注、花费和图片保存在当前设备的应用私有存储中。ota log 没有自建账号服务、云端同步、广告或使用行为分析。
          </PrivacyTextCard>
        </View>

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="权限用途" />
          <PrivacyInfoRows items={PERMISSION_ITEMS} />
        </View>

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="联网与第三方服务" />
          <PrivacyTextCard>
            当你主动使用微博解析、微博登录、关注导入或 iEvent 活动导入时，ota log 会直接连接对应的第三方服务以完成请求。微博登录状态只保存在当前设备，可在“微博登录”页面清除。第三方服务会按其自身规则处理网络请求。
          </PrivacyTextCard>
        </View>

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="控制与删除" />
          <PrivacyTextCard>
            你可以在 App 内删除对应的活动、艺人、拍立得和其他记录，并可在系统设置中撤回相机、照片或日历权限。卸载 App 会删除其应用私有存储；你主动导出的备份文件需要在保存位置单独删除。
          </PrivacyTextCard>
        </View>

        <View style={{ marginBottom: 20 }}>
          <SectionLabel label="完整政策" />
          <MenuCard>
            <MenuItem
              icon="externalLink"
              label="查看完整隐私政策"
              subtitle="在浏览器中打开"
              tint={colors.info}
              isLast
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            />
          </MenuCard>
        </View>

        <Text
          selectable
          style={{ textAlign: 'center', fontSize: 12, lineHeight: 18, color: colors.text }}
        >
          {`适用于 ota log v${APP_VERSION_LABEL} · 更新于 2026-08-27`}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

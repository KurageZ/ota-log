import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MenuCard, MenuItem, SectionLabel } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const MIX_AND_CALL_URL = 'https://dzyxdd.github.io/MixAndCall/';
const IEVENT_URL = 'https://ievent.life/';

export default function ToolboxScreen() {
  const { colors } = useAppTheme();
  const toolTints = colors.toolsMenu;
  const weiboTint = colors.settingsMenu.weibo;
  const showChekiCropDemo = __DEV__ && process.env.EXPO_OS === 'ios';

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {process.env.EXPO_OS !== 'web' ? (
          <View style={{ marginBottom: 16 }}>
            <SectionLabel label="影像" />
            <MenuCard>
              <MenuItem
                icon="camera"
                label="拍立得贴纸相机"
                subtitle="选择拍立得作贴纸，拍摄合成后保存分享"
                tint={toolTints.planner}
                isLast={!showChekiCropDemo}
                onPress={() => router.push('/tools/cheki-sticker-camera')}
              />
              {showChekiCropDemo ? (
                <MenuItem
                  icon="cheki"
                  label="拍立得自动裁切"
                  subtitle="系统扫描裁切，白边取样校正色偏"
                  badge="Demo"
                  tint={toolTints.planner}
                  isLast
                  onPress={() => router.push('/tools/cheki-crop')}
                />
              ) : null}
            </MenuCard>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="数据" />
          <MenuCard>
            <MenuItem
              icon="backupRestore"
              label="外部数据导入"
              subtitle="选择兼容备份文件，预览后增量添加记录"
              tint={toolTints.artistImport}
              onPress={() => router.push('/tools/chekiroku-import')}
            />
            <MenuItem
              icon="weiboImport"
              label="微博关注导入"
              subtitle="从微博关注列表批量导入艺人"
              tint={toolTints.artistImport}
              onPress={() => router.push('/tools/weibo-following')}
            />
            <MenuItem
              icon="login"
              label="登录微博"
              subtitle="保存微博登录状态，供抓取功能使用"
              tint={weiboTint}
              isLast
              onPress={() => router.push('/weibo')}
            />
          </MenuCard>
        </View>

        <View>
          <SectionLabel label="外部网站" />
          <MenuCard>
            <MenuItem
              icon="weibo"
              label="MixAndCall"
              subtitle="查 call 本 · 找 mix · 对公演 / EP / 单曲"
              tint={toolTints.external}
              onPress={() => Linking.openURL(MIX_AND_CALL_URL)}
            />
            <MenuItem
              icon="externalLink"
              label="推活日记"
              subtitle="查看 Live、见面会和演出情报"
              tint={toolTints.external}
              isLast
              onPress={() => Linking.openURL(IEVENT_URL)}
            />
          </MenuCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MenuCard, MenuItem, SectionLabel } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';

const MIX_AND_CALL_URL = 'https://dzyxdd.github.io/MixAndCall/mix/mix/';

export default function ToolboxScreen() {
  const { colors } = useAppTheme();
  const toolTints = colors.toolsMenu;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.screen }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="规划" />
          <MenuCard>
            <MenuItem
              icon="ticket"
              label="Ultima 集章规划"
              subtitle="规划夏日集章目标、活动与消费"
              tint={toolTints.planner}
              isLast
              onPress={() => router.push('/tools/ultima-stamp-planner')}
            />
          </MenuCard>
        </View>

        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="艺人导入" />
          <MenuCard>
            <MenuItem
              icon="weiboImport"
              label="微博关注导入"
              subtitle="从微博关注列表批量导入艺人"
              tint={toolTints.artistImport}
              isLast
              onPress={() => router.push('/tools/weibo-following')}
            />
          </MenuCard>
        </View>

        <View>
          <SectionLabel label="外部工具" />
          <MenuCard>
            <MenuItem
              icon="weibo"
              label="MIX & Call"
              subtitle="将打开外部网站"
              tint={toolTints.external}
              isLast
              onPress={() => Linking.openURL(MIX_AND_CALL_URL)}
            />
          </MenuCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

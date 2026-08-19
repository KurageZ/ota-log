import { useCallback, useMemo, useState } from 'react';
import { Alert, DevSettings, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useDB } from '../../src/context/DBContext';
import { Artist, UserConfig } from '../../src/types/models';
import { getArtistDisplayText, getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { formatBytes, getStorageTotalBytes } from '../../src/utils/storageUsage';
import { findOrphanArtistIds, removeOrphanArtists } from '../../src/db/maintenance';
import { resetAppForDevelopment } from '../../src/utils/developerReset';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { MenuCard, MenuItem, SectionLabel } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import { loadChekiPhotoWidgetPreferences } from '../../src/widgets/chekiPhotoWidgetPreferences';

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const db = useDB();

  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [widgetArtistIds, setWidgetArtistIds] = useState<string[]>([]);
  const [isClearingAllData, setIsClearingAllData] = useState(false);
  const [isRemovingOrphanArtists, setIsRemovingOrphanArtists] = useState(false);
  const [storageTotalBytes, setStorageTotalBytes] = useState<number | null>(null);
  const showDeveloperOptions = __DEV__;

  const reloadSettingsContext = useCallback(async () => {
    try {
      setStorageTotalBytes(getStorageTotalBytes());
    } catch {
      setStorageTotalBytes(null);
    }
    const [config, artists, photoArtistIds, widgetPreferences] = await Promise.all([
      db.userConfig.getConfig(),
      db.artists.findAll(),
      db.cheki.findDistinctPhotoArtistIds(),
      loadChekiPhotoWidgetPreferences(),
    ]);
    const availableArtistIds = new Set(photoArtistIds);
    setUserConfig(config);
    setAllArtists(artists);
    setWidgetArtistIds(widgetPreferences.artistIds.filter((artistId) => availableArtistIds.has(artistId)));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reloadSettingsContext();
    }, [reloadSettingsContext]),
  );

  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const oshiArtist = allArtists.find((artist) => artist.id === userConfig?.oshi_artist_id) ?? null;
  const oshiDisplay = oshiArtist ? getArtistDisplayText({
    artist: oshiArtist,
    parentName: oshiArtist.parent_id ? artistNameMap[oshiArtist.parent_id] : null,
  }) : null;
  const widgetArtists = allArtists.filter((artist) => widgetArtistIds.includes(artist.id));

  const handleClearAllData = async () => {
    if (isClearingAllData) return;

    Alert.alert(
      '清空所有数据',
      '这会删除所有活动、艺人、拍立得、设置和本地文件，让应用恢复初始状态。确认继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            setIsClearingAllData(true);
            try {
              await resetAppForDevelopment(db.rawDb);
              Alert.alert('已清空', '应用将重新加载以恢复初始状态。', [
                { text: '重新加载', onPress: () => DevSettings.reload() },
              ], { cancelable: false });
            } catch (error) {
              showOperationFailedAlert(
                '清空数据失败。',
                '请稍后再试一次；如果问题持续出现，可以重启应用后重试。',
                error,
              );
            } finally {
              setIsClearingAllData(false);
            }
          },
        },
      ],
    );
  };

  const handleRemoveOrphanArtists = async () => {
    if (isRemovingOrphanArtists) return;

    setIsRemovingOrphanArtists(true);
    try {
      const orphanArtistIds = await findOrphanArtistIds(db.rawDb);
      if (orphanArtistIds.length === 0) {
        Alert.alert('没有孤立艺人', '当前没有需要清理的孤立艺人。');
        return;
      }

      Alert.alert(
        '移除孤立艺人',
        `发现 ${orphanArtistIds.length} 位没有活动或拍立得关联的艺人，确认移除？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '移除',
            style: 'destructive',
            onPress: async () => {
              try {
                const removedCount = await removeOrphanArtists(db.rawDb);
                await reloadSettingsContext();
                Alert.alert('清理完成', `已移除 ${removedCount} 位孤立艺人。`);
              } catch (error) {
                showOperationFailedAlert(
                  '移除孤立艺人失败。',
                  '请稍后再试一次。',
                  error,
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      showOperationFailedAlert(
        '检查孤立艺人失败。',
        '请稍后再试一次。',
        error,
      );
    } finally {
      setIsRemovingOrphanArtists(false);
    }
  };

  const settingsTints = colors.settingsMenu;
  const identityTint = settingsTints.profile;
  const oshiTint = settingsTints.oshi;
  const appearanceTint = settingsTints.appearance;
  const preferenceTint = settingsTints.stats;
  const dataTint = settingsTints.backupExport;

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="个人" />
          <MenuCard>
            <MenuItem
              icon="profile"
              label="个人资料"
              subtitle={userConfig ? `昵称：${userConfig.name}` : '管理昵称和头像'}
              tint={identityTint}
              onPress={() => router.push('/settings/profile')}
            />
            <MenuItem
              icon="oshi"
              label="单推设置"
              subtitle={oshiDisplay ? oshiDisplay.title : '还没有设置单推，设置后会自动加入收藏'}
              tint={oshiTint}
              isLast
              onPress={() => router.push('/settings/oshi')}
            />
          </MenuCard>
        </View>

        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="外观与显示" />
          <MenuCard>
            <MenuItem
              icon="appearance"
              label="外观"
              subtitle="显示模式与主题色"
              tint={appearanceTint}
              onPress={() => router.push('/settings/appearance')}
            />
            <MenuItem
              icon="image"
              label="拍立得展示方式"
              subtitle="艺人、活动、记录详情与切册的图片展示方式"
              tint={preferenceTint}
              isLast
              onPress={() => router.push('/settings/cheki-display')}
            />
          </MenuCard>
        </View>

        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="偏好" />
          <MenuCard>
            <MenuItem
              icon="viewSettings"
              label="功能"
              subtitle="默认视图与出演者确认方式"
              tint={preferenceTint}
              onPress={() => router.push('/settings/features')}
            />
            <MenuItem
              icon="calendar"
              label="日历"
              subtitle="周起始日与月视图展示"
              tint={preferenceTint}
              isLast
              onPress={() => router.push('/settings/calendar')}
            />
          </MenuCard>
        </View>

        {Platform.OS === 'ios' ? (
          <View style={{ marginBottom: 16 }}>
            <SectionLabel label="小组件" />
            <MenuCard>
              <MenuItem
                icon="widget"
                label="拍立得回忆"
                subtitle={widgetArtists.length === 0
                  ? '展示全部艺人的有图拍立得'
                  : widgetArtists.length === 1
                    ? `只展示 ${getArtistPrimaryName(widgetArtists[0])} 的有图拍立得`
                    : `展示 ${getArtistPrimaryName(widgetArtists[0])} 等 ${widgetArtists.length} 位艺人的有图拍立得`}
                tint={settingsTints.widget}
                isLast
                onPress={() => router.push('/settings/widget')}
              />
            </MenuCard>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="数据管理" />
          <MenuCard>
            <MenuItem
              icon="document"
              label="存储空间"
              subtitle={storageTotalBytes != null ? `已用 ${formatBytes(storageTotalBytes)}` : '查看照片、切册与数据库占用'}
              tint={dataTint}
              onPress={() => router.push('/settings/storage')}
            />
            <MenuItem
              icon="backupDownload"
              label="备份和恢复"
              subtitle="生成、保存或恢复完整备份"
              tint={settingsTints.backupRestore}
              onPress={() => router.push('/settings/backup-restore')}
            />
            <MenuItem
              icon="artists"
              label="艺人类型转换"
              subtitle="批量设置个人或团体，并转换普通所属关系"
              tint={dataTint}
              isLast
              onPress={() => router.push('/settings/artist-type-conversion')}
            />
          </MenuCard>
        </View>

        {showDeveloperOptions ? (
          <View>
            <SectionLabel label="高级" />
            <MenuCard>
              <MenuItem
                icon="artists"
                label="移除孤立艺人"
                subtitle="移除没有活动或拍立得关联的艺人"
                badge={isRemovingOrphanArtists ? 'spinner' : undefined}
                tint={settingsTints.cleanup}
                onPress={handleRemoveOrphanArtists}
              />
              <MenuItem
                icon="trash"
                label="清空所有数据"
                subtitle="删除全部数据并恢复初始状态"
                badge={isClearingAllData ? 'spinner' : undefined}
                tint={colors.danger}
                isLast
                onPress={handleClearAllData}
              />
            </MenuCard>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

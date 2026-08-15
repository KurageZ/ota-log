import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { MenuBadge, MenuCard, MenuIconTile, MenuItem } from '../../src/components/SettingsMenu';
import { useDB } from '../../src/context/DBContext';
import { useAppTheme } from '../../src/theme/appTheme';
import { exportFullBackup, importBackup, shareBackupFile } from '../../src/utils/backup';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

type BackupExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'ready'; fileUri: string; filename: string; mediaCount: number; createdAt: string }
  | { status: 'failed' };

function formatBackupCreatedAt(isoString: string): string {
  const date = new Date(isoString);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export default function BackupRestoreSettingsScreen() {
  const { colors } = useAppTheme();
  const db = useDB();

  const [backupExportState, setBackupExportState] = useState<BackupExportState>({ status: 'idle' });
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  const handleExportFullBackup = async () => {
    if (backupExportState.status === 'exporting') return;

    setBackupExportState({ status: 'exporting' });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = await exportFullBackup(db);
      setBackupExportState({
        status: 'ready',
        fileUri: result.destinationUri,
        filename: result.filename,
        mediaCount: result.mediaCount,
        createdAt: new Date().toISOString(),
      });
      Alert.alert('备份完成', '现在可以点击“保存到本地”了。');
    } catch (error) {
      setBackupExportState({ status: 'failed' });
      showOperationFailedAlert(
        '保存失败。',
        '请检查设备剩余空间后再试一次。',
        error,
      );
    }
  };

  const handleShareBackup = async () => {
    if (backupExportState.status !== 'ready') {
      Alert.alert('缺少备份', '先生成一份完整备份，然后再保存到本地。');
      return;
    }

    try {
      await shareBackupFile(backupExportState.fileUri);
    } catch (error) {
      showOperationFailedAlert('无法保存。', '请稍后再试一次。', error);
    }
  };

  const handleImportBackup = async () => {
    if (isImportingBackup) return;

    Alert.alert('恢复备份', '恢复数据会覆盖现有的数据，确认继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsImportingBackup(true);
            const restored = await importBackup(db);
            if (!restored.restored) return;
            if (restored.legacyArtistType) {
              Alert.alert(
                '恢复完成',
                '数据已恢复。这份备份来自不支持“艺人类型”的旧版本，恢复后艺人类型均为未设置。'
                  + '你可以使用「艺人类型转换」批量设置个人或团体，并转换已有的普通所属关系。',
                [
                  { text: '稍后再说', style: 'cancel' },
                  { text: '去转换', onPress: () => router.push('/settings/artist-type-conversion') },
                ],
              );
            } else {
              Alert.alert('恢复完成', '数据已恢复。');
            }
          } catch (error) {
            showOperationFailedAlert(
              '恢复失败。',
              '请确认选择的是正确的备份文件后再试一次。',
              error,
            );
          } finally {
            setIsImportingBackup(false);
          }
        },
      },
    ]);
  };

  const backupMenuBadge: MenuBadge | undefined = (() => {
    if (backupExportState.status === 'exporting') return 'spinner';
    if (backupExportState.status === 'ready') return '已完成';
    if (backupExportState.status === 'failed') return '重试';
    return undefined;
  })();
  const saveBackupBadge = backupExportState.status === 'ready' ? '可保存' : undefined;
  const saveBackupLabel = backupExportState.status === 'ready'
    ? `保存到本地 (${formatBackupCreatedAt(backupExportState.createdAt)})`
    : '保存到本地';
  const importBackupBadge: MenuBadge | undefined = isImportingBackup ? 'spinner' : undefined;

  const settingsTints = colors.settingsMenu;

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '备份和恢复' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={{ marginBottom: 12 }}>
          <MenuCard>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <MenuIconTile tint={settingsTints.backupRestore} name="info" style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                  使用说明
                </Text>
              </View>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                先“生成备份数据”，再“保存到本地”导出完整备份。
              </Text>
              <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                更换设备或数据丢失时，用“恢复备份”导入；恢复会覆盖当前数据。
              </Text>
            </View>
          </MenuCard>
        </View>

        <MenuCard>
          <MenuItem
            icon="backupDownload"
            label="生成备份数据"
            badge={backupMenuBadge}
            tint={settingsTints.backupExport}
            onPress={handleExportFullBackup}
          />
          <MenuItem
            icon="backupSave"
            label={saveBackupLabel}
            badge={saveBackupBadge}
            tint={settingsTints.backupSave}
            onPress={handleShareBackup}
          />
          <MenuItem
            icon="backupRestore"
            label="恢复备份"
            badge={importBackupBadge}
            tint={settingsTints.backupRestore}
            isLast
            onPress={handleImportBackup}
          />
        </MenuCard>
      </ScrollView>
    </SafeAreaView>
  );
}

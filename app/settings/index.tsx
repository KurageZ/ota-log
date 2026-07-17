import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useDB } from '../../src/context/DBContext';
import { Artist, UserConfig } from '../../src/types/models';
import { getArtistDisplayText, getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { cleanupUnreferencedLocalMedia, scanUnreferencedLocalMedia } from '../../src/utils/localMedia';
import { exportFullBackup, importBackup, shareBackupFile } from '../../src/utils/backup';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { AppIcon } from '../../src/components/AppIcon';
import { MenuBadge, MenuCard, MenuItem, SectionLabel } from '../../src/components/SettingsMenu';
import { useAppTheme } from '../../src/theme/appTheme';
import { withAlpha } from '../../src/utils/color';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import {
  AppAppearance,
  AppCalendarDefaultView,
  AppThemeId,
  APP_APPEARANCE_LABELS,
  APP_CALENDAR_DEFAULT_VIEW_LABELS,
  APP_THEME_LABELS,
} from '../../src/theme/config';
import { loadChekiPhotoWidgetPreferences } from '../../src/widgets/chekiPhotoWidgetPreferences';

type BackupExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'ready'; fileUri: string; filename: string; mediaCount: number; createdAt: string }
  | { status: 'failed' };

const APPEARANCE_OPTIONS: AppAppearance[] = ['system', 'light', 'dark'];
const THEME_OPTIONS: AppThemeId[] = ['monoChrome', 'classicViolet', 'nightNeon'];
const CALENDAR_VIEW_OPTIONS: AppCalendarDefaultView[] = ['month', 'timeline'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatBackupCreatedAt(isoString: string): string {
  const date = new Date(isoString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

export default function SettingsScreen() {
  const {
    colors,
    themeId,
    appearance,
    calendarDefaultView,
    setThemeId,
    setAppearance,
    setCalendarDefaultView,
  } = useAppTheme();
  const db = useDB();

  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [widgetArtistIds, setWidgetArtistIds] = useState<string[]>([]);
  const [backupExportState, setBackupExportState] = useState<BackupExportState>({ status: 'idle' });
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isCalendarDefaultViewOpen, setIsCalendarDefaultViewOpen] = useState(false);
  const [pendingAppearance, setPendingAppearance] = useState<AppAppearance | null>(null);
  const [pendingThemeId, setPendingThemeId] = useState<AppThemeId | null>(null);
  const [pendingCalendarDefaultView, setPendingCalendarDefaultView] = useState<AppCalendarDefaultView | null>(null);

  const reloadSettingsContext = useCallback(async () => {
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

  const handleCleanupUnusedMedia = async () => {
    try {
      const scan = await scanUnreferencedLocalMedia(db.rawDb);
      if (scan.unused === 0) {
        Alert.alert('无需清理', '没有发现未使用的本地图片。');
        return;
      }

      Alert.alert(
        '清理未使用图片',
        `发现 ${scan.unused} 个未使用图片文件，预计释放 ${formatBytes(scan.bytes)}。确认删除？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await cleanupUnreferencedLocalMedia(db.rawDb);
                Alert.alert(
                  '清理完成',
                  `已删除 ${result.deleted} 个文件，释放 ${formatBytes(result.bytesFreed)}。${result.failed > 0 ? `失败 ${result.failed} 个。` : ''}`,
                );
              } catch (error) {
                showOperationFailedAlert(
                  '图片清理失败。',
                  '请稍后再试一次；如果问题持续出现，可以稍后重新扫描后再处理。',
                  error,
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      showOperationFailedAlert(
        '图片清理失败。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再检查。',
        error,
      );
    }
  };

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
            if (!restored) return;
            await reloadSettingsContext();
            Alert.alert('恢复完成', '数据已恢复。');
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

  const handleSelectAppearance = async (nextAppearance: AppAppearance) => {
    if (nextAppearance === appearance || pendingAppearance) return;

    setPendingAppearance(nextAppearance);
    try {
      await setAppearance(nextAppearance);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存显示模式。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingAppearance(null);
    }
  };

  const handleSelectThemeId = async (nextThemeId: AppThemeId) => {
    if (nextThemeId === themeId || pendingThemeId) return;

    setPendingThemeId(nextThemeId);
    try {
      await setThemeId(nextThemeId);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存主题色。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingThemeId(null);
    }
  };

  const handleSelectCalendarDefaultView = async (nextView: AppCalendarDefaultView) => {
    if (nextView === calendarDefaultView || pendingCalendarDefaultView) return;

    setPendingCalendarDefaultView(nextView);
    try {
      await setCalendarDefaultView(nextView);
    } catch (error) {
      showOperationFailedAlert(
        '无法保存日历默认视图。',
        '请稍后再试一次；如果问题持续出现，可以重启应用后再尝试修改。',
        error,
      );
    } finally {
      setPendingCalendarDefaultView(null);
    }
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

  const rowTextColor = colors.text;
  const rowSubtitleColor = colors.textSecondary;
  const rowDividerColor = colors.divider;
  const rowChevronColor = colors.chevron;
  const expandedPanelColor = colors.cardMuted;
  const settingsTints = colors.settingsMenu;
  const themeControlTint = settingsTints.theme;
  const identityTint = settingsTints.profile;
  const oshiTint = settingsTints.oshi;
  const appearanceTint = settingsTints.appearance;
  const calendarControlTint = settingsTints.calendar;
  const importTint = settingsTints.backupExport;
  const saveTint = settingsTints.backupSave;
  const restoreTint = settingsTints.backupRestore;

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
          <SectionLabel label="外观" />
          <MenuCard>
            <MenuItem
              icon="filter"
              label="首页自定义"
              subtitle="调整首页卡片顺序和显示内容"
              tint={settingsTints.home}
              onPress={() => router.push('/settings/home')}
            />
            <View style={{ borderBottomWidth: 1, borderBottomColor: rowDividerColor }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setIsThemeOpen(false);
                  setIsCalendarDefaultViewOpen(false);
                  setIsAppearanceOpen((open) => !open);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderBottomWidth: isAppearanceOpen ? 1 : 0,
                  borderBottomColor: rowDividerColor,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: withAlpha(appearanceTint, 0.13),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <AppIcon name="appearance" size={18} color={appearanceTint} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, color: rowTextColor, fontWeight: '500' }}>
                    显示模式
                  </Text>
                </View>
                <Text
                  style={{
                    marginLeft: 12,
                    marginRight: 8,
                    maxWidth: 120,
                    fontSize: 14,
                    color: rowSubtitleColor,
                    fontWeight: '500',
                    textAlign: 'right',
                  }}
                  numberOfLines={1}
                >
                  {APP_APPEARANCE_LABELS[pendingAppearance ?? appearance]}
                </Text>
                {pendingAppearance ? (
                  <View style={{ marginRight: 8 }}>
                    <ActivityIndicator size="small" color={themeControlTint} />
                  </View>
                ) : null}

                <AppIcon
                  name="disclosure"
                  variant={isAppearanceOpen ? 'up' : 'down'}
                  size={16}
                  color={rowChevronColor}
                />
              </TouchableOpacity>

              {isAppearanceOpen ? (
                <View style={{ backgroundColor: expandedPanelColor }}>
                  {APPEARANCE_OPTIONS.map((option, index) => {
                    const selected = (pendingAppearance ?? appearance) === option;
                    const isLast = index === APPEARANCE_OPTIONS.length - 1;

                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.7}
                        disabled={pendingAppearance !== null}
                        onPress={() => handleSelectAppearance(option)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 13,
                          borderBottomWidth: isLast ? 0 : 1,
                          borderBottomColor: rowDividerColor,
                          opacity: pendingAppearance ? 0.7 : 1,
                        }}
                      >
                        <View style={{ width: 46 }} />
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            color: selected ? themeControlTint : rowTextColor,
                            fontWeight: selected ? '700' : '500',
                          }}
                        >
                          {APP_APPEARANCE_LABELS[option]}
                        </Text>
                        {pendingAppearance === option ? (
                          <ActivityIndicator size="small" color={themeControlTint} />
                        ) : (
                          <AppIcon
                            name="radio"
                            variant={selected ? 'selected' : 'unselected'}
                            size={18}
                            color={selected ? themeControlTint : rowChevronColor}
                            secondaryColor={colors.onAccent}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View style={{ borderBottomWidth: 1, borderBottomColor: rowDividerColor }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setIsAppearanceOpen(false);
                  setIsCalendarDefaultViewOpen(false);
                  setIsThemeOpen((open) => !open);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderBottomWidth: isThemeOpen ? 1 : 0,
                  borderBottomColor: rowDividerColor,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: `${themeControlTint}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <AppIcon name="theme" size={18} color={themeControlTint} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, color: rowTextColor, fontWeight: '500' }}>
                    主题色
                  </Text>
                </View>
                <Text
                  style={{
                    marginLeft: 12,
                    marginRight: 8,
                    maxWidth: 120,
                    fontSize: 14,
                    color: rowSubtitleColor,
                    fontWeight: '500',
                    textAlign: 'right',
                  }}
                  numberOfLines={1}
                >
                  {APP_THEME_LABELS[pendingThemeId ?? themeId]}
                </Text>
                {pendingThemeId ? (
                  <View style={{ marginRight: 8 }}>
                    <ActivityIndicator size="small" color={themeControlTint} />
                  </View>
                ) : null}

                <AppIcon
                  name="disclosure"
                  variant={isThemeOpen ? 'up' : 'down'}
                  size={16}
                  color={rowChevronColor}
                />
              </TouchableOpacity>

              {isThemeOpen ? (
                <View style={{ backgroundColor: expandedPanelColor }}>
                  {THEME_OPTIONS.map((option, index) => {
                    const selected = (pendingThemeId ?? themeId) === option;
                    const isLast = index === THEME_OPTIONS.length - 1;

                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.7}
                        disabled={pendingThemeId !== null}
                        onPress={() => handleSelectThemeId(option)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 13,
                          borderBottomWidth: isLast ? 0 : 1,
                          borderBottomColor: rowDividerColor,
                          opacity: pendingThemeId ? 0.7 : 1,
                        }}
                      >
                        <View style={{ width: 46 }} />
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            color: selected ? themeControlTint : rowTextColor,
                            fontWeight: selected ? '700' : '500',
                          }}
                        >
                          {APP_THEME_LABELS[option]}
                        </Text>
                        {pendingThemeId === option ? (
                          <ActivityIndicator size="small" color={themeControlTint} />
                        ) : (
                          <AppIcon
                            name="radio"
                            variant={selected ? 'selected' : 'unselected'}
                            size={18}
                            color={selected ? themeControlTint : rowChevronColor}
                            secondaryColor={colors.onAccent}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setIsAppearanceOpen(false);
                  setIsThemeOpen(false);
                  setIsCalendarDefaultViewOpen((open) => !open);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderBottomWidth: isCalendarDefaultViewOpen ? 1 : 0,
                  borderBottomColor: rowDividerColor,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: withAlpha(calendarControlTint, 0.13),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <AppIcon name="calendar" size={18} color={calendarControlTint} />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, color: rowTextColor, fontWeight: '500' }}>
                    日历默认视图
                  </Text>
                </View>
                <Text
                  style={{
                    marginLeft: 12,
                    marginRight: 8,
                    maxWidth: 120,
                    fontSize: 14,
                    color: rowSubtitleColor,
                    fontWeight: '500',
                    textAlign: 'right',
                  }}
                  numberOfLines={1}
                >
                  {APP_CALENDAR_DEFAULT_VIEW_LABELS[pendingCalendarDefaultView ?? calendarDefaultView]}
                </Text>
                {pendingCalendarDefaultView ? (
                  <View style={{ marginRight: 8 }}>
                    <ActivityIndicator size="small" color={calendarControlTint} />
                  </View>
                ) : null}

                <AppIcon
                  name="disclosure"
                  variant={isCalendarDefaultViewOpen ? 'up' : 'down'}
                  size={16}
                  color={rowChevronColor}
                />
              </TouchableOpacity>

              {isCalendarDefaultViewOpen ? (
                <View style={{ backgroundColor: expandedPanelColor }}>
                  {CALENDAR_VIEW_OPTIONS.map((option, index) => {
                    const selected = (pendingCalendarDefaultView ?? calendarDefaultView) === option;
                    const isLast = index === CALENDAR_VIEW_OPTIONS.length - 1;

                    return (
                      <TouchableOpacity
                        key={option}
                        activeOpacity={0.7}
                        disabled={pendingCalendarDefaultView !== null}
                        onPress={() => handleSelectCalendarDefaultView(option)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 13,
                          borderBottomWidth: isLast ? 0 : 1,
                          borderBottomColor: rowDividerColor,
                          opacity: pendingCalendarDefaultView ? 0.7 : 1,
                        }}
                      >
                        <View style={{ width: 46 }} />
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            color: selected ? calendarControlTint : rowTextColor,
                            fontWeight: selected ? '700' : '500',
                          }}
                        >
                          {APP_CALENDAR_DEFAULT_VIEW_LABELS[option]}
                        </Text>
                        {pendingCalendarDefaultView === option ? (
                          <ActivityIndicator size="small" color={calendarControlTint} />
                        ) : (
                          <AppIcon
                            name="radio"
                            variant={selected ? 'selected' : 'unselected'}
                            size={18}
                            color={selected ? calendarControlTint : rowChevronColor}
                            secondaryColor={colors.onAccent}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
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
                  ? '展示全部艺人的拍立得'
                  : widgetArtists.length === 1
                    ? `只展示 ${getArtistPrimaryName(widgetArtists[0])} 的拍立得`
                    : `展示 ${getArtistPrimaryName(widgetArtists[0])} 等 ${widgetArtists.length} 位艺人的拍立得`}
                tint={settingsTints.widget}
                isLast
                onPress={() => router.push('/settings/widget')}
              />
            </MenuCard>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <SectionLabel label="数据与备份" />
          <MenuCard>
            <MenuItem
              icon="backupDownload"
              label="生成备份数据"
              badge={backupMenuBadge}
              tint={importTint}
              onPress={handleExportFullBackup}
            />
            <MenuItem
              icon="backupSave"
              label={saveBackupLabel}
              badge={saveBackupBadge}
              tint={saveTint}
              onPress={handleShareBackup}
            />
            <MenuItem
              icon="backupRestore"
              label="恢复备份"
              badge={importBackupBadge}
              tint={restoreTint}
              isLast
              onPress={handleImportBackup}
            />
          </MenuCard>
        </View>

        <View>
          <SectionLabel label="高级" />
          <MenuCard>
            <MenuItem
              icon="weibo"
              label="登录微博"
              subtitle="登录微博配置抓取功能"
              tint={settingsTints.weibo}
              onPress={() => router.push('/weibo')}
            />
            <MenuItem
              icon="maintenance"
              label="清理未使用图片"
              tint={settingsTints.cleanup}
              isLast
              onPress={handleCleanupUnusedMedia}
            />
          </MenuCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

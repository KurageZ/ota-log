import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { AppIcon, type AppIconName } from '../../src/components/AppIcon';
import { MenuCard, MenuItem, SectionLabel } from '../../src/components/SettingsMenu';
import { useDB } from '../../src/context/DBContext';
import { useAppTheme } from '../../src/theme/appTheme';
import { cleanupUnreferencedLocalMedia, scanUnreferencedLocalMedia } from '../../src/utils/localMedia';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import {
  type StorageCategoryId,
  type StorageCategoryInfo,
  type StorageUsageResult,
  formatBytes,
  formatStoragePercent,
  scanStorageUsage,
} from '../../src/utils/storageUsage';

const CATEGORY_ICONS: Record<StorageCategoryId, AppIconName> = {
  eventPhotos: 'images',
  cheki: 'cheki',
  artistImages: 'artists',
  database: 'document',
  other: 'more',
};

// Fixed categorical palette so chart segments and the row legend stay
// distinguishable in both light and dark mode, regardless of theme accents.
const STORAGE_CHART_COLORS: Record<StorageCategoryId, string> = {
  eventPhotos: '#2563eb',
  cheki: '#db2777',
  artistImages: '#16a34a',
  database: '#7c3aed',
  other: '#9ca3af',
};

function StorageCategoryRow({
  info,
  totalBytes,
  icon,
  tint,
  isLast,
}: {
  info: StorageCategoryInfo;
  totalBytes: number;
  icon: AppIconName;
  tint: string;
  isLast: boolean;
}) {
  const { colors } = useAppTheme();
  const percent = totalBytes > 0 ? (info.bytes / totalBytes) * 100 : 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.divider,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: `${tint}22`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <AppIcon name={icon} size={18} color={tint} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }} numberOfLines={1}>
            {info.label}
          </Text>
          <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600', marginLeft: 8 }}>
            {formatBytes(info.bytes)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <View
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.cardMuted,
              overflow: 'hidden',
              marginRight: 10,
            }}
          >
            <View
              style={{
                width: `${percent}%` as `${number}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: tint,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              fontVariant: ['tabular-nums'],
              minWidth: 42,
              textAlign: 'right',
            }}
          >
            {formatStoragePercent(info.bytes, totalBytes)}
          </Text>
        </View>

        <Text style={{ marginTop: 4, fontSize: 12, color: colors.textMuted }}>
          {info.fileCount} 个文件
        </Text>
      </View>
    </View>
  );
}

export default function StorageSettingsScreen() {
  const { colors } = useAppTheme();
  const db = useDB();
  const [usage, setUsage] = useState<StorageUsageResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setUsage(await scanStorageUsage(db.rawDb));
      setLoadFailed(false);
    } catch {
      setUsage(null);
      setLoadFailed(true);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const totalFileCount = usage?.categories.reduce(
    (sum, category) => sum + category.fileCount,
    0,
  ) ?? 0;

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
                await reload();
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

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '存储空间' }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {usage == null && !loadFailed ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : loadFailed ? (
          <View style={{ paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.heading, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
              无法读取存储空间
            </Text>
            <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' }}>
              暂时无法计算空间占用，请稍后再试。
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => { void reload(); }}
              style={{
                minHeight: 44,
                marginTop: 18,
                paddingHorizontal: 20,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.accent,
              }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>重新加载</Text>
            </TouchableOpacity>
          </View>
        ) : usage!.totalBytes === 0 ? (
          <>
            <SectionLabel label="空间占用" />
            <MenuCard>
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600' }}>暂无数据</Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                  添加活动、切册或艺人图片后，这里会显示空间占用
                </Text>
              </View>
            </MenuCard>
          </>
        ) : (
          <>
            <SectionLabel label="空间占用" />
            <View style={{ marginBottom: 16 }}>
              <MenuCard>
                <View style={{ padding: 16 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>已使用</Text>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: colors.heading, marginTop: 2 }}>
                    {formatBytes(usage!.totalBytes)}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      height: 10,
                      borderRadius: 5,
                      overflow: 'hidden',
                      marginTop: 12,
                    }}
                  >
                    {usage!.categories
                      .filter((info) => info.bytes > 0)
                      .map((info, index, visibleCategories) => (
                        <View
                          key={info.id}
                          style={{
                            width: `${(info.bytes / usage!.totalBytes) * 100}%`,
                            backgroundColor: STORAGE_CHART_COLORS[info.id],
                            borderRightWidth: index === visibleCategories.length - 1 ? 0 : 1,
                            borderRightColor: colors.card,
                          }}
                        />
                      ))}
                  </View>
                  <Text style={{ marginTop: 4, fontSize: 12, color: colors.textMuted }}>
                    共 {totalFileCount} 个文件
                  </Text>
                </View>
              </MenuCard>
            </View>

            <MenuCard>
              {usage!.categories.map((info, index) => (
                <StorageCategoryRow
                  key={info.id}
                  info={info}
                  totalBytes={usage!.totalBytes}
                  icon={CATEGORY_ICONS[info.id]}
                  tint={STORAGE_CHART_COLORS[info.id]}
                  isLast={index === usage!.categories.length - 1}
                />
              ))}
            </MenuCard>
          </>
        )}

        <View style={{ height: 16 }} />
        <SectionLabel label="维护" />
        <MenuCard>
          <MenuItem
            icon="maintenance"
            label="清理未使用图片"
            subtitle="删除未被活动、切册或艺人引用的本地图片"
            tint={colors.settingsMenu.cleanup}
            isLast
            onPress={handleCleanupUnusedMedia}
          />
        </MenuCard>
      </ScrollView>
    </SafeAreaView>
  );
}

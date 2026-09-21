import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { File } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../src/components/AppIcon';
import { BottomSheetDialog, BottomSheetAction } from '../../src/components/BottomSheetDialog';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { MenuCard, SectionLabel } from '../../src/components/SettingsMenu';
import { useDB } from '../../src/context/DBContext';
import {
  applyChekirokuImportPlan,
  buildChekirokuImportNotices,
  buildChekirokuImportPlan,
  parseChekirokuFile,
  type ChekirokuImportPlan,
  type ChekirokuSamePersonDecision,
  type ChekirokuSourceSnapshot,
} from '../../src/importers/chekiroku';
import { useAppTheme } from '../../src/theme/appTheme';

type ImportStatus = 'idle' | 'parsing' | 'ready' | 'applying' | 'done';

function getMemberLabel(snapshot: ChekirokuSourceSnapshot, memberId: string): string {
  const member = snapshot.members.find((candidate) => candidate.id === memberId);
  if (!member) return '未知成员';
  const group = snapshot.groups.find((candidate) => candidate.id === member.groupId);
  return group?.name ? `${member.name ?? '未命名成员'} · ${group.name}` : (member.name ?? '未命名成员');
}

function getMemberRecordSummary(snapshot: ChekirokuSourceSnapshot, memberId: string): string {
  const records = snapshot.records.filter((record) => record.memberId === memberId);
  const quantity = records.reduce((sum, record) => {
    const count = Number(record.count);
    return sum + (Number.isSafeInteger(count) && count > 0 ? count : 0);
  }, 0);
  return `${quantity} 张拍立得 · ${records.length} 条记录`;
}

function formatExternalImportError(error: unknown, fallback = '无法读取外部备份文件，请检查文件后重试。'): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('缺少必需数据表')) {
    return '此文件缺少导入所需的核心数据，当前不支持。请重新导出完整文件。';
  }
  if (message.includes('缺少必需字段')) {
    return '此文件的数据结构不完整，当前不支持。请重新导出完整文件。';
  }
  if (message.includes('完整性检查')) {
    return '此备份的数据库完整性检查未通过，无法安全导入。请重新导出文件。';
  }
  if (message.includes('不是有效的 SQLite') || message.includes('不是有效的 ZIP')) {
    return '此文件不是可识别的外部备份文件。';
  }
  if (message.includes('危险路径') || message.includes('超过大小限制') || message.includes('包含过多内容')) {
    return '此文件不符合安全导入要求。';
  }
  return fallback;
}

function ImportHintList() {
  const { colors } = useAppTheme();
  const hints = [
    '支持 .chekiroku 文件，兼容范围有限。',
    '导入前会检查数据，并展示不会导入的内容。',
    '文件仅在本机处理，本工具与第三方无关。',
  ];
  return (
    <View style={{ marginTop: 16, width: '100%', maxWidth: 320, gap: 9 }}>
      {hints.map((hint) => (
        <View key={hint} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
          <View style={{ width: 5, height: 5, marginTop: 7, borderRadius: 3, backgroundColor: colors.accent }} />
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{hint}</Text>
        </View>
      ))}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  disabled = false,
  loading = false,
  onPress,
}: {
  label: string;
  icon?: 'backupDownload' | 'cheki';
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.accent,
        opacity: disabled || loading ? 0.45 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onAccent} />
      ) : icon ? (
        <AppIcon name={icon} size={18} color={colors.onAccent} />
      ) : null}
      <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ChekirokuImportScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useDB();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [snapshot, setSnapshot] = useState<ChekirokuSourceSnapshot | null>(null);
  const [existingArtists, setExistingArtists] = useState<Awaited<ReturnType<typeof db.artists.findAll>>>([]);
  const [samePersonDecisions, setSamePersonDecisions] = useState<Record<string, ChekirokuSamePersonDecision>>({});
  const [result, setResult] = useState<{ createdRecords: number; createdItems: number; createdArtists: number; reusedArtists: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [showArtistList, setShowArtistList] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const plan = useMemo<ChekirokuImportPlan | null>(() => {
    if (!snapshot) return null;
    return buildChekirokuImportPlan(snapshot, existingArtists, { samePersonDecisions });
  }, [existingArtists, samePersonDecisions, snapshot]);

  const unresolvedSamePersonGroups = useMemo(() => (
    snapshot?.samePersonGroups.filter((group) => samePersonDecisions[group.id] == null) ?? []
  ), [samePersonDecisions, snapshot]);

  const notices = useMemo(() => (
    plan ? buildChekirokuImportNotices(plan.preview) : []
  ), [plan]);

  const pickFile = useCallback(async () => {
    if (status === 'parsing' || status === 'applying') return;
    setStatus('parsing');
    setError(null);
    setResult(null);
    setShowConfirmation(false);
    try {
      const picked = await File.pickFileAsync();
      if (picked.canceled || !picked.result) {
        setStatus(snapshot ? 'ready' : 'idle');
        return;
      }
      const nextSnapshot = await parseChekirokuFile(picked.result);
      const nextArtists = await db.artists.findAll();
      setSnapshot(nextSnapshot);
      setExistingArtists(nextArtists);
      setSamePersonDecisions({});
      setShowAllNotices(false);
      setShowArtistList(false);
      setStatus('ready');
    } catch (caughtError) {
      setStatus(snapshot ? 'ready' : 'idle');
      setError(formatExternalImportError(caughtError));
    }
  }, [db.artists, snapshot, status]);

  const updateSamePersonDecision = (groupId: string, decision: ChekirokuSamePersonDecision) => {
    setSamePersonDecisions((current) => ({ ...current, [groupId]: decision }));
  };

  const keepAllUnresolvedSeparate = () => {
    setSamePersonDecisions((current) => ({
      ...current,
      ...Object.fromEntries(unresolvedSamePersonGroups.map((group) => [group.id, { mode: 'separate' as const }])),
    }));
  };

  const confirmImport = async () => {
    if (!plan || plan.preview.fatalErrors.length > 0 || unresolvedSamePersonGroups.length > 0 || status === 'applying') return;
    setShowConfirmation(false);
    setStatus('applying');
    setError(null);
    try {
      const imported = await applyChekirokuImportPlan(db.rawDb, plan);
      setResult(imported);
      setStatus('done');
    } catch (caughtError) {
      setStatus('ready');
      setError(formatExternalImportError(caughtError, '导入失败，数据未发生变化，请重试。'));
    }
  };

  const canReviewConfirmation = status === 'ready'
    && plan != null
    && plan.preview.fatalErrors.length === 0
    && unresolvedSamePersonGroups.length === 0;
  const preview = plan?.preview;
  const footerHeight = 94 + insets.bottom;

  if (status === 'done' && result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.screen }}>
        <Stack.Screen options={{ title: '导入完成', headerRight: undefined }} />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSoft }}>
              <AppIcon name="statusCompleted" size={34} color={colors.success} />
            </View>
            <Text style={{ marginTop: 20, color: colors.heading, fontSize: 24, fontWeight: '800' }}>导入完成</Text>
            <Text style={{ marginTop: 8, color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {result.createdItems} 张拍立得已加入电子切册
            </Text>
            <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
              共 {result.createdRecords} 条记录{result.createdArtists > 0 ? ` · 新建 ${result.createdArtists} 个艺人` : ''}
              {result.reusedArtists > 0 ? ` · 匹配 ${result.reusedArtists} 个已有艺人` : ''}
            </Text>
          </View>
          <View style={{ marginTop: 32, gap: 10 }}>
            <ActionButton
              label="查看导入记录"
              icon="cheki"
              onPress={() => router.replace({ pathname: '/cheki', params: { browse: 'record' } })}
            />
            <TouchableOpacity
              activeOpacity={0.65}
              accessibilityRole="button"
              onPress={() => router.replace('/tools')}
              style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>返回工具箱</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          title: snapshot ? '确认导入' : '外部数据导入',
          headerRight: Platform.OS !== 'ios' && snapshot ? () => status === 'parsing' ? (
            <View style={{ minWidth: 66, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.65}
              accessibilityRole="button"
              disabled={status === 'applying'}
              onPress={() => { void pickFile(); }}
              style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}
            >
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>更换文件</Text>
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      {snapshot ? (
        <NativeTextToolbar
          right={{
            label: '更换文件',
            disabled: status === 'parsing' || status === 'applying',
            onPress: () => { void pickFile(); },
          }}
        />
      ) : null}

      {!snapshot ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
              <AppIcon name="backupDownload" size={32} color={colors.accent} />
            </View>
            <Text style={{ marginTop: 20, color: colors.heading, fontSize: 21, fontWeight: '800' }}>导入外部数据</Text>
            <ImportHintList />
          </View>
          {error ? (
            <View style={{ marginTop: 24, borderRadius: 14, padding: 14, backgroundColor: colors.dangerSoft }}>
              <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}
          <View style={{ marginTop: 28 }}>
            <ActionButton
              label={status === 'parsing' ? '正在读取文件' : '选择文件'}
              icon="backupDownload"
              loading={status === 'parsing'}
              onPress={() => { void pickFile(); }}
            />
          </View>
        </View>
      ) : preview ? (
        <>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: footerHeight + 24, gap: 20 }}
          >
            {error ? (
              <View style={{ borderRadius: 14, padding: 14, backgroundColor: colors.dangerSoft }}>
                <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>导入未完成</Text>
                <Text style={{ marginTop: 4, color: colors.text, fontSize: 13, lineHeight: 20 }}>{error}</Text>
                <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>数据没有发生变化，可以直接重试。</Text>
              </View>
            ) : null}

            <View style={{ borderRadius: 20, paddingHorizontal: 18, paddingVertical: 20, backgroundColor: colors.card }}>
              <Text style={{ color: colors.heading, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {preview.quantity} 张拍立得
              </Text>
              <Text style={{ marginTop: 5, color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>
                来自 {preview.recordCount} 条记录 · {preview.memberCount} 位成员 · {preview.groupCount} 个团体
              </Text>
            </View>

            {snapshot.samePersonGroups.length > 0 ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><SectionLabel label="重复成员确认" /></View>
                  {unresolvedSamePersonGroups.length > 1 ? (
                    <TouchableOpacity accessibilityRole="button" activeOpacity={0.65} onPress={keepAllUnresolvedSeparate} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
                      <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '700' }}>全部分开保留</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={{ marginBottom: 10, color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                  外部数据将这些资料标记为同一人，请选择导入后的处理方式。
                </Text>
                <View style={{ gap: 12 }}>
                  {snapshot.samePersonGroups.map((group) => {
                    const decision = samePersonDecisions[group.id];
                    return (
                      <MenuCard key={group.id}>
                        <View style={{ padding: 14 }}>
                          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                            {group.memberIds.map((memberId) => getMemberLabel(snapshot, memberId)).join(' / ')}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: decision?.mode === 'separate' }}
                            onPress={() => updateSamePersonDecision(group.id, { mode: 'separate' })}
                            style={{ minHeight: 48, marginTop: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: decision?.mode === 'separate' ? colors.accentSoft : colors.cardAlt }}
                          >
                            <AppIcon name="radio" variant={decision?.mode === 'separate' ? 'selected' : 'unselected'} size={20} color={decision?.mode === 'separate' ? colors.accent : colors.textMuted} secondaryColor={colors.onAccent} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '700' }}>分开保留</Text>
                              <Text style={{ marginTop: 2, color: colors.textSecondary, fontSize: 11.5 }}>分别创建或匹配艺人资料</Text>
                            </View>
                          </TouchableOpacity>
                          {group.memberIds.map((memberId) => {
                            const selected = decision?.mode === 'merge' && decision.targetMemberId === memberId;
                            return (
                              <TouchableOpacity
                                key={memberId}
                                activeOpacity={0.7}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: selected }}
                                onPress={() => updateSamePersonDecision(group.id, { mode: 'merge', targetMemberId: memberId })}
                                style={{ minHeight: 56, marginTop: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: selected ? colors.accentSoft : colors.cardAlt }}
                              >
                                <AppIcon name="radio" variant={selected ? 'selected' : 'unselected'} size={20} color={selected ? colors.accent : colors.textMuted} secondaryColor={colors.onAccent} />
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '700' }}>合并到 {getMemberLabel(snapshot, memberId)}</Text>
                                  <Text style={{ marginTop: 3, color: colors.textSecondary, fontSize: 11.5 }}>{getMemberRecordSummary(snapshot, memberId)}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </MenuCard>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View>
              <SectionLabel label="艺人处理" />
              <MenuCard>
                <View style={{ paddingHorizontal: 16 }}>
                  <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center' }}>
                    <AppIcon name="addPerson" size={19} color={colors.accent} />
                    <Text style={{ flex: 1, marginLeft: 11, color: colors.text, fontSize: 14, fontWeight: '600' }}>新增艺人</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>{preview.newMemberCount} 位成员 · {preview.newGroupCount} 个团体</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.divider }} />
                  <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center' }}>
                    <AppIcon name="statusCompleted" size={19} color={colors.success} />
                    <Text style={{ flex: 1, marginLeft: 11, color: colors.text, fontSize: 14, fontWeight: '600' }}>匹配到已有艺人</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] }}>{preview.reusedMemberCount} 位成员 · {preview.reusedGroupCount} 个团体</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.divider }} />
                  <TouchableOpacity
                    activeOpacity={0.65}
                    accessibilityRole="button"
                    onPress={() => setShowArtistList(true)}
                    style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '700' }}>查看艺人名单</Text>
                    <AppIcon name="disclosure" variant="forward" size={15} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </MenuCard>
            </View>

            {plan.preview.fatalErrors.length > 0 ? (
              <View>
                <SectionLabel label="无法导入" />
                <View style={{ borderRadius: 14, padding: 14, backgroundColor: colors.dangerSoft }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
                    <AppIcon name="alert" size={18} color={colors.danger} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '700', lineHeight: 20 }}>
                        {plan.preview.invalidCountCount} 条记录的拍立得数量无效
                      </Text>
                      <Text style={{ marginTop: 3, color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                        请修正原始数据后重新导出文件。
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {notices.length > 0 ? (
              <View>
                <SectionLabel label="需要留意" />
                <MenuCard>
                  <View style={{ paddingHorizontal: 14 }}>
                    {(showAllNotices ? notices : notices.slice(0, 3)).map((notice, index, visibleNotices) => (
                      <View key={`${notice.title}-${index}`}>
                        <View style={{ minHeight: notice.detail ? 66 : 54, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <AppIcon name={notice.tone === 'warning' ? 'alert' : 'info'} size={18} color={notice.tone === 'warning' ? colors.warning : colors.info} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '600', lineHeight: 19 }}>{notice.title}</Text>
                            {notice.detail ? <Text style={{ marginTop: 2, color: colors.textSecondary, fontSize: 11.5, lineHeight: 17 }}>{notice.detail}</Text> : null}
                          </View>
                        </View>
                        {index < visibleNotices.length - 1 ? <View style={{ height: 1, marginLeft: 28, backgroundColor: colors.divider }} /> : null}
                      </View>
                    ))}
                    {notices.length > 3 ? (
                      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showAllNotices }} activeOpacity={0.65} onPress={() => setShowAllNotices((current) => !current)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: '700' }}>{showAllNotices ? '收起' : `查看全部 ${notices.length} 项`}</Text>
                        <AppIcon name="disclosure" variant={showAllNotices ? 'up' : 'down'} size={15} color={colors.accent} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </MenuCard>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 2 }}>
              <AppIcon name="info" size={17} color={colors.textMuted} />
              <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                不会删除或替换现有记录；匹配到的收藏成员会同步设为收藏。重复导入同一文件会产生重复记录。
              </Text>
            </View>
          </ScrollView>

          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.card }}>
            {unresolvedSamePersonGroups.length > 0 ? (
              <Text style={{ marginBottom: 7, color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>还需确认 {unresolvedSamePersonGroups.length} 组重复成员</Text>
            ) : plan.preview.fatalErrors.length > 0 ? (
              <Text style={{ marginBottom: 7, color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>当前文件存在无法导入的记录</Text>
            ) : null}
            <ActionButton
              label={unresolvedSamePersonGroups.length > 0 ? `先确认 ${unresolvedSamePersonGroups.length} 组重复成员` : `导入 ${preview.quantity} 张拍立得`}
              disabled={!canReviewConfirmation}
              loading={status === 'applying'}
              onPress={() => setShowConfirmation(true)}
            />
          </View>

          <BottomSheetDialog
            visible={showArtistList}
            title="艺人处理名单"
            onClose={() => setShowArtistList(false)}
            scrollable
          >
            {plan.artists.map((artist, index) => {
              const parentName = artist.parentId
                ? plan.artists.find((candidate) => candidate.id === artist.parentId)?.name
                  ?? existingArtists.find((candidate) => candidate.id === artist.parentId)?.name
                : null;
              return (
                <View key={`${artist.sourceKind}-${artist.sourceId}`}>
                  <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: artist.reuseExisting ? colors.successSoft : colors.accentSoft }}>
                      <AppIcon name={artist.sourceKind === 'group' ? 'artists' : 'artist'} size={17} color={artist.reuseExisting ? colors.success : colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{artist.name}</Text>
                      <Text style={{ marginTop: 2, color: colors.textSecondary, fontSize: 11.5 }}>
                        {artist.sourceKind === 'group' ? '团体' : parentName ?? '独立艺人'}
                      </Text>
                    </View>
                    <Text style={{ color: artist.reuseExisting ? colors.success : colors.accent, fontSize: 11.5, fontWeight: '700' }}>
                      {artist.reuseExisting ? '匹配已有' : '新增'}
                    </Text>
                  </View>
                  {index < plan.artists.length - 1 ? <View style={{ height: 1, marginLeft: 44, backgroundColor: colors.divider }} /> : null}
                </View>
              );
            })}
          </BottomSheetDialog>

          <BottomSheetDialog
            visible={showConfirmation}
            title={`导入 ${preview.quantity} 张拍立得？`}
            onClose={() => setShowConfirmation(false)}
            footer={(
              <BottomSheetAction
                label={status === 'applying' ? '正在导入' : '开始导入'}
                loading={status === 'applying'}
                onPress={() => { void confirmImport(); }}
              />
            )}
          >
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
              将新增 {preview.newMemberCount + preview.newGroupCount} 个艺人，并匹配 {preview.reusedMemberCount + preview.reusedGroupCount} 个已有艺人。
            </Text>
            {preview.unsupportedData.length > 0 ? (
              <View style={{ marginTop: 14, borderRadius: 12, padding: 12, backgroundColor: colors.warningSoft }}>
                <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '700', lineHeight: 19 }}>部分外部数据不会导入</Text>
                <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>{preview.unsupportedData.join('；')}</Text>
              </View>
            ) : null}
            <View style={{ marginTop: 14, marginBottom: 8, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: colors.warningSoft }}>
              <AppIcon name="info" size={18} color={colors.warning} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 19 }}>
                不会删除或替换现有记录。{preview.favoriteExistingArtistCount > 0 ? `${preview.favoriteExistingArtistCount} 个已有艺人会同步设为收藏。` : ''}重复导入同一文件会产生重复记录。
              </Text>
            </View>
          </BottomSheetDialog>
        </>
      ) : null}
    </View>
  );
}

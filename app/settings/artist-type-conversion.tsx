import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { Artist, ArtistType } from '../../src/types/models';
import { useDB } from '../../src/context/DBContext';
import { useAppTheme } from '../../src/theme/appTheme';
import { OshiAvatar } from '../../src/components/Oshi';
import { AppIcon } from '../../src/components/AppIcon';
import { BottomSheetDialog, BottomSheetAction } from '../../src/components/BottomSheetDialog';
import { MenuCard, MenuIconTile } from '../../src/components/SettingsMenu';
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import { showSaveFailedAlert } from '../../src/utils/failureAlert';
import {
  ArtistTypeConversionGroup,
  buildArtistTypeConversionGraph,
  buildArtistTypeConversionGroups,
  updateLinkedTypeDecision,
} from '../../src/utils/artistTypeConversion';

interface ConversionSection {
  key: 'relationships' | 'isolated';
  data: ArtistTypeConversionGroup[];
}

export default function ArtistTypeConversionScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const dataTint = colors.settingsMenu.backupExport;
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [decisions, setDecisions] = useState<Record<string, ArtistType | null>>({});
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [all, directActivityCounts] = await Promise.all([
        db.artists.findAll(),
        db.artists.findDirectActivityCounts(),
      ]);
      const unset = all.filter((artist) => artist.artist_type == null);
      setArtists(unset);
      setActivityCounts(directActivityCounts);
      setDecisions(Object.fromEntries(unset.map((artist) => [artist.id, null])));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const graph = useMemo(() => buildArtistTypeConversionGraph(artists), [artists]);
  const groups = useMemo(
    () => buildArtistTypeConversionGroups(artists, graph, activityCounts),
    [activityCounts, artists, graph],
  );
  const isGroupSelected = useCallback((group: ArtistTypeConversionGroup) => (
    group.artists.some((artist) => decisions[artist.id] != null)
  ), [decisions]);
  const selectedGroups = useMemo(() => groups.filter(isGroupSelected), [groups, isGroupSelected]);
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  const matchesKeyword = useCallback((group: ArtistTypeConversionGroup) => {
    if (!normalizedKeyword) return true;
    return group.artists.some((artist) => (
      artist.name.toLocaleLowerCase().includes(normalizedKeyword)
      || artist.short_name?.toLocaleLowerCase().includes(normalizedKeyword)
    ));
  }, [normalizedKeyword]);
  const relationshipGroups = useMemo(() => groups.filter((group) => (
    group.isRelationship && matchesKeyword(group)
  )), [groups, matchesKeyword]);
  const isolatedGroups = useMemo(() => groups.filter((group) => (
    !group.isRelationship && matchesKeyword(group)
  )), [groups, matchesKeyword]);
  const sections = useMemo<ConversionSection[]>(() => [
    ...(relationshipGroups.length > 0
      ? [{ key: 'relationships' as const, data: relationshipGroups }]
      : []),
    ...(isolatedGroups.length > 0
      ? [{ key: 'isolated' as const, data: isolatedGroups }]
      : []),
  ], [isolatedGroups, relationshipGroups]);

  const selectedCount = Object.values(decisions).filter(Boolean).length;
  const selectedPersonCount = Object.values(decisions).filter((type) => type === 'person').length;
  const selectedGroupCount = Object.values(decisions).filter((type) => type === 'group').length;
  const selectedMembershipCount = artists.filter((artist) => (
    artist.parent_id
      && decisions[artist.id] === 'person'
      && decisions[artist.parent_id] === 'group'
  )).length;
  const selectableRelationshipGroups = useMemo(() => groups.filter((group) => (
    group.isRelationship && !group.ambiguous
  )), [groups]);
  const allRelationshipGroupsSelected = selectableRelationshipGroups.length > 0
    && selectableRelationshipGroups.every(isGroupSelected);

  const updateDecision = useCallback((artistId: string, nextType: ArtistType | null) => {
    setDecisions((current) => updateLinkedTypeDecision(current, artistId, nextType, graph));
  }, [graph]);

  const toggleGroup = useCallback((group: ArtistTypeConversionGroup) => {
    if (group.ambiguous) return;
    if (isGroupSelected(group)) {
      updateDecision(group.artists[0].id, null);
      return;
    }
    if (group.isRelationship) {
      updateDecision(group.artists[0].id, graph.suggestedTypes[group.artists[0].id]);
    } else {
      updateDecision(group.artists[0].id, 'person');
    }
  }, [graph.suggestedTypes, isGroupSelected, updateDecision]);

  const toggleRelationshipSelectAll = () => {
    setDecisions((current) => {
      const next = { ...current };
      for (const group of selectableRelationshipGroups) {
        for (const artist of group.artists) {
          next[artist.id] = allRelationshipGroupsSelected
            ? null
            : (graph.suggestedTypes[artist.id] ?? 'person');
        }
      }
      return next;
    });
  };

  const allIsolatedArtists = useMemo(() => groups
    .filter((group) => !group.isRelationship)
    .flatMap((group) => group.artists), [groups]);

  const selectAllIsolated = (type: ArtistType) => {
    setDecisions((current) => {
      const next = { ...current };
      for (const artist of allIsolatedArtists) {
        next[artist.id] = type;
      }
      return next;
    });
  };

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // 勾选关系组后自动展开成员区，方便在提交前看到整组转换结果。
  useEffect(() => {
    setExpandedGroupIds((current) => {
      const toExpand = groups.filter((group) => (
        group.isRelationship && isGroupSelected(group) && !current.has(group.id)
      ));
      if (toExpand.length === 0) return current;
      const next = new Set(current);
      toExpand.forEach((group) => next.add(group.id));
      return next;
    });
  }, [groups, isGroupSelected]);

  const apply = async () => {
    if (selectedCount === 0) return;
    setSaving(true);
    try {
      const result = await db.artists.applyTypeConversion(decisions);
      Alert.alert(
        '转换完成',
        `已设置 ${result.personCount} 位个人、${result.groupCount} 个团体，并转换 ${result.membershipCount} 段所属关系。`,
      );
      await load();
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setSaving(false);
    }
  };

  const openConfirm = () => {
    if (selectedCount === 0) return;
    setConfirmOpen(true);
  };

  const renderMemberRow = (artist: Artist) => {
    const selectedType = decisions[artist.id];
    const directActivityCount = activityCounts[artist.id] ?? 0;
    return (
      <View
        key={artist.id}
        style={{
          minHeight: 46,
          paddingLeft: 52,
          paddingRight: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: colors.divider,
          backgroundColor: colors.cardMuted,
        }}
      >
        <OshiAvatar
          source={resolveAvatarSource(artist.avatar_uri)}
          size={28}
          isOshi={false}
          name={getArtistPrimaryName(artist)}
        />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
            {artist.name}
          </Text>
          <View style={{ marginTop: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {selectedType != null ? (
              <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
                {selectedType === 'person' ? '转换为个人' : '转换为团体'}
              </Text>
            ) : null}
            {directActivityCount > 0 ? (
              <Text style={{ color: colors.accentText, fontSize: 11.5, fontWeight: '700' }}>
                {directActivityCount} 场活动
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const renderMemberStrip = (group: ArtistTypeConversionGroup) => {
    const members = group.artists.slice(1);
    const visibleMembers = members.slice(0, 6);
    const hiddenCount = members.length - visibleMembers.length;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={`展开${members.length} 位成员`}
        disabled={saving}
        onPress={() => toggleGroupExpanded(group.id)}
        activeOpacity={0.72}
        style={{
          minHeight: 44,
          paddingVertical: 7,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
        }}
      >
        {visibleMembers.map((artist) => (
          <OshiAvatar
            key={artist.id}
            source={resolveAvatarSource(artist.avatar_uri)}
            size={28}
            isOshi={false}
            name={getArtistPrimaryName(artist)}
          />
        ))}
        <View style={{ marginLeft: 4, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '800' }}>
            {hiddenCount > 0 ? `+${hiddenCount} · ` : ''}{members.length} 位成员
          </Text>
          <AppIcon name="chevron" variant="down" size={14} color={colors.accentText} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroup = ({ item: group }: { item: ArtistTypeConversionGroup }) => {
    const selected = isGroupSelected(group);
    const primary = group.artists[0];
    const primaryType = decisions[primary.id];
    const members = group.artists.slice(1);
    const directActivityCount = activityCounts[primary.id] ?? 0;
    const expanded = group.ambiguous || expandedGroupIds.has(group.id);
    const isIsolated = !group.isRelationship;
    return (
      <View style={{
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: selected ? colors.accentBorder : colors.divider,
        backgroundColor: colors.card,
      }}>
        <View style={{
          minHeight: 58,
          paddingLeft: 8,
          paddingRight: 8,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: selected ? colors.accentSofter : colors.card,
        }}>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled: group.ambiguous }}
            accessibilityLabel={`${selected ? '取消转换' : '选择转换'} ${primary.name}${group.isRelationship ? '及其成员' : ''}`}
            disabled={group.ambiguous || saving}
            onPress={() => toggleGroup(group)}
            activeOpacity={0.65}
            style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppIcon
              name="checkbox"
              variant={selected ? 'selected' : 'unselected'}
              size={22}
              color={selected ? colors.accent : colors.chevron}
            />
          </TouchableOpacity>
          <OshiAvatar
            source={resolveAvatarSource(primary.avatar_uri)}
            size={38}
            isOshi={false}
            name={getArtistPrimaryName(primary)}
          />
          <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '700' }}>
              {primary.name}
            </Text>
            <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
                {group.ambiguous
                  ? '多层所属，需先整理'
                  : group.isRelationship
                    ? selected
                      ? `将转为 1 个团体 + ${members.length} 位个人`
                      : `${members.length} 位成员`
                    : primaryType === 'group' ? '转换为团体'
                    : primaryType === 'person' ? '转换为个人'
                      : '类型待选择'}
              </Text>
              {directActivityCount > 0 ? (
                <Text style={{ color: colors.accentText, fontSize: 11.5, fontWeight: '700' }}>
                  {directActivityCount} 场活动
                </Text>
              ) : null}
            </View>
          </View>

          {isIsolated && !group.ambiguous ? (
            <View style={{ marginLeft: 8, flexDirection: 'row', gap: 5 }}>
              {([
                { value: 'person' as const, label: '个人' },
                { value: 'group' as const, label: '团体' },
              ]).map((option) => {
                const active = primaryType === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    disabled={saving}
                    onPress={() => updateDecision(primary.id, option.value)}
                    style={{
                      minWidth: 58,
                      minHeight: 44,
                      paddingHorizontal: 8,
                      borderRadius: 9,
                      flexDirection: 'row',
                      gap: 5,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.inputBorder,
                      backgroundColor: active ? colors.accentSoft : colors.input,
                    }}
                  >
                    <AppIcon
                      name="checkbox"
                      variant={active ? 'selected' : 'unselected'}
                      size={15}
                      color={active ? colors.accent : colors.textMuted}
                    />
                    <Text style={{ color: active ? colors.accentText : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : group.isRelationship && !group.ambiguous ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${expanded ? '收起' : '展开'}${members.length} 位成员`}
              disabled={saving}
              onPress={() => toggleGroupExpanded(group.id)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="chevron" variant={expanded ? 'up' : 'down'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {group.isRelationship ? (
          expanded ? (
            members.map((artist) => renderMemberRow(artist))
          ) : (
            renderMemberStrip(group)
          )
        ) : null}
      </View>
    );
  };

  const renderConfirmGroup = (group: ArtistTypeConversionGroup) => {
    const primary = group.artists[0];
    const members = group.artists.slice(1);
    const directActivityCount = activityCounts[primary.id] ?? 0;
    return (
      <View key={group.id} style={{
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.card,
        overflow: 'hidden',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 }}>
          <OshiAvatar
            source={resolveAvatarSource(primary.avatar_uri)}
            size={34}
            isOshi={false}
            name={getArtistPrimaryName(primary)}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
              {primary.name}
            </Text>
            <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '700' }}>
                {group.isRelationship
                  ? `转为团体 · ${members.length} 位成员转为个人`
                  : decisions[primary.id] === 'group' ? '转为团体' : '转为个人'}
              </Text>
              {directActivityCount > 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
                  {directActivityCount} 场活动
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        {group.isRelationship ? members.map((artist) => (
          <View
            key={artist.id}
            style={{
              minHeight: 40,
              paddingLeft: 18,
              paddingRight: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: colors.divider,
            }}
          >
            <OshiAvatar
              source={resolveAvatarSource(artist.avatar_uri)}
              size={24}
              isOshi={false}
              name={getArtistPrimaryName(artist)}
            />
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, marginLeft: 8, color: colors.text, fontSize: 13 }}>
              {artist.name}
            </Text>
            <Text style={{ color: colors.accentText, fontSize: 11.5, fontWeight: '700' }}>转为个人</Text>
          </View>
        )) : null}
      </View>
    );
  };

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '艺人类型转换' }} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : loadFailed ? (
        <View style={{ flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>
            艺人数据加载失败
          </Text>
          <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
            暂时无法读取未设置类型的艺人与所属关系。请重试，已保存的数据不会受影响。
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => { void load(); }}
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
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(group) => group.id}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 104 }}
          ListHeaderComponent={(
            <View>
              <MenuCard>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <MenuIconTile tint={dataTint} name="artists" />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                      整理未设置类型的艺人
                    </Text>
                  </View>
                  {[
                    '已有所属关系的艺人只能整组转换，团体和成员会一起变化。',
                    '单独艺人可以分别选择个人或团体。',
                    '最后会弹出确认清单，检查无误后再生效。',
                  ].map((line) => (
                    <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 }}>
                      <View style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: colors.accent,
                        marginTop: 8,
                        marginRight: 8,
                      }} />
                      <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
                        {line}
                      </Text>
                    </View>
                  ))}
                </View>
              </MenuCard>
              <View style={{
                marginTop: 14,
                height: 44,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                backgroundColor: isDark ? colors.input : colors.cardMuted,
              }}>
                <AppIcon name="search" size={16} color={colors.placeholder} />
                <TextInput
                  accessibilityLabel="搜索未设置类型的艺人"
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="搜索团体或成员"
                  placeholderTextColor={colors.placeholder}
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                  autoCorrect={false}
                  style={{ flex: 1, height: 42, paddingVertical: 0, color: colors.text, fontSize: 14 }}
                />
              </View>
            </View>
          )}
          renderSectionHeader={({ section }) => {
            const isRelationships = section.key === 'relationships';
            return (
              <View style={{ marginTop: 22, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '700' }}>
                      {isRelationships ? '已有所属关系' : '单独艺人'}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                      {isRelationships ? `${section.data.length} 组` : `${section.data.length} 位`}
                    </Text>
                  </View>
                  {isRelationships ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      disabled={saving || selectableRelationshipGroups.length === 0}
                      onPress={toggleRelationshipSelectAll}
                      style={{ minHeight: 44, paddingLeft: 16, justifyContent: 'center' }}
                    >
                      <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: '800' }}>
                        {allRelationshipGroupsSelected ? '取消全选' : '全选'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="全部设为个人"
                        disabled={saving || allIsolatedArtists.length === 0}
                        onPress={() => selectAllIsolated('person')}
                        style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}
                      >
                        <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: '800' }}>
                          全选为个人
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="全部设为团体"
                        disabled={saving || allIsolatedArtists.length === 0}
                        onPress={() => selectAllIsolated('group')}
                        style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}
                      >
                        <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: '800' }}>
                          全选为团体
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <Text style={{ marginTop: 3, color: colors.textMuted, fontSize: 12 }}>
                  {isRelationships
                    ? '已有所属关系的艺人仅能整组转换'
                    : '没有所属关系，可单独选择个人或团体'}
                </Text>
              </View>
            );
          }}
          ListFooterComponent={relationshipGroups.length + isolatedGroups.length === 0 ? (
            <Text style={{ marginTop: 26, textAlign: 'center', color: colors.textMuted, fontSize: 13 }}>
              {groups.length === 0
                ? '没有未设置类型的艺人，可返回艺人管理继续整理'
                : '没有找到匹配的关系或艺人'}
            </Text>
          ) : null}
          renderItem={renderGroup}
        />
      )}

      {!loading && !loadFailed ? <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 20,
        backgroundColor: colors.screen,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
      }}>
        <TouchableOpacity
          onPress={openConfirm}
          disabled={saving || selectedCount === 0}
          style={{
            height: 48,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            opacity: saving || selectedCount === 0 ? 0.45 : 1,
          }}
        >
          {saving ? <ActivityIndicator color={colors.onAccent} /> : (
            <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '800' }}>
              确认转换（{selectedCount}）
            </Text>
          )}
        </TouchableOpacity>
      </View> : null}

      <BottomSheetDialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="确认转换"
        scrollable
        footer={(
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <BottomSheetAction label="取消" variant="secondary" style={{ flex: 1 }} disabled={saving} onPress={() => setConfirmOpen(false)} />
            <BottomSheetAction label="确认转换" style={{ flex: 1.4 }} loading={saving} onPress={() => { setConfirmOpen(false); void apply(); }} />
          </View>
        )}
      >
        <View>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>
            {`将设置 ${selectedPersonCount} 位个人、${selectedGroupCount} 个团体，并转换 ${selectedMembershipCount} 段所属关系。`}
          </Text>
          <View style={{
            marginTop: 12,
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            backgroundColor: colors.warningSoft,
          }}>
            <Text style={{ color: colors.warning, fontSize: 12.5, lineHeight: 18 }}>
              转换后，普通所属将变为正式团体履历（无起止日期），这些艺人的类型将不再允许直接修改。
            </Text>
          </View>
          {confirmOpen ? selectedGroups.map(renderConfirmGroup) : null}
        </View>
      </BottomSheetDialog>
    </SafeAreaView>
  );
}

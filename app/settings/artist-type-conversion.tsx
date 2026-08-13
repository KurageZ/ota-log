import React, { useCallback, useMemo, useState } from 'react';
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
import { resolveAvatarSource } from '../../src/utils/avatarSource';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import { showSaveFailedAlert } from '../../src/utils/failureAlert';
import type { InferredArtistTypeConversion } from '../../src/repositories/ArtistRepository';
import {
  ArtistTypeConversionGroup,
  buildArtistTypeConversionGraph,
  buildArtistTypeConversionGroups,
  updateLinkedTypeDecision,
} from '../../src/utils/artistTypeConversion';

interface ConversionSection {
  key: 'selected' | 'available';
  data: ArtistTypeConversionGroup[];
}

export default function ArtistTypeConversionScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [decisions, setDecisions] = useState<Record<string, ArtistType | null>>({});
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inferred, setInferred] = useState<InferredArtistTypeConversion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [all, inferredConversion, directActivityCounts] = await Promise.all([
        db.artists.findAll(),
        db.artists.inferTypeConversion(),
        db.artists.findDirectActivityCounts(),
      ]);
      const unset = all.filter((artist) => artist.artist_type == null);
      setArtists(unset);
      setActivityCounts(directActivityCounts);
      setDecisions(Object.fromEntries(unset.map((artist) => [artist.id, null])));
      setInferred(inferredConversion);
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
  const availableGroups = useMemo(() => groups.filter((group) => {
    if (isGroupSelected(group)) return false;
    if (!normalizedKeyword) return true;
    return group.artists.some((artist) => (
      artist.name.toLocaleLowerCase().includes(normalizedKeyword)
      || artist.short_name?.toLocaleLowerCase().includes(normalizedKeyword)
    ));
  }), [groups, isGroupSelected, normalizedKeyword]);
  const sections = useMemo<ConversionSection[]>(() => [
    { key: 'selected', data: selectedGroups },
    { key: 'available', data: availableGroups },
  ], [availableGroups, selectedGroups]);

  const selectedCount = Object.values(decisions).filter(Boolean).length;
  const selectedPersonCount = Object.values(decisions).filter((type) => type === 'person').length;
  const selectedGroupCount = Object.values(decisions).filter((type) => type === 'group').length;
  const selectedMembershipCount = artists.filter((artist) => (
    artist.parent_id
      && decisions[artist.id] === 'person'
      && decisions[artist.parent_id] === 'group'
  )).length;
  const selectableGroups = groups.filter((group) => !group.ambiguous);
  const allSelectableSelected = selectableGroups.length > 0 && selectableGroups.every(isGroupSelected);

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

  const previewInferred = () => {
    if (!inferred || Object.keys(inferred.decisions).length === 0) return;
    setDecisions(Object.fromEntries(artists.map((artist) => [
      artist.id,
      inferred.decisions[artist.id] ?? null,
    ])));
  };

  const toggleSelectAll = () => {
    setDecisions((current) => {
      const next = { ...current };
      for (const group of selectableGroups) {
        for (const artist of group.artists) {
          next[artist.id] = allSelectableSelected
            ? null
            : (graph.suggestedTypes[artist.id] ?? 'person');
        }
      }
      return next;
    });
  };

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

  const confirmApply = () => {
    if (selectedCount === 0) return;
    Alert.alert(
      '确认转换？',
      `将设置 ${selectedPersonCount} 位个人、${selectedGroupCount} 个团体，并转换 ${selectedMembershipCount} 段所属关系。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '确认转换', onPress: () => { void apply(); } },
      ],
    );
  };

  const renderArtistRow = (
    artist: Artist,
    group: ArtistTypeConversionGroup,
    isPrimary: boolean,
  ) => {
    const selectedType = decisions[artist.id];
    const directActivityCount = activityCounts[artist.id] ?? 0;
    const groupSelected = isGroupSelected(group);
    return (
      <View
        key={artist.id}
        style={{
          minHeight: isPrimary ? 58 : 50,
          paddingLeft: isPrimary ? 8 : 52,
          paddingRight: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderTopWidth: isPrimary ? 0 : 1,
          borderTopColor: colors.divider,
          backgroundColor: isPrimary && groupSelected ? colors.accentSofter : isPrimary ? colors.card : colors.cardMuted,
        }}
      >
        {isPrimary ? (
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: groupSelected, disabled: group.ambiguous }}
            accessibilityLabel={`${groupSelected ? '取消转换' : '选择转换'} ${artist.name}${group.isRelationship ? '及其成员' : ''}`}
            disabled={group.ambiguous || saving}
            onPress={() => toggleGroup(group)}
            activeOpacity={0.65}
            style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <AppIcon
              name="checkbox"
              variant={groupSelected ? 'selected' : 'unselected'}
              size={22}
              color={groupSelected ? colors.accent : colors.chevron}
            />
          </TouchableOpacity>
        ) : null}
        <OshiAvatar source={resolveAvatarSource(artist.avatar_uri)} size={isPrimary ? 38 : 32} isOshi={false} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: isPrimary ? 14.5 : 13.5, fontWeight: '700' }}>
            {artist.name}
          </Text>
          <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11.5 }}>
              {group.ambiguous
                ? '多层所属，需先整理'
                : group.isRelationship && isPrimary
                  ? `${group.artists.length - 1} 位成员 · ${selectedType === 'group' ? '转换为团体' : '建议：团体'}`
                  : selectedType === 'group' ? '转换为团体'
                  : selectedType === 'person' ? '转换为个人'
                    : graph.suggestedTypes[artist.id] === 'group' ? '建议：团体'
                      : graph.suggestedTypes[artist.id] === 'person' ? '建议：个人' : '类型待选择'}
            </Text>
            {directActivityCount > 0 ? (
              <Text style={{ color: colors.accentText, fontSize: 11.5, fontWeight: '700' }}>
                {directActivityCount} 场活动
              </Text>
            ) : null}
          </View>
        </View>

        {!group.isRelationship && !group.ambiguous ? (
          <View style={{ marginLeft: 8, flexDirection: 'row', gap: 5 }}>
            {([
              { value: 'person' as const, label: '个人' },
              { value: 'group' as const, label: '团体' },
            ]).map((option) => {
              const active = selectedType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  disabled={saving}
                  onPress={() => updateDecision(artist.id, option.value)}
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
        ) : null}
      </View>
    );
  };

  const renderGroup = ({ item }: { item: ArtistTypeConversionGroup }) => {
    const selected = isGroupSelected(item);
    return (
      <View style={{
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: selected ? colors.accentBorder : colors.divider,
        backgroundColor: colors.card,
      }}>
        {item.artists.map((artist, index) => renderArtistRow(artist, item, index === 0))}
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
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                每张卡片代表一整组所属关系。选择或取消卡片时，团体与全部成员会一起变化。
              </Text>
              <View style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.accentBorder,
              }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>一键推测</Text>
                <Text style={{ marginTop: 6, color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                  成员推测为个人，上级推测为团体。生成后可按关系组检查；孤立艺人仍需明确选择类型。
                </Text>
                <Text style={{ marginTop: 10, color: colors.text, fontSize: 13, fontWeight: '700' }}>
                  建议 {inferred?.personCount ?? 0} 位个人 · {inferred?.groupCount ?? 0} 个团体 · {inferred?.membershipCount ?? 0} 段关系
                </Text>
                <TouchableOpacity
                  onPress={previewInferred}
                  disabled={saving || !inferred || Object.keys(inferred.decisions).length === 0}
                  style={{
                    marginTop: 14,
                    minHeight: 44,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.accent,
                    opacity: saving || !inferred || Object.keys(inferred.decisions).length === 0 ? 0.45 : 1,
                  }}
                >
                  <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>
                    {!inferred || Object.keys(inferred.decisions).length === 0 ? '没有可推测的关系' : '生成转换预览'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          renderSectionHeader={({ section }) => section.key === 'selected' ? (
            <View style={{ marginTop: 22, marginBottom: section.data.length > 0 ? 10 : 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '700' }}>已选择</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={saving || selectableGroups.length === 0}
                  onPress={toggleSelectAll}
                  style={{ minHeight: 44, paddingLeft: 16, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: colors.accentText, fontSize: 13, fontWeight: '800' }}>
                    {allSelectableSelected ? '取消全选' : '全选'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}>
                已选择 {selectedCount} 位艺人；有活动记录的关系优先显示
              </Text>
              {section.data.length === 0 ? (
                <View style={{
                  marginTop: 10,
                  minHeight: 54,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.cardMuted,
                  borderWidth: 1,
                  borderColor: colors.divider,
                }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>尚未选择要转换的关系或艺人</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 22, marginBottom: 12 }}>
              <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '700' }}>未选择</Text>
              <Text style={{ marginTop: 3, marginBottom: 10, color: colors.textMuted, fontSize: 12 }}>
                关系按组选择；有活动记录的内容排在前面
              </Text>
              <View style={{
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
              {section.data.length === 0 ? (
                <Text style={{ marginTop: 26, textAlign: 'center', color: colors.textMuted, fontSize: 13 }}>
                  {groups.length === 0
                    ? '没有未设置类型的艺人，可返回艺人管理继续整理'
                    : groups.length === selectedGroups.length
                    ? '所有可转换内容都已选择'
                    : normalizedKeyword ? '没有找到匹配的关系或艺人' : '没有未选择的内容'}
                </Text>
              ) : null}
            </View>
          )}
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
          onPress={confirmApply}
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
    </SafeAreaView>
  );
}

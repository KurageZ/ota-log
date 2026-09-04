import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDB } from '../../../src/context/DBContext';
import { Artist, ArtistGroupMembershipWithArtist } from '../../../src/types/models';
import { useAppTheme } from '../../../src/theme/appTheme';
import { OshiAvatar } from '../../../src/components/Oshi';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { getArtistPrimaryName } from '../../../src/utils/artistDisplay';
import { AppIcon } from '../../../src/components/AppIcon';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../../src/utils/safeArea';
import { toISODate } from '../../../src/utils/date';

function rangeLabel(membership: ArtistGroupMembershipWithArtist): string {
  const start = membership.start_date ?? '更早';
  const end = membership.end_date ?? '至今';
  return `${start} — ${end}`;
}

export default function ArtistMembershipHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors } = useAppTheme();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [memberships, setMemberships] = useState<ArtistGroupMembershipWithArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const current = await db.artists.findById(id);
      setArtist(current);
      if (current?.artist_type === 'person') {
        setMemberships(await db.artists.findMembershipsForPerson(id));
      } else if (current?.artist_type === 'group') {
        setMemberships(await db.artists.findMembershipsForGroup(id));
      } else {
        setMemberships([]);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const today = toISODate(new Date());

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: artist?.artist_type === 'group' ? '成员履历' : '所属履历' }} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : loadFailed ? (
        <View style={{ flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.heading, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>
            所属履历加载失败
          </Text>
          <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
            暂时无法读取当前与历史关系。请重试，已保存的数据不会受影响。
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
        <FlatList
          data={memberships}
          keyExtractor={(membership) => membership.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
          ListHeaderComponent={(
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
              {artist?.artist_type === 'group'
                ? '这里显示当前与历史成员关系。日期首尾均计入在团时间。'
                : '这里显示当前与历史所属团体。日期首尾均计入在团时间。'}
            </Text>
          )}
          ListEmptyComponent={(
            <View style={{ flex: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
                还没有{artist?.artist_type === 'group' ? '成员' : '所属'}履历
              </Text>
              <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
                前往编辑艺人添加当前关系；需要记录历史日期时，可展开高级内容继续填写。
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => router.push(`/artists/${id}/edit`)}
                style={{ minHeight: 44, marginTop: 18, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}
              >
                <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>编辑艺人</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item: membership }) => {
            const current = (membership.start_date == null || membership.start_date <= today)
              && (membership.end_date == null || membership.end_date >= today);
            return (
              <TouchableOpacity
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={`查看${membership.artist.name}的艺人详情`}
                onPress={() => router.push(`/artists/${membership.artist.id}`)}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10,
                  borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.divider,
                }}
              >
                <OshiAvatar source={resolveAvatarSource(membership.artist.avatar_uri)} size={40} isOshi={false} name={getArtistPrimaryName(membership.artist)} />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: '700' }}>
                      {membership.artist.name}
                    </Text>
                    {current ? (
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>当前</Text>
                    ) : null}
                  </View>
                  <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 12 }}>
                    {rangeLabel(membership)}
                  </Text>
                </View>
                <AppIcon name="disclosure" variant="forward" size={15} color={colors.chevron} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../src/components/AppIcon';
import { useDB } from '../../src/context/DBContext';
import type { Artist } from '../../src/types/models';
import { useAppTheme } from '../../src/theme/appTheme';
import { loadWeiboCookie } from '../../src/utils/weibo/cookieStore';
import {
  fetchWeiboFollowingPage,
  type WeiboFollowingUser,
} from '../../src/utils/weibo/fetchFollowing';
import { cleanOfficialSuffix, fetchWeiboUser } from '../../src/utils/weibo/fetchUser';
import { findExistingWeiboUserIds } from '../../src/utils/weibo/importFollowing';
import { showFailureAlert } from '../../src/utils/failureAlert';

export default function WeiboFollowingScreen() {
  const db = useDB();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [cookie, setCookie] = useState('');
  const [users, setUsers] = useState<WeiboFollowingUser[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [favoriteUserIds, setFavoriteUserIds] = useState<Set<string>>(new Set());
  const [ownerName, setOwnerName] = useState('');
  const [searchedUrl, setSearchedUrl] = useState('');
  const [containerId, setContainerId] = useState('');
  const [page, setPage] = useState(0);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const canLoadMoreRef = useRef(false);

  const existingUserIds = useMemo(
    () => findExistingWeiboUserIds(users, artists),
    [artists, users],
  );
  const selectedCount = useMemo(
    () => [...selectedUserIds].filter((id) => !existingUserIds.has(id)).length,
    [existingUserIds, selectedUserIds],
  );
  const favoriteCount = useMemo(
    () => [...favoriteUserIds].filter((id) => selectedUserIds.has(id)).length,
    [favoriteUserIds, selectedUserIds],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([loadWeiboCookie(), db.artists.findAll()]).then(([nextCookie, nextArtists]) => {
        if (!active) return;
        setCookie(nextCookie);
        setArtists(nextArtists);
      });
      return () => {
        active = false;
      };
    }, [db.artists]),
  );

  const showQueryFailure = useCallback((kind: 'captcha' | 'error', message?: string) => {
    if (kind === 'captcha') {
      showFailureAlert({
        title: '需要微博登录',
        reason: '微博拒绝了关注列表请求，当前登录状态可能不存在或已经失效。',
        nextStep: '请重新登录微博，再返回此页面查询。',
        buttons: [
          { text: '取消', style: 'cancel' },
          { text: '去登录', onPress: () => router.push('/weibo') },
        ],
      });
      return;
    }

    showFailureAlert({
      title: '查询失败',
      reason: message || '未能读取该用户的关注列表。',
      nextStep: '请确认链接是带数字 UID 的微博用户主页，并稍后重试。',
    });
  }, []);

  const handlePaste = useCallback(async () => {
    const value = (await Clipboard.getString()).trim();
    if (value) setUrl(value);
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || loading || importing) return;

    Keyboard.dismiss();
    setLoading(true);
    setUsers([]);
    setOwnerName('');
    setSearchedUrl('');
    setFollowingCount(null);
    setHasMore(false);
    setSelectedUserIds(new Set());
    setFavoriteUserIds(new Set());
    canLoadMoreRef.current = false;

    try {
      const [profile, following] = await Promise.all([
        fetchWeiboUser(trimmed, cookie),
        fetchWeiboFollowingPage({ userUrl: trimmed, cookie, page: 1 }),
      ]);

      if (!following.ok) {
        showQueryFailure(following.kind, following.message);
        return;
      }

      setUsers(following.users);
      setOwnerName(profile.ok ? profile.screen_name : '该用户');
      setSearchedUrl(trimmed);
      setContainerId(following.containerId);
      setPage(1);
      const nextFollowingCount = profile.ok ? profile.following_count : null;
      setFollowingCount(nextFollowingCount);
      setHasMore(following.hasMore);
    } finally {
      setLoading(false);
    }
  }, [cookie, importing, loading, showQueryFailure, url]);

  const toggleUser = useCallback((id: string) => {
    if (existingUserIds.has(id) || importing) return;
    const nextSelected = new Set(selectedUserIds);
    if (nextSelected.has(id)) {
      nextSelected.delete(id);
      const nextFavorites = new Set(favoriteUserIds);
      nextFavorites.delete(id);
      setFavoriteUserIds(nextFavorites);
    } else {
      nextSelected.add(id);
    }
    setSelectedUserIds(nextSelected);
  }, [existingUserIds, favoriteUserIds, importing, selectedUserIds]);

  const toggleFavorite = useCallback((id: string) => {
    if (existingUserIds.has(id) || importing) return;
    const nextFavorites = new Set(favoriteUserIds);
    if (nextFavorites.has(id)) {
      nextFavorites.delete(id);
    } else {
      nextFavorites.add(id);
      setSelectedUserIds(new Set(selectedUserIds).add(id));
    }
    setFavoriteUserIds(nextFavorites);
  }, [existingUserIds, favoriteUserIds, importing, selectedUserIds]);

  const handleImport = useCallback(async () => {
    if (selectedCount === 0 || importing) return;

    const selectedUsers = users.filter(
      (user) => selectedUserIds.has(user.id) && !existingUserIds.has(user.id),
    );
    if (selectedUsers.length === 0) return;

    setImporting(true);
    try {
      await db.rawDb.withTransactionAsync(async () => {
        for (const user of selectedUsers) {
          const artist = await db.artists.create({
            name: cleanOfficialSuffix(user.screenName) || user.screenName,
            avatar_uri: user.avatarUrl,
            url: user.profileUrl,
          });
          if (favoriteUserIds.has(user.id)) {
            await db.artists.update(artist.id, { is_favorite: 1 });
          }
        }
      });

      const nextArtists = await db.artists.findAll();
      setArtists(nextArtists);
      setSelectedUserIds(new Set());
      setFavoriteUserIds(new Set());
      const importedFavoriteCount = selectedUsers.filter((user) => favoriteUserIds.has(user.id)).length;
      Alert.alert(
        '加入完成',
        importedFavoriteCount > 0
          ? `已加入 ${selectedUsers.length} 个艺人，其中 ${importedFavoriteCount} 个已收藏。`
          : `已将 ${selectedUsers.length} 个微博账号加入艺人数据库。`,
      );
    } catch (error) {
      showFailureAlert({
        title: '加入失败',
        reason: '未能将所选微博账号写入艺人数据库。',
        nextStep: '请稍后重试；如果问题持续出现，请减少本次选择数量。',
        details: error,
      });
    } finally {
      setImporting(false);
    }
  }, [
    db.artists,
    db.rawDb,
    existingUserIds,
    favoriteUserIds,
    importing,
    selectedCount,
    selectedUserIds,
    users,
  ]);

  const handleLoadMore = useCallback(async () => {
    if (!searchedUrl || !containerId || !hasMore || loadingMore || importing) return;
    setLoadingMore(true);

    try {
      const result = await fetchWeiboFollowingPage({
        userUrl: searchedUrl,
        cookie,
        page: page + 1,
        containerId,
      });
      if (!result.ok) {
        setHasMore(false);
        return;
      }

      const existingIds = new Set(users.map((user) => user.id));
      const additions = result.users.filter((user) => !existingIds.has(user.id));
      setUsers((current) => [...current, ...additions]);
      setPage((current) => current + 1);
      setHasMore(result.hasMore && additions.length > 0);
    } finally {
      setLoadingMore(false);
    }
  }, [
    containerId,
    cookie,
    hasMore,
    importing,
    loadingMore,
    page,
    searchedUrl,
    users,
  ]);

  const handleEndReached = useCallback(() => {
    if (!canLoadMoreRef.current) return;
    canLoadMoreRef.current = false;
    void handleLoadMore();
  }, [handleLoadMore]);

  const renderUser = useCallback(({ item }: { item: WeiboFollowingUser }) => {
    const alreadyExists = existingUserIds.has(item.id);
    const selected = alreadyExists || selectedUserIds.has(item.id);
    const favorite = favoriteUserIds.has(item.id);

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          backgroundColor: selected ? colors.accentSofter : colors.card,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.65}
          disabled={alreadyExists || importing}
          onPress={() => toggleUser(item.id)}
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: alreadyExists ? 0.72 : 1,
          }}
        >
          <AppIcon
            name="checkbox"
            variant={selected ? 'selected' : 'unselected'}
            size={22}
            color={selected ? colors.accent : colors.chevron}
            style={{ marginRight: 12 }}
          />

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accentSoft,
              marginRight: 12,
            }}
          >
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={{ width: 44, height: 44 }} />
            ) : (
              <AppIcon name="artist" size={21} color={colors.accent} />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, fontWeight: '700', color: colors.text }}
            >
              {item.screenName}
            </Text>
            {alreadyExists ? (
              <Text style={{ marginTop: 3, fontSize: 12, fontWeight: '700', color: colors.accent }}>
                已在艺人数据库中
              </Text>
            ) : item.description ? (
              <Text
                numberOfLines={2}
                style={{ marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}
              >
                {item.description}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {!alreadyExists ? (
          <TouchableOpacity
            activeOpacity={0.6}
            disabled={importing}
            onPress={() => toggleFavorite(item.id)}
            accessibilityLabel={`${favorite ? '取消收藏' : '加入收藏'} ${item.screenName}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 10, padding: 4, opacity: importing ? 0.45 : 1 }}
          >
            <AppIcon
              name="favorite"
              variant={favorite ? 'active' : 'inactive'}
              size={19}
              color={favorite ? colors.oshiBadgeBg : colors.chevron}
            />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => Linking.openURL(item.profileUrl)}
          accessibilityLabel={`打开 ${item.screenName} 的微博主页`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginLeft: 12, padding: 4 }}
        >
          <AppIcon name="externalLink" size={17} color={colors.chevron} />
        </TouchableOpacity>
      </View>
    );
  }, [
    colors,
    existingUserIds,
    favoriteUserIds,
    importing,
    selectedUserIds,
    toggleFavorite,
    toggleUser,
  ]);

  const listHeader = (
    <>
      <View
        style={{
          margin: 16,
          padding: 16,
          borderRadius: 18,
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.heading }}>
          查询关注列表
        </Text>
        <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
          输入微博用户链接，可查询关注列表并加入到数据库。
        </Text>

        <View
          style={{
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.warningSoft,
          }}
        >
          <AppIcon name="info" size={17} color={colors.warning} />
          <Text style={{ flex: 1, marginLeft: 8, fontSize: 12, lineHeight: 18, color: colors.text }}>
            受微博限制，部分异常账号可能不会展示，查询结果可能与关注数量不一致，仅供参考。
          </Text>
        </View>

        <View
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.input,
          }}
        >
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://weibo.com/u/1234567890"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            style={{
              flex: 1,
              minWidth: 0,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: colors.text,
            }}
          />
          <TouchableOpacity
            onPress={handlePaste}
            activeOpacity={0.6}
            style={{ paddingHorizontal: 14, paddingVertical: 12 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>粘贴</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleSearch}
          activeOpacity={0.72}
          disabled={!url.trim() || loading || importing}
          style={{
            marginTop: 12,
            minHeight: 48,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.accent,
            opacity: !url.trim() || loading || importing ? 0.45 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <AppIcon name="search" size={18} color={colors.onAccent} />
          )}
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.onAccent }}>
            {loading ? '正在查询' : '查询关注'}
          </Text>
        </TouchableOpacity>

        {!cookie ? (
          <TouchableOpacity
            activeOpacity={0.65}
            onPress={() => router.push('/weibo')}
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.warningSoft,
            }}
          >
            <AppIcon name="login" size={18} color={colors.warning} />
            <Text style={{ flex: 1, marginLeft: 9, fontSize: 12.5, lineHeight: 18, color: colors.text }}>
              尚未保存微博登录状态，关注列表可能无法读取。
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warning }}>去登录</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {searchedUrl ? (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 4,
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'baseline',
          }}
        >
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.heading }}>
            {ownerName} 的关注
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            已读取 {users.length} 个
            {followingCount === null ? '' : ` · 微博显示关注 ${followingCount} 个`}
            {' · '}已存在 {existingUserIds.size} 个
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen options={{ title: '微博关注导入' }} />
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        extraData={{ selectedUserIds, favoriteUserIds, existingUserIds, importing }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          searchedUrl && !loading ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 42 }}>
              <AppIcon name="artists" size={34} color={colors.textMuted} />
              <Text style={{ marginTop: 12, fontSize: 14, fontWeight: '700', color: colors.text }}>
                没有读取到关注账号
              </Text>
              <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 19, textAlign: 'center', color: colors.textSecondary }}>
                该用户可能没有公开关注列表，或微博限制了可查询范围。
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          users.length > 0 ? (
            <View
              style={{
                alignSelf: 'center',
                marginTop: 16,
                marginBottom: 12,
                paddingHorizontal: 18,
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <AppIcon
                  name={hasMore ? 'disclosure' : 'statusCompleted'}
                  variant={hasMore ? 'down' : undefined}
                  size={17}
                  color={hasMore ? colors.textMuted : colors.success}
                />
              )}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: loadingMore
                    ? colors.accent
                    : hasMore
                      ? colors.textMuted
                      : colors.success,
                }}
              >
                {loadingMore ? '正在加载更多' : hasMore ? '继续下滑加载更多' : '加载完成'}
              </Text>
            </View>
          ) : null
        }
        onScrollBeginDrag={() => {
          canLoadMoreRef.current = true;
        }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.02}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (users.length > 0 ? 104 : 24),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      {users.length > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.card,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.72}
            disabled={selectedCount === 0 || importing}
            onPress={handleImport}
            style={{
              minHeight: 48,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.accent,
              opacity: selectedCount === 0 || importing ? 0.45 : 1,
            }}
          >
            {importing ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <AppIcon name="addPerson" size={18} color={colors.onAccent} />
            )}
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.onAccent }}>
              {importing
                ? '正在加入'
                : favoriteCount > 0
                  ? `加入艺人数据库（${selectedCount}，收藏 ${favoriteCount}）`
                  : `加入艺人数据库（${selectedCount}）`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import {
  AndroidCompactTabHeader,
  AndroidLargeTabTitle,
  useAndroidCollapsibleTabHeader,
} from '../../../src/components/AndroidCollapsibleTabHeader';
import { useOnboardingGuide } from '../../../src/components/OnboardingGuide';
import { useDB } from '../../../src/context/DBContext';
import { OshiAvatar, OshiBadge } from '../../../src/components/Oshi';
import { AppIcon, getAppIconSFSymbol } from '../../../src/components/AppIcon';
import { MenuCard, MenuItem, SectionLabel } from '../../../src/components/SettingsMenu';
import { useFloatingTabBarScroll } from '../../../src/navigation/FloatingTabBarVisibility';
import { useFloatingTabBarSpacing } from '../../../src/navigation/floatingTabBar';
import { useAppTheme, type ThemeColors } from '../../../src/theme/appTheme';
import { Artist, UserConfig } from '../../../src/types/models';
import { APP_VERSION_LABEL } from '../../../src/utils/appInfo';
import { getArtistDisplayText, getArtistPrimaryName } from '../../../src/utils/artistDisplay';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';

type ProfileStats = {
  events: number;
  completed: number;
  favoriteArtists: number;
  totalArtists: number;
  cheki: number;
  dateItems: number;
};

const DEFAULT_STATS: ProfileStats = {
  events: 0,
  completed: 0,
  favoriteArtists: 0,
  totalArtists: 0,
  cheki: 0,
  dateItems: 0,
};


function ProfileStat({
  label,
  value,
  colors,
  isLast = false,
}: {
  label: string;
  value: number;
  colors: ThemeColors;
  isLast?: boolean;
}) {
  return (
    <>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
        <Text
          style={{
            fontSize: 25,
            lineHeight: 29,
            fontWeight: '900',
            color: colors.heading,
            fontVariant: ['tabular-nums'],
          }}
        >
          {value}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 5,
            fontSize: 10.5,
            lineHeight: 13,
            fontWeight: '600',
            textAlign: 'center',
            color: colors.textSecondary,
          }}
        >
          {label}
        </Text>
      </View>
      {isLast ? null : <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.divider }} />}
    </>
  );
}

export default function ProfileScreen() {
  const { colors, isDark } = useAppTheme();
  const { showHelp } = useOnboardingGuide();
  const { contentBottomPadding } = useFloatingTabBarSpacing();
  const db = useDB();
  const isAndroid = Platform.OS === 'android';
  const androidHeader = useAndroidCollapsibleTabHeader();
  const iosTabBarScroll = useFloatingTabBarScroll();

  const [stats, setStats] = useState<ProfileStats>(DEFAULT_STATS);
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        db.events.findAll(),
        db.artists.findAll(),
        db.cheki.countAll(),
        db.dateItems.countAll(),
        db.userConfig.getConfig(),
      ]).then(([events, artists, chekiCount, dateItemCount, config]) => {
        setStats({
          events: events.length,
          completed: events.filter((event) => event.status === 'completed').length,
          favoriteArtists: artists.filter((artist) => artist.is_favorite).length,
          totalArtists: artists.length,
          cheki: chekiCount,
          dateItems: dateItemCount,
        });
        setUserConfig(config);
        setAllArtists(artists);
      }).catch(() => {});
    }, [db]),
  );

  const tabBarScroll = isAndroid ? androidHeader.scrollProps : iosTabBarScroll;

  const oshiArtist = useMemo(
    () => allArtists.find((artist) => artist.id === userConfig?.oshi_artist_id) ?? null,
    [allArtists, userConfig],
  );
  const oshiDisplay = useMemo(() => {
    if (!oshiArtist) return null;
    const parentName = oshiArtist.parent_id
      ? (allArtists.find((a) => a.id === oshiArtist.parent_id) ? getArtistPrimaryName(allArtists.find((a) => a.id === oshiArtist.parent_id)!) : null)
      : null;
    return getArtistDisplayText({ artist: oshiArtist, parentName });
  }, [allArtists, oshiArtist]);
  const profileName = userConfig?.name ?? 'Otaku';
  const avatarSize = 92;
  const menuTints = colors.profileMenu;
  const renderSettingsIcon = useCallback(() => (
    <TouchableOpacity
      activeOpacity={0.65}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => router.push('/settings')}
      accessibilityLabel="设置"
      accessibilityRole="button"
    >
      <AppIcon name="settings" size={22} color={colors.accent} />
    </TouchableOpacity>
  ), [colors.accent, router]);
  const content = (
    <>
      <View style={{ marginHorizontal: 16, marginBottom: 32 }}>
        {isAndroid ? (
          <AndroidLargeTabTitle
            title="我的"
            right={renderSettingsIcon()}
            largeTitleStyle={androidHeader.largeTitleStyle}
          />
        ) : null}

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 16,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.18 : 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: colors.oshiAvatarBg,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {userConfig?.avatar_uri ? (
                <Image
                  source={{ uri: userConfig.avatar_uri }}
                  style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
                />
              ) : (
                <AppIcon name="profile" size={42} color={colors.textSecondary} />
              )}
            </View>

            <Text
              numberOfLines={1}
              style={{
                maxWidth: '84%',
                marginTop: 14,
                fontSize: 18,
                lineHeight: 22,
                fontWeight: '800',
                textAlign: 'center',
                color: colors.heading,
              }}
            >
              {profileName}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'stretch',
              marginTop: 22,
              paddingTop: 18,
              borderTopWidth: 1,
              borderTopColor: colors.divider,
            }}
          >
            <ProfileStat label="活动总数" value={stats.events} colors={colors} />
            <ProfileStat label="已完成" value={stats.completed} colors={colors} />
            <ProfileStat label="收藏艺人" value={stats.favoriteArtists} colors={colors} />
            <ProfileStat label="拍立得" value={stats.cheki} colors={colors} isLast />
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              if (oshiArtist) {
                router.push(`/artists/${oshiArtist.id}`);
                return;
              }
              router.push('/settings/oshi');
            }}
            style={{
              marginTop: 18,
              paddingTop: 15,
              paddingHorizontal: 8,
              borderTopWidth: 1,
              borderTopColor: colors.divider,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
              {oshiArtist ? (
                <View style={{ marginRight: 12 }}>
                  <OshiAvatar source={resolveAvatarSource(oshiArtist.avatar_uri)} size={40} isOshi name={getArtistPrimaryName(oshiArtist)} />
                </View>
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <AppIcon name="oshi" variant="inactive" size={20} color={colors.oshiBadgeBg} />
                </View>
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 15.5,
                    lineHeight: 20,
                    fontWeight: '800',
                    color: oshiArtist ? colors.text : colors.textSecondary,
                  }}
                >
                  {oshiDisplay?.title ?? '设置单推'}
                </Text>
              </View>

              {oshiArtist ? (
                <View style={{ marginLeft: 12 }}>
                  <OshiBadge />
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
        <SectionLabel label="功能" />
        <MenuCard>
          <MenuItem
            icon="calendar"
            label="所有活动"
            badge={stats.events}
            tint={menuTints.events}
            onPress={() => router.push('/events')}
          />
          <MenuItem
            icon="artists"
            label="艺人管理"
            badge={stats.totalArtists}
            tint={menuTints.artists}
            onPress={() => router.push('/artists')}
          />
          <MenuItem
            icon="dateItem"
            label="重要日期"
            badge={stats.dateItems}
            tint={menuTints.cheki}
            onPress={() => router.push('/date-items')}
          />
          <MenuItem
            icon="tools"
            label="工具箱"
            tint={menuTints.tools}
            isLast
            onPress={() => router.push('/tools')}
          />
        </MenuCard>
      </View>

      <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
        <SectionLabel label="更多" />
        <MenuCard>
          <MenuItem
            icon="settings"
            label="设置"
            subtitle="用户、自定义和数据备份等"
            tint={menuTints.settings}
            onPress={() => router.push('/settings')}
          />
          <MenuItem
            icon="help"
            label="帮助"
            subtitle="查看 app 使用说明"
            tint={colors.accent}
            onPress={showHelp}
          />
          <MenuItem
            icon="info"
            label="关于"
            subtitle={`当前版本 v${APP_VERSION_LABEL}`}
            tint={menuTints.about}
            isLast
            onPress={() => router.push('/about')}
          />
        </MenuCard>
      </View>
    </>
  );

  if (!isAndroid) {
    return (
      <>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="设置"
            icon={getAppIconSFSymbol('settings')}
            onPress={() => router.push('/settings')}
          />
        </Stack.Toolbar>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.screen }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingTop: 6,
            paddingBottom: contentBottomPadding + 24,
          }}
          {...tabBarScroll}
        >
          {content}
        </ScrollView>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.screen }}>
      <AndroidCompactTabHeader
        title="我的"
        right={renderSettingsIcon()}
        compactHeaderStyle={androidHeader.compactHeaderStyle}
        overlayHeight={androidHeader.overlayHeight}
        overlayPaddingTop={androidHeader.overlayPaddingTop}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        scrollIndicatorInsets={{ bottom: contentBottomPadding }}
        contentContainerStyle={{
          paddingTop: androidHeader.contentTopPadding,
          paddingBottom: contentBottomPadding + 24,
        }}
        {...tabBarScroll}
      >
        {content}
      </ScrollView>
    </View>
  );
}

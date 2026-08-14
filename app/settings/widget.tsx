import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { ArtistSearchPicker } from '../../src/components/ArtistSearchPicker';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { useDB } from '../../src/context/DBContext';
import type { Artist } from '../../src/types/models';
import { useAppTheme } from '../../src/theme/appTheme';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { showSaveFailedAlert } from '../../src/utils/failureAlert';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import {
  loadChekiPhotoWidgetPreferences,
  saveChekiPhotoWidgetPreferences,
} from '../../src/widgets/chekiPhotoWidgetPreferences';

export default function WidgetSettingsScreen() {
  const { colors, isDark } = useAppTheme();
  const db = useDB();
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [availableArtistIds, setAvailableArtistIds] = useState<Set<string>>(new Set());
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        db.artists.findAll(),
        db.cheki.findDistinctPhotoArtistIds(),
        db.userConfig.getConfig(),
        loadChekiPhotoWidgetPreferences(),
      ]).then(([artists, photoArtistIds, config, preferences]) => {
        if (!active) return;
        const nextAvailableArtistIds = new Set(photoArtistIds);
        setAllArtists(artists);
        setAvailableArtistIds(nextAvailableArtistIds);
        setOshiArtistId(config.oshi_artist_id);
        setSelectedArtistIds(preferences.artistIds.filter((artistId) => nextAvailableArtistIds.has(artistId)));
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const availableArtists = useMemo(
    () => allArtists.filter((artist) => availableArtistIds.has(artist.id)),
    [allArtists, availableArtistIds],
  );
  const selectedArtistIdSet = useMemo(() => new Set(selectedArtistIds), [selectedArtistIds]);
  const selectedArtists = useMemo(
    () => allArtists.filter((artist) => selectedArtistIdSet.has(artist.id)),
    [allArtists, selectedArtistIdSet],
  );

  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      await saveChekiPhotoWidgetPreferences({ artistIds: selectedArtistIds });
      router.back();
    } catch (error) {
      showSaveFailedAlert(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: colors.screen }}>
      <Stack.Screen
        options={{
          title: '小组件设置',
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{ paddingRight: 4, opacity: saving ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>
                {saving ? '保存中' : '保存'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        right={{
          label: saving ? '保存中' : '保存',
          onPress: handleSave,
          disabled: saving,
          variant: 'done',
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 20,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
            展示拍立得
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 16 }}>
            选择一位或多位艺人后，桌面小组件只轮播这些艺人的拍立得。
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedArtistIds.length === 0 }}
            accessibilityLabel="展示全部艺人的拍立得"
            onPress={() => {
              setSelectedArtistIds([]);
              setSearchQuery('');
            }}
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              marginBottom: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: selectedArtistIds.length === 0 ? colors.accent : colors.inputBorder,
              backgroundColor: selectedArtistIds.length === 0 ? colors.accentSoft : colors.cardMuted,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>全部艺人</Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }}>
                按最近记录顺序轮播所有拍立得
              </Text>
            </View>
            <AppIcon
              name="radio"
              variant={selectedArtistIds.length === 0 ? 'selected' : 'unselected'}
              size={18}
              color={selectedArtistIds.length === 0 ? colors.accent : colors.chevron}
              secondaryColor={colors.onAccent}
            />
          </TouchableOpacity>

          <ArtistSearchPicker
            artists={availableArtists}
            selectedArtists={selectedArtists}
            selectedIds={selectedArtistIds}
            oshiArtistId={oshiArtistId}
            isDark={isDark}
            typePreference="person"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="搜索要展示的艺人"
            maxHeight={420}
            renderLimit={searchQuery.trim() ? 80 : 40}
            selectedLabel={`当前展示${selectedArtistIds.length > 0 ? ` · ${selectedArtistIds.length} 位` : ''}`}
            parentNameMap={artistNameMap}
            emptyText="没有找到有拍立得的艺人"
            idleEmptyText="还没有可展示的艺人"
            onSelectArtist={(artist) => {
              setSelectedArtistIds((current) => current.includes(artist.id)
                ? current
                : [...current, artist.id]);
              setSearchQuery('');
            }}
            onRemoveArtist={(artist) => {
              setSelectedArtistIds((current) => current.filter((artistId) => artistId !== artist.id));
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { useDB } from '../../src/context/DBContext';
import { Artist } from '../../src/types/models';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { ArtistSearchPicker } from '../../src/components/ArtistSearchPicker';
import { showSaveFailedAlert } from '../../src/utils/failureAlert';
import { useAppTheme } from '../../src/theme/appTheme';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

export default function OshiSettingsScreen() {
  const { colors, isDark } = useAppTheme();
  const db = useDB();

  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([db.artists.findAll(), db.userConfig.getConfig()]).then(([artists, config]) => {
        setAllArtists(artists);
        setSelectedArtistId(config.oshi_artist_id);
      });
    }, [db]),
  );

  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const selectedArtist = allArtists.find((artist) => artist.id === selectedArtistId) ?? null;

  const handleSave = async () => {
    if (saving) return;

    try {
      setSaving(true);
      await db.userConfig.updateConfig({ oshi_artist_id: selectedArtistId });
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
          title: '单推设置',
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ paddingRight: 4, opacity: saving ? 0.5 : 1 }}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>保存</Text>
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
            marginBottom: 16,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
            当前单推
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>
            设置后会自动加入收藏，并在艺人搜索和拍立得里优先展示。
          </Text>

          {!selectedArtist ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 14,
                padding: 14,
                marginBottom: 14,
                backgroundColor: isDark ? colors.screen : colors.cardAlt,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.oshiBadgeBgInverted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <AppIcon name="oshi" variant="inactive" size={20} color={colors.oshiBadgeBg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>还没有设置单推</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary }}>
                  从下方搜索并选择一位艺人
                </Text>
              </View>
            </View>
          ) : null}

          <ArtistSearchPicker
            artists={allArtists}
            selectedArtists={selectedArtist ? [selectedArtist] : []}
            selectedIds={selectedArtistId ? [selectedArtistId] : []}
            oshiArtistId={selectedArtistId}
            isDark={isDark}
            typePreference="person"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="搜索艺人设置单推"
            maxHeight={420}
            renderLimit={searchQuery.trim() ? 80 : 40}
            selectedLabel="当前单推"
            parentNameMap={artistNameMap}
            onSelectArtist={(artist) => {
              setSelectedArtistId(artist.id);
              setSearchQuery('');
            }}
            onRemoveArtist={() => setSelectedArtistId(null)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../../src/components/AppIcon';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import { FormCard, FormFieldLabel, FormSectionLabel } from '../../src/components/FormPrimitives';
import { useDB } from '../../src/context/DBContext';
import { Artist, ArtistType } from '../../src/types/models';
import { copyToDocuments } from '../../src/utils/copyToDocuments';
import { ArtistSearchPicker } from '../../src/components/ArtistSearchPicker';
import { getArtistPrimaryName } from '../../src/utils/artistDisplay';
import { fetchWeiboUser, cleanOfficialSuffix } from '../../src/utils/weibo/fetchUser';
import { loadWeiboCookie } from '../../src/utils/weibo/cookieStore';
import { downloadWeiboFile } from '../../src/utils/weibo/downloadFile';
import { showFailureAlert, showSaveFailedAlert } from '../../src/utils/failureAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAppTheme } from '../../src/theme/appTheme';
import { extractArtistBackgroundColor } from '../../src/utils/artistBackdrop';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';
import { ArtistTypeSelector } from '../../src/components/ArtistTypeSelector';
import { formatDateInput, isValidISODate, normalizeDateInput } from '../../src/utils/date';

const MAX_ARTIST_BACKGROUND_BYTES = 5 * 1024 * 1024;
const ARTIST_BACKGROUND_ASPECT_RATIO = 4 / 5;

type DraftMembership = {
  artist: Artist;
  start_date: string | null;
  end_date: string | null;
};

export default function NewArtistScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [artistType, setArtistType] = useState<ArtistType | null>(null);
  const [draftMemberships, setDraftMemberships] = useState<DraftMembership[]>([]);
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [touchedDateFields, setTouchedDateFields] = useState<Set<string>>(() => new Set());
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [backgroundPickedUri, setBackgroundPickedUri] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [url, setUrl] = useState('');
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [saving, setSaving] = useState(false);
  const [weiboLoading, setWeiboLoading] = useState(false);
  const [weiboCookie, setWeiboCookie] = useState('');
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [didTrySave, setDidTrySave] = useState(false);
  const [didTryParseUrl, setDidTryParseUrl] = useState(false);

  useEffect(() => {
    Promise.all([db.artists.findAll(), db.userConfig.getConfig()]).then(([artists, config]) => {
      setAllArtists(artists);
      setOshiArtistId(config.oshi_artist_id);
    });
    loadWeiboCookie().then(setWeiboCookie);
  }, [db]);

  const previewUri = pickedUri ?? (avatarUrl.trim() ? avatarUrl.trim() : null);
  const selectedRelationships = useMemo(
    () => draftMemberships.map((membership) => membership.artist),
    [draftMemberships],
  );
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const typeHint = artistType === 'person'
    ? '可记录所属团体等信息，并自动关联到所属团体的活动。'
    : artistType === 'group'
      ? '可记录所属成员等信息，并将团体活动关联到所属成员。'
      : '设置类型后，可记录所属关系。';
  const nameError = !name.trim() ? '请填写艺人名称' : null;
  const showNameError = (nameTouched || didTrySave) && nameError != null;
  const officialUrlError = didTryParseUrl && !url.trim() ? '请先填写微博用户链接' : null;
  const showOfficialUrlError = officialUrlError != null;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const permanentUri = await copyToDocuments(result.assets[0].uri, {
        filenamePrefix: 'artist_avatar',
      });
      setPickedUri(permanentUri);
      setAvatarUrl('');
    }
  };

  const handleArtistTypeChange = (value: ArtistType | null) => {
    setArtistType(value);
    setDraftMemberships([]);
    setRelationshipSearch('');
    setAdvancedExpanded(false);
    setTouchedDateFields(new Set());
  };

  const toggleRelationship = (artist: Artist) => {
    setDraftMemberships((current) => (
      current.some((membership) => membership.artist.id === artist.id)
        ? current.filter((membership) => membership.artist.id !== artist.id)
        : [...current, { artist, start_date: null, end_date: null }]
    ));
    setTouchedDateFields((current) => {
      const next = new Set(current);
      next.delete(`${artist.id}:start`);
      next.delete(`${artist.id}:end`);
      return next;
    });
  };

  const updateMembershipDate = (artistId: string, field: 'start_date' | 'end_date', value: string) => {
    setDraftMemberships((current) => current.map((membership) => (
      membership.artist.id === artistId ? { ...membership, [field]: value.trim() || null } : membership
    )));
  };

  const handleWeiboUserParse = async () => {
    setDidTryParseUrl(true);
    const trimmed = url.trim();
    if (!trimmed) { return; }
    setWeiboLoading(true);
    try {
      const result = await fetchWeiboUser(trimmed, weiboCookie);
      if (!result.ok) {
        showFailureAlert({
          title: result.kind === 'captcha' ? '需要验证' : '抓取失败',
          reason: result.kind === 'captcha'
            ? '当前登录状态可能已失效。'
            : '艺人信息提取失败。',
          nextStep: result.kind === 'captcha'
            ? '请先前往「我的 → 工具箱 → 登录微博」重新登录，再回来继续解析。'
            : '请先尝试重新登录微博后再试；如果还是失败，可以手动填写艺人信息。',
          details: result.kind === 'captcha' ? undefined : result.message,
        });
        return;
      }
      const cleaned = cleanOfficialSuffix(result.screen_name);
      setName(cleaned);
      setShortName('');
      if (result.avatar_url) {
        const avatarUri = await downloadWeiboFile(result.avatar_url, 'weibo_avatar', weiboCookie);
        if (avatarUri) {
          setPickedUri(avatarUri);
          setAvatarUrl('');
        }
      }
    } finally {
      setWeiboLoading(false);
    }
  };

  const handlePickBackground = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: false,
      allowsEditing: Platform.OS === 'android',
      aspect: [4, 5],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const permanentUri = await copyToDocuments(result.assets[0].uri, {
          filenamePrefix: 'artist_bg',
          cropAspectRatio: ARTIST_BACKGROUND_ASPECT_RATIO,
          maxBytes: MAX_ARTIST_BACKGROUND_BYTES,
        });
        const extractedColor = await extractArtistBackgroundColor(permanentUri);
        setBackgroundPickedUri(permanentUri);
        setBackgroundColor(extractedColor);
      } catch (error) {
        showFailureAlert({
          title: '背景图处理失败',
          reason: '背景图压缩后仍然超过 5MB，或图片文件无法处理。',
          nextStep: '请换一张更小的图片后再试一次。',
          details: error,
        });
      }
    }
  };

  const handleCreate = async () => {
    setDidTrySave(true);
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('请填写艺人名称'); return; }
    const invalidMembershipDate = draftMemberships.find((membership) => (
      (membership.start_date != null && !isValidISODate(membership.start_date))
      || (membership.end_date != null && !isValidISODate(membership.end_date))
    ));
    if (invalidMembershipDate) {
      setAdvancedExpanded(true);
      Alert.alert('日期格式应为 YYYY-MM-DD');
      return;
    }
    setSaving(true);
    try {
      const finalAvatar = pickedUri ?? (avatarUrl.trim() || null);
      const created = await db.artists.create({
        name: trimmed,
        short_name: shortName.trim() || null,
        artist_type: artistType,
        avatar_uri: finalAvatar,
        background_uri: backgroundPickedUri,
        background_color: backgroundPickedUri ? backgroundColor : null,
        url: url.trim() || null,
      });
      if (artistType === 'person' && draftMemberships.length > 0) {
        await db.artists.replaceMembershipsForPerson(
          created.id,
          draftMemberships.map((membership) => ({
            group_artist_id: membership.artist.id,
            start_date: membership.start_date,
            end_date: membership.end_date,
          })),
        );
      } else if (artistType === 'group' && draftMemberships.length > 0) {
        await db.artists.replaceMembershipsForGroup(
          created.id,
          draftMemberships.map((membership) => ({
            person_artist_id: membership.artist.id,
            start_date: membership.start_date,
            end_date: membership.end_date,
          })),
        );
      }
      router.back();
    } catch (e) {
      showSaveFailedAlert(e);
    } finally {
      setSaving(false);
    }
  };

  const bg = colors.screen;
  const inputStyle = {
    backgroundColor: colors.input,
    borderRadius: 12, borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14, height: 46,
    fontSize: 15, color: colors.text,
  };
  const backgroundPreviewWidth = Math.min(screenWidth - 64, 240);

  return (
    <>
      <Stack.Screen
        options={{
          title: '新建艺人',
          headerTitleAlign: 'center',
          headerLeft: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={handleCreate} disabled={saving} style={{ paddingRight: 4, opacity: saving ? 0.4 : 1 }}>
              {saving
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>保存</Text>
              }
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        left={{ label: '取消', onPress: () => router.back(), disabled: saving }}
        right={{
          label: saving ? '保存中' : '保存',
          onPress: handleCreate,
          disabled: saving,
          variant: 'done',
        }}
      />
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: bg }}>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={20}
        >
          <FormSectionLabel label="基础信息" />
          <FormCard>
            <FormFieldLabel required>名称</FormFieldLabel>
            <TextInput
              style={{
                ...inputStyle,
                borderColor: showNameError ? colors.danger : inputStyle.borderColor,
              }}
              placeholder="例：小日向美香"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
              onBlur={() => setNameTouched(true)}
              returnKeyType="next"
            />
            {showNameError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                {nameError}
              </Text>
            ) : null}

            <View style={{ marginTop: 14 }}>
              <FormFieldLabel>简称</FormFieldLabel>
            <TextInput
              style={inputStyle}
              placeholder="例：蜜柑"
              placeholderTextColor={colors.placeholder}
              value={shortName}
              onChangeText={setShortName}
              returnKeyType="next"
            />
            </View>

            <View style={{ width: '100%', alignItems: 'center', marginTop: 16, marginBottom: 16 }}>
              <View style={{ alignSelf: 'stretch' }}>
                <FormFieldLabel>头像</FormFieldLabel>
              </View>
              <TouchableOpacity onPress={handlePickImage} style={{ marginBottom: 12 }}>
                <View style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: isDark ? colors.input : colors.cardAlt,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: colors.inputBorder,
                  overflow: 'hidden'
                }}>
                  {previewUri ? (
                    <Image source={{ uri: previewUri }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                  ) : (
                    <AppIcon name="camera" size={28} color={colors.placeholder} />
                  )}
                </View>
                {!previewUri && (
                  <Text style={{ fontSize: 12, color: colors.accent, marginTop: 6, textAlign: 'center' }}>从相册选择</Text>
                )}
              </TouchableOpacity>
              {pickedUri && (
                <TouchableOpacity onPress={() => setPickedUri(null)} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: isDark ? colors.textMuted : colors.placeholder }}>清除图片</Text>
                </TouchableOpacity>
              )}
              <View style={{ width: '100%' }}>
                <Text style={{ fontSize: 12, color: isDark ? colors.textMuted : colors.placeholder, marginBottom: 6 }}>或使用图片链接</Text>
                <TextInput
                  style={{ ...inputStyle, height: 40 }}
                  placeholder="https://example.com/avatar.jpg"
                  placeholderTextColor={colors.placeholder}
                  value={avatarUrl}
                  onChangeText={(t) => { setAvatarUrl(t); if (t) setPickedUri(null); }}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <FormFieldLabel>官方链接</FormFieldLabel>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={{
                  ...inputStyle,
                  flex: 1,
                  borderColor: showOfficialUrlError ? colors.danger : inputStyle.borderColor,
                }}
                placeholder="例：https://weibo.com/u/xxxx"
                placeholderTextColor={colors.placeholder}
                value={url}
                onChangeText={(value) => {
                  setUrl(value);
                  if (value.trim()) {
                    setDidTryParseUrl(false);
                  }
                }}
                keyboardType="url"
                autoCapitalize="none"
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleWeiboUserParse}
                disabled={weiboLoading}
                style={{
                  backgroundColor: colors.accent, borderRadius: 10,
                  paddingHorizontal: 12, height: 46,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: weiboLoading ? 0.5 : 1,
                }}
              >
                {weiboLoading
                  ? <ActivityIndicator size="small" color={colors.onAccent} />
                  : <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '700' }}>解析</Text>
                }
              </TouchableOpacity>
            </View>
            {showOfficialUrlError ? (
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                {officialUrlError}
              </Text>
            ) : null}
            </View>
          </FormCard>

          <FormSectionLabel label="类型与关系" />
          <FormCard style={artistType != null ? { paddingBottom: 0 } : undefined}>
            <FormFieldLabel>艺人类型</FormFieldLabel>
            <ArtistTypeSelector
              value={artistType}
              onChange={handleArtistTypeChange}
              hint={typeHint}
            />
            {artistType != null ? (
              <>
                <View style={{ marginTop: 16 }}>
                  <FormFieldLabel>{artistType === 'person' ? '所属团体' : '成员'}</FormFieldLabel>
                  <ArtistSearchPicker
                    artists={allArtists.filter((artist) => artist.artist_type === (artistType === 'person' ? 'group' : 'person'))}
                    selectedArtists={selectedRelationships}
                    selectedIds={selectedRelationships.map((artist) => artist.id)}
                    oshiArtistId={oshiArtistId}
                    isDark={isDark}
                    searchValue={relationshipSearch}
                    onSearchChange={setRelationshipSearch}
                    placeholder={artistType === 'person' ? '搜索团体...' : '搜索成员...'}
                    maxHeight={200}
                    parentNameMap={artistNameMap}
                    onSelectArtist={toggleRelationship}
                    onRemoveArtist={toggleRelationship}
                  />
                </View>

                {advancedExpanded ? (
                  <View style={{ marginTop: 16 }}>
                    <FormFieldLabel>{artistType === 'person' ? '所属履历' : '成员履历'}</FormFieldLabel>
                    {draftMemberships.length === 0 ? (
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                        请先在上方选择{artistType === 'person' ? '所属团体' : '成员'}，再编辑在团日期。
                      </Text>
                    ) : (
                      draftMemberships.map((membership, index) => {
                        const startKey = `${membership.artist.id}:start`;
                        const endKey = `${membership.artist.id}:end`;
                        const showStartError = (touchedDateFields.has(startKey) || didTrySave)
                          && membership.start_date != null
                          && !isValidISODate(membership.start_date);
                        const showEndError = (touchedDateFields.has(endKey) || didTrySave)
                          && membership.end_date != null
                          && !isValidISODate(membership.end_date);
                        return (
                          <View key={membership.artist.id} style={{ marginTop: index === 0 ? 0 : 14 }}>
                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
                              {getArtistPrimaryName(membership.artist)}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TextInput
                                style={{
                                  ...inputStyle, flex: 1,
                                  borderColor: showStartError ? colors.danger : inputStyle.borderColor,
                                }}
                                placeholder="入团日期"
                                placeholderTextColor={colors.placeholder}
                                value={membership.start_date ?? ''}
                                onChangeText={(value) => updateMembershipDate(
                                  membership.artist.id,
                                  'start_date',
                                  formatDateInput(value, membership.start_date ?? undefined),
                                )}
                                onBlur={() => {
                                  setTouchedDateFields((current) => new Set(current).add(startKey));
                                  updateMembershipDate(
                                    membership.artist.id,
                                    'start_date',
                                    normalizeDateInput(membership.start_date ?? ''),
                                  );
                                }}
                                keyboardType="numeric"
                                maxLength={10}
                              />
                              <TextInput
                                style={{
                                  ...inputStyle, flex: 1,
                                  borderColor: showEndError ? colors.danger : inputStyle.borderColor,
                                }}
                                placeholder="最后在团日期"
                                placeholderTextColor={colors.placeholder}
                                value={membership.end_date ?? ''}
                                onChangeText={(value) => updateMembershipDate(
                                  membership.artist.id,
                                  'end_date',
                                  formatDateInput(value, membership.end_date ?? undefined),
                                )}
                                onBlur={() => {
                                  setTouchedDateFields((current) => new Set(current).add(endKey));
                                  updateMembershipDate(
                                    membership.artist.id,
                                    'end_date',
                                    normalizeDateInput(membership.end_date ?? ''),
                                  );
                                }}
                                keyboardType="numeric"
                                maxLength={10}
                              />
                            </View>
                            {showStartError || showEndError ? (
                              <Text style={{ marginTop: 6, fontSize: 12, color: colors.danger }}>
                                日期格式应为 YYYY-MM-DD
                              </Text>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : null}

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={advancedExpanded ? '收起高级' : '展开高级'}
                  accessibilityState={{ expanded: advancedExpanded }}
                  activeOpacity={0.7}
                  onPress={() => setAdvancedExpanded((value) => !value)}
                  style={{
                    marginTop: 18,
                    minHeight: 44,
                    borderTopWidth: 1,
                    borderTopColor: colors.divider,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                    {advancedExpanded ? '收起高级' : '高级'}
                  </Text>
                  <AppIcon name="chevron" variant={advancedExpanded ? 'up' : 'down'} size={15} color={colors.accent} />
                </TouchableOpacity>
              </>
            ) : null}
          </FormCard>

          <FormSectionLabel label="背景图" />
          <FormCard>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <TouchableOpacity onPress={handlePickBackground} style={{ width: '100%', marginBottom: 12 }}>
                <View style={{
                  width: backgroundPreviewWidth,
                  aspectRatio: ARTIST_BACKGROUND_ASPECT_RATIO,
                  alignSelf: 'center',
                  borderRadius: 14,
                  backgroundColor: isDark ? colors.input : colors.cardAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: colors.inputBorder,
                  overflow: 'hidden',
                }}>
                  {backgroundPickedUri ? (
                    <Image source={{ uri: backgroundPickedUri }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <AppIcon name="images" size={28} color={colors.placeholder} />
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>从相册选择背景图</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: colors.accent, marginTop: 8, textAlign: 'center' }}>
                  {backgroundPickedUri ? '更换背景图' : '设置背景图'}
                </Text>
              </TouchableOpacity>
              {backgroundPickedUri ? (
                <TouchableOpacity onPress={() => { setBackgroundPickedUri(null); setBackgroundColor(null); }} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: isDark ? colors.textMuted : colors.placeholder }}>清除背景图</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </FormCard>

        </KeyboardAwareScrollView>
      </SafeAreaView>
    </>
  );
}

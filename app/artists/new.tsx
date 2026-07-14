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
import { Artist } from '../../src/types/models';
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
import { withAlpha } from '../../src/utils/color';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../src/utils/safeArea';

const MAX_ARTIST_BACKGROUND_BYTES = 5 * 1024 * 1024;
const ARTIST_BACKGROUND_ASPECT_RATIO = 4 / 5;

export default function NewArtistScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [backgroundPickedUri, setBackgroundPickedUri] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [url, setUrl] = useState('');
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [saving, setSaving] = useState(false);
  const [weiboLoading, setWeiboLoading] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [weiboCookie, setWeiboCookie] = useState('');
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [didTrySave, setDidTrySave] = useState(false);
  const [didTryParseUrl, setDidTryParseUrl] = useState(false);

  const selectedParent = allArtists.find((a) => a.id === parentId) ?? null;
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );

  useEffect(() => {
    Promise.all([db.artists.findAll(), db.userConfig.getConfig()]).then(([artists, config]) => {
      setAllArtists(artists);
      setOshiArtistId(config.oshi_artist_id);
    });
    loadWeiboCookie().then(setWeiboCookie);
  }, [db]);

  const previewUri = pickedUri ?? (avatarUrl.trim() ? avatarUrl.trim() : null);
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
      const permanentUri = await copyToDocuments(result.assets[0].uri);
      setPickedUri(permanentUri);
      setAvatarUrl('');
    }
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
            ? '请先前往「我的 → 设置 → 配置微博抓取功能」重新登录，再回来继续解析。'
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
    setSaving(true);
    try {
      const finalAvatar = pickedUri ?? (avatarUrl.trim() || null);
      await db.artists.create({
        name: trimmed,
        short_name: shortName.trim() || null,
        parent_id: parentId,
        avatar_uri: finalAvatar,
        background_uri: backgroundPickedUri,
        background_color: backgroundPickedUri ? backgroundColor : null,
        url: url.trim() || null,
      });
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
          <FormSectionLabel label="形象" />
          <FormCard style={{ alignItems: 'center' }}>
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

            <View style={{ width: '100%', marginTop: 16, alignItems: 'center' }}>
              <View style={{ alignSelf: 'stretch' }}>
                <FormFieldLabel>背景图</FormFieldLabel>
              </View>
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

          <FormSectionLabel label="基础信息" />
          <FormCard>
            <FormFieldLabel required>艺人名称</FormFieldLabel>
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

          {allArtists.length > 0 && (
            <>
              <FormSectionLabel label="所属关系" />
              <FormCard>
                <FormFieldLabel>所属团体</FormFieldLabel>

              <ArtistSearchPicker
                artists={allArtists}
                selectedArtists={selectedParent ? [selectedParent] : []}
                selectedIds={parentId ? [parentId] : []}
                oshiArtistId={oshiArtistId}
                isDark={isDark}
                searchValue={parentSearch}
                onSearchChange={setParentSearch}
                placeholder="搜索团体 / 组合..."
                maxHeight={200}
                parentNameMap={artistNameMap}
                onSelectArtist={(artist) => {
                  setParentId(artist.id);
                  setParentSearch('');
                }}
                onRemoveArtist={() => setParentId(null)}
              />
              </FormCard>
            </>
          )}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </>
  );
}

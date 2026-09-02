import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AppIcon } from '../../../src/components/AppIcon';
import { NativeTextToolbar } from '../../../src/components/native-text-toolbar';
import { useDB } from '../../../src/context/DBContext';
import { Artist, ArtistGroupMembershipWithArtist, ArtistType } from '../../../src/types/models';
import { resolveAvatarSource } from '../../../src/utils/avatarSource';
import { copyToDocuments } from '../../../src/utils/copyToDocuments';
import { ArtistSearchPicker } from '../../../src/components/ArtistSearchPicker';
import { FormCard, FormFieldLabel, FormSectionLabel } from '../../../src/components/FormPrimitives';
import { getArtistPrimaryName } from '../../../src/utils/artistDisplay';
import { fetchWeiboUser, cleanOfficialSuffix } from '../../../src/utils/weibo/fetchUser';
import { loadWeiboCookie } from '../../../src/utils/weibo/cookieStore';
import { downloadWeiboFile } from '../../../src/utils/weibo/downloadFile';
import { showDeleteFailedAlert, showFailureAlert, showSaveFailedAlert } from '../../../src/utils/failureAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAppTheme } from '../../../src/theme/appTheme';
import { extractArtistBackgroundColor } from '../../../src/utils/artistBackdrop';
import { withAlpha } from '../../../src/utils/color';
import { SCROLL_SCREEN_SAFE_AREA_EDGES } from '../../../src/utils/safeArea';
import { ArtistTypeSelector } from '../../../src/components/ArtistTypeSelector';
import { AspectCropModal } from '../../../src/components/AspectCropModal';
import { formatDateInput, isValidISODate, normalizeDateInput, toISODate } from '../../../src/utils/date';
import { generateId } from '../../../src/utils/uuid';

const ARTIST_BACKGROUND_MAX_DIMENSION = 2000;
const ARTIST_BACKGROUND_ASPECT_RATIO = 4 / 5;

type EditableArtistMembership = ArtistGroupMembershipWithArtist & {
  isDraft?: boolean;
};

export default function EditArtistScreen() {
  const db = useDB();
  const { colors, isDark } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [artistType, setArtistType] = useState<ArtistType | null>(null);
  const [originalArtistType, setOriginalArtistType] = useState<ArtistType | null>(null);
  const [memberships, setMemberships] = useState<EditableArtistMembership[]>([]);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [touchedDateFields, setTouchedDateFields] = useState<Set<string>>(() => new Set());
  const [typedSearch, setTypedSearch] = useState('');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [backgroundPickedUri, setBackgroundPickedUri] = useState<string | null>(null);
  const [backgroundCropSource, setBackgroundCropSource] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [presetAvatar, setPresetAvatar] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [parentSearch, setParentSearch] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberMode, setMemberMode] = useState(false);
  const [oshiArtistId, setOshiArtistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weiboLoading, setWeiboLoading] = useState(false);
  const [weiboCookie, setWeiboCookie] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [didTrySave, setDidTrySave] = useState(false);
  const [didTryParseUrl, setDidTryParseUrl] = useState(false);

  const selectedParent = useMemo(
    () => allArtists.find((a) => a.id === parentId) ?? null,
    [allArtists, parentId],
  );
  const selectedMembers = useMemo(
    () => allArtists.filter((artist) => memberIds.includes(artist.id)),
    [allArtists, memberIds],
  );
  const artistNameMap = useMemo(
    () => Object.fromEntries(allArtists.map((artist) => [artist.id, getArtistPrimaryName(artist)])),
    [allArtists],
  );
  const selectedRelationshipArtists = useMemo(() => {
    const seen = new Set<string>();
    const result: Artist[] = [];
    for (const membership of memberships) {
      if (!seen.has(membership.artist.id)) {
        seen.add(membership.artist.id);
        result.push(membership.artist);
      }
    }
    return result;
  }, [memberships]);
  const hasExistingRelations = artistType != null
    ? memberships.some((membership) => !membership.isDraft)
    : parentId != null || memberIds.length > 0;
  const memberCandidateArtists = useMemo(() => {
    if (!memberMode) return allArtists;

    const artistMap = new Map(allArtists.map((artist) => [artist.id, artist]));
    const ancestorIds = new Set<string>();
    let cursor = parentId;
    while (cursor && !ancestorIds.has(cursor)) {
      ancestorIds.add(cursor);
      cursor = artistMap.get(cursor)?.parent_id ?? null;
    }

    return allArtists.filter((artist) => !ancestorIds.has(artist.id));
  }, [allArtists, memberMode, parentId]);

  useEffect(() => {
    const load = async () => {
      const [artist, all, config] = await Promise.all([
        db.artists.findById(id),
        db.artists.findAll(),
        db.userConfig.getConfig(),
      ]);
      if (!artist) { router.back(); return; }
      setName(artist.name);
      setShortName(artist.short_name ?? '');
      setArtistType(artist.artist_type);
      setOriginalArtistType(artist.artist_type);
      setParentId(artist.parent_id);
      setUrl(artist.url ?? '');
      if (artist.avatar_uri) {
        if (artist.avatar_uri.startsWith('http')) {
          setAvatarUrl(artist.avatar_uri);
        } else if (artist.avatar_uri.startsWith('preset://')) {
          setPresetAvatar(artist.avatar_uri);
        } else {
          setPickedUri(artist.avatar_uri);
        }
      }
      setBackgroundPickedUri(artist.background_uri ?? null);
      setBackgroundColor(artist.background_color ?? null);
      const members = all.filter((candidate) => candidate.parent_id === id);
      setMemberIds(members.map((member) => member.id));
      setMemberMode(members.length > 0);
      // Exclude self from parent options
      setAllArtists(all.filter((a) => a.id !== id));
      setOshiArtistId(config.oshi_artist_id);
      if (artist.artist_type === 'person') {
        const loadedMemberships = await db.artists.findMembershipsForPerson(id);
        setMemberships(loadedMemberships);
        setAdvancedExpanded(loadedMemberships.length > 0);
      } else if (artist.artist_type === 'group') {
        const loadedMemberships = await db.artists.findMembershipsForGroup(id);
        setMemberships(loadedMemberships);
        setAdvancedExpanded(loadedMemberships.length > 0);
      }
      setLoading(false);
    };
    load();
    loadWeiboCookie().then(setWeiboCookie);
  }, [db, id]);

  // Priority: user-picked local file > pasted URL > preset bundled avatar
  const previewSource =
    pickedUri ? { uri: pickedUri }
      : avatarUrl.trim() ? { uri: avatarUrl.trim() }
        : resolveAvatarSource(presetAvatar);
  const typeHint = artistType === 'person'
    ? '可记录所属团体等信息，并自动关联到所属团体的活动。'
    : artistType === 'group'
      ? '可记录所属成员等信息，并将团体活动关联到所属成员。'
      : (memberMode || selectedParent != null)
        ? '该艺人已有旧版普通所属，可在此维护，或前往「设置 → 数据与备份 → 艺人类型转换」整组转换。'
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
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    // iOS 的系统裁切框固定为正方形，与 4:5 背景比例不符，
    // 因此选图后进入应用内裁切界面手动调整。
    if (Platform.OS === 'ios') {
      setBackgroundCropSource({ uri: asset.uri, width: asset.width, height: asset.height });
      return;
    }

    try {
      const permanentUri = await copyToDocuments(asset.uri, {
        filenamePrefix: 'artist_bg',
        cropAspectRatio: ARTIST_BACKGROUND_ASPECT_RATIO,
        maxDimension: ARTIST_BACKGROUND_MAX_DIMENSION,
        forceJpeg: true,
      });
      const extractedColor = await extractArtistBackgroundColor(permanentUri);
      setBackgroundPickedUri(permanentUri);
      setBackgroundColor(extractedColor);
    } catch (error) {
      showFailureAlert({
        title: '背景图处理失败',
        reason: '图片文件无法处理，请换一张图片后再试一次。',
        nextStep: '如果问题持续出现，请更换图片来源。',
        details: error,
      });
    }
  };

  const handleBackgroundCropConfirmed = async (croppedUri: string) => {
    try {
      const permanentUri = await copyToDocuments(croppedUri, {
        filenamePrefix: 'artist_bg',
        cropAspectRatio: ARTIST_BACKGROUND_ASPECT_RATIO,
        maxDimension: ARTIST_BACKGROUND_MAX_DIMENSION,
        forceJpeg: true,
      });
      const extractedColor = await extractArtistBackgroundColor(permanentUri);
      setBackgroundPickedUri(permanentUri);
      setBackgroundColor(extractedColor);
    } catch (error) {
      showFailureAlert({
        title: '背景图处理失败',
        reason: '图片文件无法处理，请换一张图片后再试一次。',
        nextStep: '如果问题持续出现，请更换图片来源。',
        details: error,
      });
    } finally {
      setBackgroundCropSource(null);
    }
  };

  const handleSave = async () => {
    setDidTrySave(true);
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('请填写艺人名称'); return; }
    const invalidMembershipDate = memberships.find((membership) => (
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
      const finalAvatar = pickedUri ?? (avatarUrl.trim() || presetAvatar || null);
      await db.artists.update(id, {
        name: trimmed,
        short_name: shortName.trim() || null,
        artist_type: artistType,
        parent_id: artistType == null ? parentId : null,
        avatar_uri: finalAvatar,
        background_uri: backgroundPickedUri,
        background_color: backgroundPickedUri ? backgroundColor : null,
        url: url.trim() || null,
      });
      if (artistType == null && memberMode) {
        await db.artists.setMembers(id, memberIds);
      } else if (artistType === 'person') {
        await db.artists.replaceMembershipsForPerson(id, memberships.map((membership) => ({
          id: membership.isDraft ? undefined : membership.id,
          group_artist_id: membership.group_artist_id,
          start_date: membership.start_date,
          end_date: membership.end_date,
        })));
      } else if (artistType === 'group') {
        await db.artists.replaceMembershipsForGroup(id, memberships.map((membership) => ({
          id: membership.isDraft ? undefined : membership.id,
          person_artist_id: membership.person_artist_id,
          start_date: membership.start_date,
          end_date: membership.end_date,
        })));
      }
      router.back();
    } catch (e) {
      showSaveFailedAlert(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('删除艺人', '确认删除？关联的活动记录和照片不会被删除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await db.artists.delete(id);
            router.back();
          } catch (e) {
            showDeleteFailedAlert(e);
          }
        },
      },
    ]);
  };

  const toggleMember = (artist: Artist) => {
    setMemberIds((current) => (
      current.includes(artist.id)
        ? current.filter((memberId) => memberId !== artist.id)
        : [...current, artist.id]
    ));
  };

  const toggleTypedRelationship = (artist: Artist) => {
    const today = toISODate(new Date());
    const activeIndex = memberships.findIndex((membership) => (
      membership.artist.id === artist.id
      && (membership.start_date == null || membership.start_date <= today)
      && (membership.end_date == null || membership.end_date >= today)
    ));
    if (activeIndex >= 0) {
      Alert.alert('结束成员关系', `将最后在团日期设为 ${today}，并保留历史履历。`, [
        { text: '取消', style: 'cancel' },
        {
          text: '结束关系',
          onPress: () => setMemberships((current) => current.map((membership, index) => (
            index === activeIndex ? { ...membership, end_date: today } : membership
          ))),
        },
      ]);
      return;
    }
    if (memberships.some((membership) => membership.artist.id === artist.id)) {
      const addDraft = () => {
        const now = new Date().toISOString();
        setMemberships((current) => [...current, {
          id: generateId(),
          isDraft: true,
          person_artist_id: artistType === 'person' ? id : artist.id,
          group_artist_id: artistType === 'group' ? id : artist.id,
          start_date: null,
          end_date: null,
          created_at: now,
          updated_at: now,
          artist,
        }]);
      };
      Alert.alert('管理这条关系', '该艺人只有已结束的历史关系。', [
        { text: '取消', style: 'cancel' },
        { text: '重新加入', onPress: addDraft },
        {
          text: '删除该艺人的关系',
          style: 'destructive',
          onPress: () => setMemberships((current) => (
            current.filter((membership) => membership.artist.id !== artist.id)
          )),
        },
      ]);
      return;
    }
    const now = new Date().toISOString();
    setMemberships((current) => [...current, {
      id: generateId(),
      isDraft: true,
      person_artist_id: artistType === 'person' ? id : artist.id,
      group_artist_id: artistType === 'group' ? id : artist.id,
      start_date: null,
      end_date: null,
      created_at: now,
      updated_at: now,
      artist,
    }]);
  };

  const handleArtistTypeChange = (value: ArtistType | null) => {
    if (value === artistType) return;
    if (value !== originalArtistType && hasExistingRelations) {
      Alert.alert(
        '暂时无法更改类型',
        originalArtistType == null
          ? '这条记录已有普通所属关系。请前往“设置 → 数据与备份 → 艺人类型转换”，与关联记录一起转换。'
          : '这条记录已有正式所属履历。请先移除全部履历后再更改类型。',
      );
      return;
    }
    setArtistType(value);
    if (value != null) {
      setParentId(null);
      setMemberMode(false);
      setMemberIds([]);
    }
    setMemberships([]);
    setTouchedDateFields(new Set());
    setAdvancedExpanded(false);
  };

  const updateMembershipDate = (membershipId: string, field: 'start_date' | 'end_date', value: string) => {
    setMemberships((current) => current.map((membership) => (
      membership.id === membershipId ? { ...membership, [field]: value.trim() || null } : membership
    )));
  };

  const handleRemoveMembership = (membership: EditableArtistMembership) => {
    const today = toISODate(new Date());
    const isActive = (membership.start_date == null || membership.start_date <= today)
      && (membership.end_date == null || membership.end_date >= today);
    const deleteMembership = () => setMemberships((current) => (
      current.filter((item) => item.id !== membership.id)
    ));
    Alert.alert(
      '管理这条关系',
      isActive
        ? '结束再团关系会把最后在团日期设为今天并保留历史履历；直接删除会彻底移除这条关系。'
        : '这条关系已结束。直接删除会彻底移除它，不会删除关联的活动记录。',
      isActive
        ? [
            {
              text: '结束再团关系',
              onPress: () => setMemberships((current) => current.map((item) => (
                item.id === membership.id ? { ...item, end_date: today } : item
              ))),
            },
            { text: '直接删除关系', style: 'destructive', onPress: deleteMembership },
            { text: '取消', style: 'cancel' },
          ]
        : [
            { text: '直接删除关系', style: 'destructive', onPress: deleteMembership },
            { text: '取消', style: 'cancel' },
          ],
    );
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

  if (loading) {
    return (
      <SafeAreaView edges={SCROLL_SCREEN_SAFE_AREA_EDGES} style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '编辑艺人',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.header },
          headerShadowVisible: false,
          headerTitleStyle: { color: colors.heading, fontWeight: '700' },
          headerLeft: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ paddingRight: 4, opacity: saving ? 0.4 : 1 }}>
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
          onPress: handleSave,
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
          // extraHeight={140}          // 给输入框下方留出足够的上推安全空间
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
              placeholder="例：米津玄師"
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
                placeholder="例：米津"
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
                  {previewSource ? (
                    <Image source={previewSource} style={{ width: 80, height: 80, borderRadius: 40 }} />
                  ) : (
                    <AppIcon name="camera" size={28} color={colors.placeholder} />
                  )}
                </View>
                <Text style={{ fontSize: 12, color: colors.accent, marginTop: 6, textAlign: 'center' }}>
                  {previewSource ? '更换图片' : '从相册选择'}
                </Text>
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
                  placeholder="例：https://weibo.com/u/1234567890"
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
            {artistType == null && (memberMode || selectedParent != null) ? (
              <View style={{ marginTop: 16 }}>
                <FormFieldLabel>{memberMode ? '成员' : '所属'}</FormFieldLabel>
                <ArtistSearchPicker
                  artists={(memberMode ? memberCandidateArtists : allArtists).filter((artist) => artist.artist_type == null)}
                  selectedArtists={memberMode ? selectedMembers : (selectedParent ? [selectedParent] : [])}
                  selectedIds={memberMode ? memberIds : (parentId ? [parentId] : [])}
                  oshiArtistId={oshiArtistId}
                  isDark={isDark}
                  searchValue={memberMode ? memberSearch : parentSearch}
                  onSearchChange={memberMode ? setMemberSearch : setParentSearch}
                  placeholder={memberMode ? '搜索并选择成员...' : '搜索所属...'}
                  maxHeight={200}
                  parentNameMap={artistNameMap}
                  selectedLabel={memberMode ? '已选成员' : undefined}
                  selectedOverflowLabel={memberMode ? ((_, total) => `展开全部 ${total} 位成员`) : undefined}
                  onSelectArtist={memberMode ? toggleMember : ((artist) => {
                    setParentId(artist.id);
                    setParentSearch('');
                  })}
                  onRemoveArtist={memberMode ? toggleMember : (() => setParentId(null))}
                />
              </View>
            ) : artistType != null ? (
              <>
                <View style={{ marginTop: 16 }}>
                  <FormFieldLabel>{artistType === 'person' ? '所属团体' : '成员'}</FormFieldLabel>
                  <ArtistSearchPicker
                    artists={allArtists.filter((artist) => artist.artist_type === (artistType === 'person' ? 'group' : 'person'))}
                    selectedArtists={selectedRelationshipArtists}
                    selectedIds={selectedRelationshipArtists.map((artist) => artist.id)}
                    oshiArtistId={oshiArtistId}
                    isDark={isDark}
                    searchValue={typedSearch}
                    onSearchChange={setTypedSearch}
                    placeholder={artistType === 'person' ? '搜索团体...' : '搜索成员...'}
                    maxHeight={200}
                    parentNameMap={artistNameMap}
                    onSelectArtist={toggleTypedRelationship}
                    onRemoveArtist={toggleTypedRelationship}
                  />
                </View>

                {advancedExpanded ? (
                  <View style={{ marginTop: 16 }}>
                    <FormFieldLabel>{artistType === 'person' ? '所属履历' : '成员履历'}</FormFieldLabel>
                    {memberships.length === 0 ? (
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                        请先在上方选择{artistType === 'person' ? '所属团体' : '成员'}，再编辑在团日期。
                      </Text>
                    ) : (
                      memberships.map((membership, index) => {
                        const startKey = `${membership.id}:start`;
                        const endKey = `${membership.id}:end`;
                        const showStartError = (touchedDateFields.has(startKey) || didTrySave)
                          && membership.start_date != null
                          && !isValidISODate(membership.start_date);
                        const showEndError = (touchedDateFields.has(endKey) || didTrySave)
                          && membership.end_date != null
                          && !isValidISODate(membership.end_date);
                        return (
                          <View key={membership.id} style={{ marginTop: index === 0 ? 0 : 14 }}>
                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
                              {getArtistPrimaryName(membership.artist)}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                              <TextInput
                                style={{
                                  ...inputStyle, flex: 1,
                                  borderColor: showStartError ? colors.danger : inputStyle.borderColor,
                                }}
                                placeholder="入团日期"
                                placeholderTextColor={colors.placeholder}
                                value={membership.start_date ?? ''}
                                onChangeText={(value) => updateMembershipDate(
                                  membership.id,
                                  'start_date',
                                  formatDateInput(value, membership.start_date ?? undefined),
                                )}
                                onBlur={() => {
                                  setTouchedDateFields((current) => new Set(current).add(startKey));
                                  updateMembershipDate(
                                    membership.id,
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
                                  membership.id,
                                  'end_date',
                                  formatDateInput(value, membership.end_date ?? undefined),
                                )}
                                onBlur={() => {
                                  setTouchedDateFields((current) => new Set(current).add(endKey));
                                  updateMembershipDate(
                                    membership.id,
                                    'end_date',
                                    normalizeDateInput(membership.end_date ?? ''),
                                  );
                                }}
                                keyboardType="numeric"
                                maxLength={10}
                              />
                              <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={`删除${getArtistPrimaryName(membership.artist)}的关系`}
                                onPress={() => handleRemoveMembership(membership)}
                                style={{ width: 44, height: 46, alignItems: 'center', justifyContent: 'center' }}
                              >
                                <AppIcon name="trash" size={18} color={colors.danger} />
                              </TouchableOpacity>
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

          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 14, borderRadius: 14,
              backgroundColor: isDark ? colors.dangerSoft : withAlpha(colors.danger, 0.08),
              borderWidth: 1, borderColor: isDark ? colors.dangerBorder : withAlpha(colors.danger, 0.18),
              marginBottom: 8,
            }}
          >
            <AppIcon name="trash" size={16} color={colors.danger} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.danger }}>删除艺人</Text>
          </TouchableOpacity>

        </KeyboardAwareScrollView>
      </SafeAreaView>
      <AspectCropModal
        visible={backgroundCropSource != null}
        sourceUri={backgroundCropSource?.uri ?? ''}
        sourceWidth={backgroundCropSource?.width ?? 0}
        sourceHeight={backgroundCropSource?.height ?? 0}
        title="调整背景图"
        onCancel={() => setBackgroundCropSource(null)}
        onConfirm={handleBackgroundCropConfirmed}
      />
    </>
  );
}

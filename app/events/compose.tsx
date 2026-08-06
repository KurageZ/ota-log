import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, useWindowDimensions,
  InteractionManager,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Clipboard from '@react-native-clipboard/clipboard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppIcon } from '../../src/components/AppIcon';
import type { EventFormPrefill } from '../../src/components/EventForm';
import { useDB } from '../../src/context/DBContext';
import {
  parseAnnouncement,
  type ParsedAnnouncement,
} from '../../src/utils/parseAnnouncement';
import { splitArtistHandle } from '../../src/utils/artistName';
import { Artist } from '../../src/types/models';
import { fetchWeiboPost, WEIBO_URL_RE } from '../../src/utils/weibo/fetchPost';
import { loadWeiboCookie } from '../../src/utils/weibo/cookieStore';
import { downloadWeiboFile } from '../../src/utils/weibo/downloadFile';
import type { ArtistCandidate } from '../../src/utils/artistMatching';
import { setEventDraft } from '../../src/utils/eventDraftStore';
import { showFailureAlert } from '../../src/utils/failureAlert';
import { buildParsedEventDraft } from '../../src/utils/parsedEventDraft';
import { useAppTheme } from '../../src/theme/appTheme';
import { withAlpha } from '../../src/utils/color';
import {
  fetchImportedEvent,
  IEVENT_URL_RE,
} from '../../src/utils/ievent/importEvent';
import { prepareImportedEventDraft } from '../../src/utils/importedEventDraft';
import type { ParsedEventDraftResult } from '../../src/utils/parsedEventDraft';

// ── ParseModal ────────────────────────────────────────────────────────────────
// Owns its own text state so typing never re-renders the parent screen
// (which would dismiss the keyboard on iOS pageSheet).

interface ParseModalProps {
  visible: boolean;
  isDark: boolean;
  loading: boolean;
  onClose: () => void;
  onManual: () => void;
  onSubmit: (text: string) => Promise<void>;
}

function ParseModal({ visible, isDark, loading, onClose, onManual, onSubmit }: ParseModalProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [textValue, setTextValue] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const overlayOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(28);
  const sheetOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      setTextValue('');
      setUrlValue('');
      overlayOpacity.value = 0;
      sheetTranslateY.value = 28;
      sheetOpacity.value = 0;
      return;
    }

    overlayOpacity.value = 0;
    sheetTranslateY.value = 28;
    sheetOpacity.value = 0;
    overlayOpacity.value = withTiming(1, { duration: 180 });
    sheetTranslateY.value = withTiming(0, { duration: 240 });
    sheetOpacity.value = withTiming(1, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const handleSubmit = () => {
    const url = urlValue.trim();
    const text = textValue.trim();
    onSubmit(url || text);
  };

  const hasInput = urlValue.trim().length > 0 || textValue.trim().length > 0;

  const handlePasteAndSubmit = async () => {
    const clipboardText = (await Clipboard.getString()).trim();
    if (!clipboardText) {
      Alert.alert('剪贴板为空', '请先复制公告链接或公告文本。');
      return;
    }

    if (WEIBO_URL_RE.test(clipboardText) || IEVENT_URL_RE.test(clipboardText)) {
      setUrlValue(clipboardText);
      setTextValue('');
    } else {
      setTextValue(clipboardText);
      setUrlValue('');
    }

    await onSubmit(clipboardText);
  };

  const cardBg = colors.card;
  const sheetMaxHeight = Math.min(screenHeight - insets.top - 24, 680);
  const actionBottomPadding = Math.max(insets.bottom - 28, 4);
  const labelStyle = {
    fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: isDark ? colors.textMuted : colors.placeholder, marginBottom: 8,
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 20,
          backgroundColor: isDark ? withAlpha(colors.screen, 0.72) : withAlpha(colors.heading, 0.26),
        },
        overlayAnimatedStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[
            {
              maxHeight: sheetMaxHeight,
              backgroundColor: colors.screen,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomRightRadius: 24,
              borderBottomLeftRadius: 24,
              overflow: 'hidden',
            },
            sheetAnimatedStyle,
          ]}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
            paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1,
            borderBottomColor: colors.inputBorder,
          }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: colors.heading }}>
              解析公告
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>取消</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            style={{ maxHeight: sheetMaxHeight - 64 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraHeight={140}
            extraScrollHeight={20}
          >
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={labelStyle}>公告链接</Text>
                <TextInput
                  value={urlValue}
                  style={{
                    fontSize: 14, color: colors.text,
                    height: 44, borderRadius: 10,
                    backgroundColor: isDark ? colors.screen : colors.cardAlt,
                    paddingHorizontal: 12,
                  }}
                  placeholder="https://..."
                  placeholderTextColor={colors.placeholder}
                  onChangeText={setUrlValue}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.inputBorder }} />
                <Text style={{ marginHorizontal: 12, fontSize: 12, color: colors.placeholder }}>或</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.inputBorder }} />
              </View>

              <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={labelStyle}>公告文本</Text>
                <TextInput
                  value={textValue}
                  style={{
                    fontSize: 14, color: colors.text,
                    minHeight: 88, textAlignVertical: 'top', lineHeight: 22,
                  }}
                  placeholder="粘贴演出公告文本，自动识别演出信息。"
                  placeholderTextColor={colors.placeholder}
                  onChangeText={setTextValue}
                  multiline
                />
              </View>

              <View style={{
                flexDirection: 'row', gap: 10, alignItems: 'flex-start',
                backgroundColor: isDark ? withAlpha(colors.accent, 0.14) : withAlpha(colors.accent, 0.08),
                borderRadius: 14, padding: 12,
              }}>
                <AppIcon name="sparkles" size={18} color={colors.accent} />
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: isDark ? colors.accentBorder : colors.accentText }}>
                  解析失败或识别不准时，可以手动修改标题、日期、场地等信息。
                </Text>
              </View>
            </View>

            <View style={{
              paddingHorizontal: 16,
              paddingTop: 0,
              paddingBottom: actionBottomPadding,
              borderTopWidth: 1,
              borderTopColor: colors.inputBorder,
              backgroundColor: colors.screen,
            }}>
              <TouchableOpacity
                onPress={hasInput ? handleSubmit : () => { void handlePasteAndSubmit(); }}
                disabled={loading}
                style={{
                  backgroundColor: colors.accent, borderRadius: 14,
                  paddingVertical: 14, alignItems: 'center',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading
                  ? <ActivityIndicator color={colors.onAccent} />
                  : (
                    <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>
                      {hasInput ? '解析并创建草稿' : '粘贴并识别'}
                    </Text>
                  )
                }
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onManual}
                disabled={loading}
                style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 16, opacity: loading ? 0.5 : 1 }}
              >
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>
                  不使用解析，手动输入
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ── NewArtistConfirmModal ─────────────────────────────────────────────────────

interface ConfirmModalProps {
  visible: boolean;
  interactive: boolean;
  isDark: boolean;
  initialCandidates: ArtistCandidate[];
  onConfirm: (candidates: ArtistCandidate[]) => void;
}

function NewArtistConfirmModal({
  visible,
  interactive,
  isDark,
  initialCandidates,
  onConfirm,
}: ConfirmModalProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [candidates, setCandidates] = useState<ArtistCandidate[]>([]);

  useEffect(() => {
    if (visible) setCandidates(initialCandidates.map((c) => ({ ...c })));
  }, [visible, initialCandidates]);

  const setResolution = (i: number, resolution: ArtistCandidate['resolution']) =>
    setCandidates((prev) => prev.map((c, idx) => idx === i ? { ...c, resolution } : c));

  const rename = (i: number, text: string) =>
    setCandidates((prev) => prev.map((c, idx) => idx === i ? { ...c, editName: text } : c));

  const selectedCount = candidates.filter((c) => c.resolution !== 'skip').length;
  const cardBg = colors.card;
  const sheetMaxHeight = Math.min(screenHeight - insets.top - 24, 720);
  const actionBottomPadding = Math.max(insets.bottom - 28, 4);

  if (!visible) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 30,
      backgroundColor: isDark ? withAlpha(colors.screen, 0.82) : withAlpha(colors.heading, 0.26),
    }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {}}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={{
          maxHeight: sheetMaxHeight,
          backgroundColor: colors.screen,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          borderBottomLeftRadius: 24,
          overflow: 'hidden',
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
            paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1,
            borderBottomColor: colors.inputBorder,
          }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: colors.heading }}>
              确认出演者
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: actionBottomPadding }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 }}>
              以下艺人未能精准匹配，请手动选择或新建。
            </Text>

            <View style={{
              backgroundColor: cardBg, borderRadius: 16, overflow: 'hidden', marginBottom: 20,
              borderWidth: 1, borderColor: colors.inputBorder,
            }}>
              {candidates.map((c, i) => (
                <View
                  key={i}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 12,
                    borderBottomWidth: i < candidates.length - 1 ? 1 : 0,
                    borderBottomColor: isDark ? withAlpha(colors.accent, 0.22) : colors.cardAlt,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      disabled={!interactive}
                      onPress={() => setResolution(i, c.resolution === 'skip' ? 'create' : 'skip')}
                      style={{ marginRight: 12 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <AppIcon
                        name="checkbox"
                        variant={c.resolution !== 'skip' ? 'selected' : 'unselected'}
                        size={22}
                        color={c.resolution !== 'skip' ? colors.accent : colors.chevron}
                      />
                    </TouchableOpacity>
                    <TextInput
                      style={{
                        flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 2,
                        color: c.resolution !== 'skip'
                          ? colors.text
                          : colors.placeholder,
                      }}
                      value={c.editName}
                      onChangeText={(t) => rename(i, t)}
                      editable={interactive && c.resolution === 'create'}
                      returnKeyType="done"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  {c.suggestions.length > 0 ? (
                    <View style={{ marginTop: 10, marginLeft: 34, gap: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        可能匹配到以下已有艺人，请选择：
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {c.suggestions.map((suggestion) => {
                          const selected = c.resolution === suggestion.artistId;
                          return (
                            <TouchableOpacity
                              key={suggestion.artistId}
                              disabled={!interactive}
                              onPress={() => setResolution(i, suggestion.artistId)}
                              style={{
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: selected ? colors.accent : colors.chevron,
                                backgroundColor: selected
                                  ? (isDark ? withAlpha(colors.accent, 0.2) : withAlpha(colors.accent, 0.08))
                                  : 'transparent',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                              }}
                            >
                              <Text style={{
                                fontSize: 12,
                                fontWeight: selected ? '700' : '500',
                                color: selected ? colors.accent : isDark ? colors.textSecondary : colors.placeholder,
                              }}>
                                {suggestion.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <View style={{
                        borderTopWidth: 1,
                        borderTopColor: isDark ? withAlpha(colors.accent, 0.18) : colors.cardAlt,
                        paddingTop: 10,
                        alignItems: 'flex-start',
                      }}>
                        <TouchableOpacity
                          disabled={!interactive}
                          onPress={() => setResolution(i, 'create')}
                          style={{
                            paddingVertical: 2,
                            opacity: interactive ? 1 : 0.6,
                          }}
                        >
                          <Text style={{
                            fontSize: 12,
                            fontWeight: c.resolution === 'create' ? '700' : '500',
                            color: c.resolution === 'create'
                              ? colors.accent
                              : colors.textSecondary,
                          }}>
                            都不是，作为新艺人创建
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            <TouchableOpacity
              disabled={!interactive}
              onPress={() => onConfirm(candidates)}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                opacity: interactive ? 1 : 0.6,
              }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>
                {selectedCount > 0 ? `确认 ${selectedCount} 位出演者` : '忽略这些艺人'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── NewEventScreen ────────────────────────────────────────────────────────────

export default function NewEventScreen() {
  const db = useDB();
  const { isDark } = useAppTheme();
  const [parseLoading, setParseLoading] = useState(false);
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>([]);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [weiboCookie, setWeiboCookie] = useState<string>('');

  // State for the artist confirmation flow
  const [artistCandidates, setArtistCandidates] = useState<ArtistCandidate[]>([]);
  const [artistConfirmVisible, setArtistConfirmVisible] = useState(false);
  const [artistConfirmInteractive, setArtistConfirmInteractive] = useState(false);
  const [pendingMatchedIds, setPendingMatchedIds] = useState<string[]>([]);
  const [pendingFields, setPendingFields] = useState<EventFormPrefill | null>(null);
  const confirmVisibilityTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const confirmInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    db.artists.findAll().then(setAllArtists);
    loadWeiboCookie().then(setWeiboCookie);
  }, [db]);

  useEffect(() => () => {
    confirmVisibilityTaskRef.current?.cancel();
    if (confirmInteractionTimerRef.current) {
      clearTimeout(confirmInteractionTimerRef.current);
    }
  }, []);

  const openCreateForm = (
    prefill: EventFormPrefill | null,
    showPrefillNotice: boolean,
    photoUris: string[] = pendingPhotoUris,
  ) => {
    setEventDraft({ prefill, photoUris, showPrefillNotice });
    router.replace('/events/create');
  };

  const enterManualForm = () => {
    openCreateForm(null, false, []);
  };

  const closeParseModal = () => {
    router.back();
  };

  const applyParsedResult = (
    announcementText: string,
    parsed: ParsedAnnouncement,
    extraFields: EventFormPrefill = {},
    photoUris: string[] = pendingPhotoUris,
  ) => {
    const hasUsefulFields = Boolean(
      parsed.title ||
      parsed.event_date ||
      parsed.event_time ||
      parsed.city ||
      parsed.venue ||
      parsed.artist_mentions.length > 0
    );

    if (!hasUsefulFields && Object.keys(extraFields).length === 0) {
      showFailureAlert({
        title: '没有解析出足够信息',
        reason: '没有识别到标题、日期、场地或出演者。',
        nextStep: '你可以调整公告文本后重试，也可以直接手动创建。',
        buttons: [
          { text: '继续修改', style: 'cancel' },
          { text: '手动创建', onPress: enterManualForm },
        ],
      });
      return;
    }

    applyDraftResult(
      buildParsedEventDraft(announcementText, parsed, allArtists, extraFields),
      photoUris,
    );
  };

  const applyDraftResult = (
    draft: ParsedEventDraftResult,
    photoUris: string[] = pendingPhotoUris,
  ) => {
    const { matchedIds, candidates, fields, shouldConfirmArtists } = draft;
    if (shouldConfirmArtists) {
      setPendingMatchedIds(matchedIds);
      setPendingFields(fields);
      setArtistCandidates(candidates);
      setArtistConfirmInteractive(false);
      confirmVisibilityTaskRef.current?.cancel();
      if (confirmInteractionTimerRef.current) {
        clearTimeout(confirmInteractionTimerRef.current);
        confirmInteractionTimerRef.current = null;
      }
      confirmVisibilityTaskRef.current = InteractionManager.runAfterInteractions(() => {
        confirmVisibilityTaskRef.current = null;
        setArtistConfirmVisible(true);
        confirmInteractionTimerRef.current = setTimeout(() => {
          confirmInteractionTimerRef.current = null;
          setArtistConfirmInteractive(true);
        }, 300);
      });
    } else {
      openCreateForm(
        { ...fields, ...(matchedIds.length ? { artist_ids: matchedIds } : {}) },
        true,
        photoUris,
      );
    }
  };

  const applyParsedText = (
    announcementText: string,
    extraFields: EventFormPrefill = {},
    photoUris: string[] = pendingPhotoUris,
  ) => {
    applyParsedResult(
      announcementText,
      parseAnnouncement(announcementText),
      extraFields,
      photoUris,
    );
  };

  const handleParse = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('请粘贴公告内容', '可以粘贴公告链接或公告全文，也可以直接手动创建。', [
        { text: '重新输入', style: 'cancel' },
        { text: '手动创建', onPress: enterManualForm },
      ]);
      return;
    }

    if (IEVENT_URL_RE.test(trimmed)) {
      setParseLoading(true);
      try {
        const result = await fetchImportedEvent(trimmed);
        if (!result.ok) {
          showFailureAlert({
            title: '抓取失败',
            reason: '活动内容提取失败。',
            nextStep: '请检查网络或链接是否有效；也可以粘贴公告正文继续解析，或直接手动创建。',
            details: result.message,
            buttons: [
              { text: '重新输入', style: 'cancel' },
              { text: '手动创建', onPress: enterManualForm },
            ],
          });
          return;
        }

        const handoff = await prepareImportedEventDraft(
          result.event,
          allArtists,
          pendingPhotoUris,
        );
        const nextPhotoUris = handoff.photoUris;
        if (nextPhotoUris.length > pendingPhotoUris.length) {
          setPendingPhotoUris(nextPhotoUris);
        }

        applyDraftResult(handoff.draft, nextPhotoUris);
      } finally {
        setParseLoading(false);
      }
      return;
    }

    if (WEIBO_URL_RE.test(trimmed)) {
      setParseLoading(true);
      try {
        const result = await fetchWeiboPost(trimmed, weiboCookie);
        if (!result.ok) {
          showFailureAlert({
            title: result.kind === 'captcha' ? '需要验证' : '抓取失败',
            reason: result.kind === 'captcha'
              ? '当前登录状态可能已失效。'
              : '公告内容提取失败。',
            nextStep: result.kind === 'captcha'
              ? '请先前往「我的 → 设置 → 配置微博抓取功能」重新登录，再回来继续解析；也可以改为粘贴公告正文，或直接手动创建。'
              : '请先尝试重新登录微博后再试；也可以复制公告正文到文本框继续解析，或直接手动创建。',
            details: result.kind === 'captcha' ? undefined : result.message,
            buttons: [
              { text: '重新输入', style: 'cancel' },
              { text: '手动创建', onPress: enterManualForm },
            ],
          });
          return;
        }
        const downloads = result.post.pics.map((url) =>
          downloadWeiboFile(url, 'weibo', weiboCookie)
        );
        const pics = await Promise.all(downloads);
        const validPics = pics.filter((uri) => uri !== null) as string[];
        if (result.post.pics.length > 0 && validPics.length === 0) {
          Alert.alert(
            '资料图下载失败',
            '微博正文已经解析成功，但资料图下载失败了。你可以继续创建活动，并在表单里手动上传资料图。',
          );
        }
        const nextPhotoUris = validPics.length > 0
          ? [...pendingPhotoUris, ...validPics]
          : pendingPhotoUris;
        if (validPics.length > 0) {
          setPendingPhotoUris(nextPhotoUris);
        }
        applyParsedText(result.post.text, { url: trimmed }, nextPhotoUris);
      } finally {
        setParseLoading(false);
      }
      return;
    }

    applyParsedText(trimmed);
  };

  const handleConfirmArtists = async (confirmed: ArtistCandidate[]) => {
    setArtistConfirmVisible(false);
    setArtistConfirmInteractive(false);
    const selected = confirmed.filter((c) => c.resolution === 'create');
    const resolvedIds = confirmed
      .map((candidate) => candidate.resolution)
      .filter((resolution) => resolution !== 'create' && resolution !== 'skip');
    const newIds: string[] = [];

    for (const c of selected) {
      const { name, short_name } = splitArtistHandle(c.editName.trim() || c.rawName);
      const newArtist = await db.artists.create({ name, short_name });
      newIds.push(newArtist.id);
      setAllArtists((prev) => [...prev, newArtist]);
    }

    const allIds = [...new Set([...pendingMatchedIds, ...resolvedIds, ...newIds])];
    openCreateForm(
      { ...pendingFields, ...(allIds.length ? { artist_ids: allIds } : {}) },
      true,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ParseModal
        visible={!artistConfirmVisible}
        isDark={isDark}
        loading={parseLoading}
        onClose={closeParseModal}
        onManual={enterManualForm}
        onSubmit={handleParse}
      />

      <NewArtistConfirmModal
        visible={artistConfirmVisible}
        interactive={artistConfirmInteractive}
        isDark={isDark}
        initialCandidates={artistCandidates}
        onConfirm={handleConfirmArtists}
      />
    </View>
  );
}

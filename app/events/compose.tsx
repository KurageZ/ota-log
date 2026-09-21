import { fetchAnnouncementText, isAnnouncementUrl } from '../../src/utils/announcementWebText';
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  InteractionManager,
} from 'react-native';
import { BottomSheetModalProvider, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetDialog, BottomSheetAction } from '../../src/components/BottomSheetDialog';
import Clipboard from '@react-native-clipboard/clipboard';
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
import {
  applyImportedTimetableArtistResolutions,
  prepareImportedEventDraft,
} from '../../src/utils/importedEventDraft';
import type { ParsedEventDraftResult } from '../../src/utils/parsedEventDraft';
import {
  DEFAULT_ARTIST_CONFIRMATION_MODE,
  getArtistCandidatesForConfirmation,
  selectAllArtistCandidates,
} from '../../src/utils/artistConfirmation';

// ── ParseModal ────────────────────────────────────────────────────────────────
// Keep the input mounted so returning from performer confirmation preserves it.

interface ParseModalProps {
  visible: boolean;
  isDark: boolean;
  loading: boolean;
  artistContextStatus: 'loading' | 'ready' | 'error';
  onClose: () => void;
  onManual: () => void;
  onRetryArtistContext: () => void;
  onSubmit: (text: string, sourceUrl?: string) => Promise<void>;
}

function ParseModal({
  visible,
  isDark,
  loading,
  artistContextStatus,
  onClose,
  onManual,
  onRetryArtistContext,
  onSubmit,
}: ParseModalProps) {
  const { colors } = useAppTheme();
  const [textValue, setTextValue] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const handleSubmit = () => {
    const url = urlValue.trim();
    const text = textValue.trim();
    onSubmit(text || url, text && isAnnouncementUrl(url) ? url : undefined);
  };

  const hasInput = urlValue.trim().length > 0 || textValue.trim().length > 0;
  const isArtistContextLoading = artistContextStatus === 'loading';
  const isPrimaryDisabled = loading || isArtistContextLoading;

  const handlePasteAndSubmit = async () => {
    const clipboardText = (await Clipboard.getString()).trim();
    if (!clipboardText) {
      Alert.alert('剪贴板为空', '请先复制公告链接或公告文本。');
      return;
    }

    if (isAnnouncementUrl(clipboardText)) {
      setUrlValue(clipboardText);
      setTextValue('');
    } else {
      setTextValue(clipboardText);
      setUrlValue('');
    }

    await onSubmit(clipboardText);
  };

  const cardBg = colors.card;
  const labelStyle = {
    fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: isDark ? colors.textMuted : colors.placeholder, marginBottom: 8,
  };

  return (
    <BottomSheetDialog
      visible={visible}
      title="解析公告"
      onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          <BottomSheetAction
            label={artistContextStatus === 'error' ? '载入失败，点击重试' : hasInput ? '解析并创建草稿' : '粘贴并识别'}
            onPress={artistContextStatus === 'error' ? onRetryArtistContext : hasInput ? handleSubmit : () => { void handlePasteAndSubmit(); }}
            disabled={isPrimaryDisabled}
            loading={loading || isArtistContextLoading}
          />
          <BottomSheetAction label="不使用解析，手动输入" variant="secondary" disabled={loading} onPress={onManual} />
        </View>
      )}
    >
      <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <Text style={labelStyle}>公告链接</Text>
        <BottomSheetTextInput
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
        <BottomSheetTextInput
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
          支持公开网页链接或公告正文；两者都填写时优先解析正文。识别不准时可在草稿中修改。
        </Text>
      </View>
    </BottomSheetDialog>
  );
}

// ── NewArtistConfirmModal ─────────────────────────────────────────────────────

interface ConfirmModalProps {
  visible: boolean;
  interactive: boolean;
  isDark: boolean;
  initialCandidates: ArtistCandidate[];
  saving: boolean;
  onClose: () => void;
  onBack: () => void;
  onConfirm: (candidates: ArtistCandidate[]) => void;
}

function NewArtistConfirmModal({
  visible,
  interactive,
  isDark,
  initialCandidates,
  saving,
  onClose,
  onBack,
  onConfirm,
}: ConfirmModalProps) {
  const { colors } = useAppTheme();
  const [candidates, setCandidates] = useState<ArtistCandidate[]>([]);

  useEffect(() => {
    if (visible) setCandidates(initialCandidates.map((c) => ({ ...c })));
  }, [visible, initialCandidates]);

  const setResolution = (i: number, resolution: ArtistCandidate['resolution']) =>
    setCandidates((prev) => prev.map((c, idx) => idx === i ? { ...c, resolution } : c));

  const rename = (i: number, text: string) =>
    setCandidates((prev) => prev.map((c, idx) => idx === i ? { ...c, editName: text } : c));

  const selectedCount = candidates.filter((c) => c.resolution !== 'skip').length;
  const allSelected = candidates.length > 0 && selectedCount === candidates.length;
  const cardBg = colors.card;

  return (
    <BottomSheetDialog
      visible={visible}
      title="确认出演者"
      onClose={onClose}
      dismissible={!saving}
      headerAccessory={(
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={allSelected ? '取消全选出演者' : '全选出演者'}
          disabled={!interactive}
          activeOpacity={0.7}
          onPress={() => setCandidates((current) => (
            allSelected
              ? current.map((candidate) => ({ ...candidate, resolution: 'skip' }))
              : selectAllArtistCandidates(current)
          ))}
          style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 16 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accent }}>
            {allSelected ? '取消全选' : '全选'}
          </Text>
        </TouchableOpacity>
      )}
      footer={(
        <View style={{ gap: 8 }}>
          <BottomSheetAction
            label={selectedCount > 0 ? `确认 ${selectedCount} 位出演者` : '不添加并继续'}
            disabled={!interactive}
            loading={saving}
            onPress={() => onConfirm(candidates)}
          />
          <BottomSheetAction label="返回解析" variant="secondary" disabled={saving} onPress={onBack} />
        </View>
      )}
    >
      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 }}>
        选择要添加的出演者；也可以将其匹配到艺人库中的已有艺人。
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
                accessibilityRole="checkbox"
                accessibilityLabel={`${c.editName || c.rawName}，${c.resolution === 'skip' ? '未选择' : '已选择'}`}
                accessibilityState={{ checked: c.resolution !== 'skip', disabled: !interactive }}
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
              <BottomSheetTextInput
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
    </BottomSheetDialog>
  );
}

// ── NewEventScreen ────────────────────────────────────────────────────────────

export default function NewEventScreen() {
  const db = useDB();
  const { isDark } = useAppTheme();
  const [parseLoading, setParseLoading] = useState(false);
  const activeRef = useRef(true);
  const [artistSaving, setArtistSaving] = useState(false);
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>([]);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [weiboCookie, setWeiboCookie] = useState<string>('');
  const [artistConfirmationMode, setArtistConfirmationMode] = useState(DEFAULT_ARTIST_CONFIRMATION_MODE);
  const [artistContextStatus, setArtistContextStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [artistContextReloadKey, setArtistContextReloadKey] = useState(0);

  // State for the artist confirmation flow
  const [artistCandidates, setArtistCandidates] = useState<ArtistCandidate[]>([]);
  const [artistConfirmVisible, setArtistConfirmVisible] = useState(false);
  const [artistConfirmInteractive, setArtistConfirmInteractive] = useState(false);
  const [pendingMatchedIds, setPendingMatchedIds] = useState<string[]>([]);
  const [pendingFields, setPendingFields] = useState<EventFormPrefill | null>(null);
  const [pendingPrefillWarning, setPendingPrefillWarning] = useState<string | null>(null);
  const confirmVisibilityTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const confirmInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArtistContextStatus('loading');
    void Promise.all([
      db.artists.findAll(),
      db.userConfig.getConfig(),
    ]).then(([artists, config]) => {
      if (cancelled) return;
      setAllArtists(artists);
      setArtistConfirmationMode(config.artist_confirmation_mode);
      setArtistContextStatus('ready');
    }).catch(() => {
      if (!cancelled) setArtistContextStatus('error');
    });

    void loadWeiboCookie().then((cookie) => {
      if (!cancelled) setWeiboCookie(cookie);
    });

    return () => {
      cancelled = true;
    };
  }, [artistContextReloadKey, db]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      confirmVisibilityTaskRef.current?.cancel();
      if (confirmInteractionTimerRef.current) {
        clearTimeout(confirmInteractionTimerRef.current);
      }
    };
  }, []);

  const openCreateForm = (
    prefill: EventFormPrefill | null,
    showPrefillNotice: boolean,
    photoUris: string[] = pendingPhotoUris,
    prefillWarning: string | null = null,
  ) => {
    if (!activeRef.current) return;
    setEventDraft({ prefill, photoUris, showPrefillNotice, prefillWarning });
    activeRef.current = false;
    router.replace('/events/create');
  };

  const enterManualForm = () => {
    openCreateForm(null, false, []);
  };

  const closeParseModal = () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    confirmVisibilityTaskRef.current?.cancel();
    if (confirmInteractionTimerRef.current) clearTimeout(confirmInteractionTimerRef.current);
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

    if (!hasUsefulFields) {
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
    prefillWarning: string | null = null,
  ) => {
    if (!activeRef.current) return;
    const { matchedIds, candidates, fields } = draft;
    const confirmationCandidates = getArtistCandidatesForConfirmation(
      candidates,
      artistConfirmationMode,
    );
    if (confirmationCandidates.length > 0) {
      setPendingMatchedIds(matchedIds);
      setPendingFields(fields);
      setPendingPrefillWarning(prefillWarning);
      setArtistCandidates(confirmationCandidates);
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
        prefillWarning,
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

  const handleParse = async (text: string, sourceUrl?: string) => {
    if (!activeRef.current) return;
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('请粘贴公告内容', '可以粘贴公告链接或公告全文，也可以直接手动创建。', [
        { text: '重新输入', style: 'cancel' },
        { text: '手动创建', onPress: enterManualForm },
      ]);
      return;
    }

    if (isAnnouncementUrl(trimmed) && IEVENT_URL_RE.test(trimmed)) {
      setParseLoading(true);
      try {
        const result = await fetchImportedEvent(trimmed);
        if (!activeRef.current) return;
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
        if (!activeRef.current) return;
        const nextPhotoUris = handoff.photoUris;
        if (nextPhotoUris.length > pendingPhotoUris.length) {
          setPendingPhotoUris(nextPhotoUris);
        }

        const prefillWarning = result.event.partialFailures.length > 0
          ? `以下场次仅使用父活动摘要预填，详细时间表未能完整获取：${result.event.partialFailures.join('、')}`
          : null;
        applyDraftResult(handoff.draft, nextPhotoUris, prefillWarning);
      } finally {
        if (activeRef.current) setParseLoading(false);
      }
      return;
    }

    if (isAnnouncementUrl(trimmed) && WEIBO_URL_RE.test(trimmed)) {
      setParseLoading(true);
      try {
        const result = await fetchWeiboPost(trimmed, weiboCookie);
        if (!activeRef.current) return;
        if (!result.ok) {
          showFailureAlert({
            title: result.kind === 'captcha' ? '需要验证' : '抓取失败',
            reason: result.kind === 'captcha'
              ? '当前登录状态可能已失效。'
              : '公告内容提取失败。',
            nextStep: result.kind === 'captcha'
              ? '请先前往「我的 → 工具箱 → 登录微博」重新登录，再回来继续解析；也可以改为粘贴公告正文，或直接手动创建。'
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
        if (!activeRef.current) return;
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
        if (activeRef.current) setParseLoading(false);
      }
      return;
    }

    if (isAnnouncementUrl(trimmed)) {
      setParseLoading(true);
      try {
        const announcementText = await fetchAnnouncementText(trimmed);
        if (!activeRef.current) return;
        applyParsedText(announcementText, { url: trimmed });
      } catch (error) {
        if (!activeRef.current) return;
        showFailureAlert({
          title: '抓取失败',
          reason: '未能提取网页正文。',
          nextStep: '可以复制网页中的活动正文，粘贴到公告文本后重试，或手动创建。',
          details: error instanceof Error ? error.message : String(error),
          buttons: [
            { text: '重新输入', style: 'cancel' },
            { text: '手动创建', onPress: enterManualForm },
          ],
        });
      } finally {
        if (activeRef.current) setParseLoading(false);
      }
      return;
    }

    applyParsedText(trimmed, sourceUrl ? { url: sourceUrl } : {});
  };

  const handleConfirmArtists = async (confirmed: ArtistCandidate[]) => {
    setArtistSaving(true);
    try {
      const selected = confirmed.filter((c) => c.resolution === 'create');
      const resolvedIds = confirmed
        .map((candidate) => candidate.resolution)
        .filter((resolution) => resolution !== 'create' && resolution !== 'skip');
      const newIds: string[] = [];
      const timetableResolutions = new Map<string, string>();

      for (const c of selected) {
        const { name, short_name } = splitArtistHandle(c.editName.trim() || c.rawName);
        const newArtist = await db.artists.create({ name, short_name });
        newIds.push(newArtist.id);
        timetableResolutions.set(c.rawName.trim(), newArtist.id);
        setAllArtists((prev) => [...prev, newArtist]);
      }

      for (const candidate of confirmed) {
        if (candidate.resolution !== 'create' && candidate.resolution !== 'skip') {
          timetableResolutions.set(candidate.rawName.trim(), candidate.resolution);
        }
      }

      const allIds = [...new Set([...pendingMatchedIds, ...resolvedIds, ...newIds])];
      const resolvedFields = pendingFields
        ? applyImportedTimetableArtistResolutions(pendingFields, timetableResolutions)
        : pendingFields;
      openCreateForm(
        { ...resolvedFields, ...(allIds.length ? { artist_ids: allIds } : {}) },
        true,
        pendingPhotoUris,
        pendingPrefillWarning,
      );
    } catch (error) {
      showFailureAlert({ title: '创建艺人失败', reason: '出演者未能全部创建。', nextStep: '请返回解析，重新匹配已有艺人后继续。', details: String(error) });
    } finally {
      setArtistSaving(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ParseModal
          visible={!artistConfirmVisible}
          isDark={isDark}
          loading={parseLoading}
          artistContextStatus={artistContextStatus}
          onClose={closeParseModal}
          onManual={enterManualForm}
          onRetryArtistContext={() => setArtistContextReloadKey((key) => key + 1)}
          onSubmit={handleParse}
        />

        <NewArtistConfirmModal
          visible={artistConfirmVisible}
          interactive={artistConfirmInteractive && !artistSaving}
          saving={artistSaving}
          onClose={closeParseModal}
          onBack={() => {
            setArtistConfirmVisible(false);
            setArtistConfirmInteractive(false);
          }}
          isDark={isDark}
          initialCandidates={artistCandidates}
          onConfirm={handleConfirmArtists}
        />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

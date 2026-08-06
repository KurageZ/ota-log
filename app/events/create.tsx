import { useRef, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { AppIcon } from '../../src/components/AppIcon';
import { EventForm, defaultFormValues } from '../../src/components/EventForm';
import { toTimetableReplacementInput } from '../../src/components/EventTimetableEditor';
import { NativeTextToolbar } from '../../src/components/native-text-toolbar';
import type { EventFormHandle, EventFormValues } from '../../src/components/EventForm';
import { useDB } from '../../src/context/DBContext';
import { consumeEventDraft } from '../../src/utils/eventDraftStore';
import { useAppTheme } from '../../src/theme/appTheme';
import { showOperationFailedAlert } from '../../src/utils/failureAlert';

export default function CreateEventScreen() {
  const db = useDB();
  const { colors } = useAppTheme();
  const formRef = useRef<EventFormHandle>(null);
  const [draft] = useState(() => consumeEventDraft());
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>(draft?.photoUris ?? []);
  const [prefillNoticeVisible, setPrefillNoticeVisible] = useState(Boolean(draft?.showPrefillNotice));

  const handleSubmit = async (values: EventFormValues) => {
    const event = await db.events.createWithSchedule({
      title: values.title,
      event_type: 'livehouse',
      sessions: values.sessions.map((session, index) => ({
        title: session.title || null,
        session_date: session.session_date,
        end_date: session.end_date || null,
        open_time: session.open_time || null,
        start_time: session.start_time || null,
        end_time: session.end_time || null,
        city: session.city || null,
        venue: session.venue || null,
        sort_order: index,
        timetable: toTimetableReplacementInput(session.timetable),
      })),
      artist_ids: [...new Set(values.artist_ids)],
      status: values.status,
      trip_id: values.trip_id,
      actual_expense: values.actual_expense ? parseFloat(values.actual_expense) : null,
      notes: values.notes || null,
      details: values.details || null,
      url: values.url || null,
      setlist_text: values.setlist_text || null,
      review_score: values.review_score,
    });
    let photoSaveError: unknown = null;
    for (const uri of pendingPhotoUris) {
      try {
        await db.photos.create(uri, event.id);
      } catch (error) {
        photoSaveError ??= error;
      }
    }
    if (photoSaveError) {
      showOperationFailedAlert(
        '活动已保存，但部分资料图未能添加。',
        '可以稍后编辑活动重新添加。',
        photoSaveError,
      );
    }
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '新建活动',
          headerTitleAlign: 'center',
          headerLeft: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: Platform.OS === 'ios' ? undefined : () => (
            <TouchableOpacity onPress={() => formRef.current?.submit()} style={{ paddingRight: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>保存</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <NativeTextToolbar
        left={{ label: '取消', onPress: () => router.back() }}
        right={{ label: '保存', onPress: () => formRef.current?.submit(), variant: 'done' }}
      />
      <EventForm
        ref={formRef}
        mode="create"
        initialValues={draft?.prefill ?? defaultFormValues}
        onSubmit={handleSubmit}
        submitLabel="创建活动"
        hideSubmitButton
        key={JSON.stringify(draft?.prefill ?? null)}
        photoUris={pendingPhotoUris}
        onPhotoAdd={(uri) => setPendingPhotoUris((prev) => [...prev, uri])}
        onPhotoRemove={(uri) => setPendingPhotoUris((prev) => prev.filter((u) => u !== uri))}
        leadingContent={prefillNoticeVisible ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: colors.accentSoft,
            borderRadius: 14, padding: 12, marginBottom: 12,
          }}>
            <AppIcon name="sparkles" size={18} color={colors.accent} />
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.accentText }}>
              已从公告预填信息，请确认后创建
            </Text>
            <TouchableOpacity onPress={() => setPrefillNoticeVisible(false)}>
              <AppIcon name="close" size={18} color={colors.accentText} />
            </TouchableOpacity>
          </View>
        ) : null}
      />
    </>
  );
}

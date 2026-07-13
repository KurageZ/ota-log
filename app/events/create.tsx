import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { AppIcon } from '../../src/components/AppIcon';
import { EventForm, defaultFormValues } from '../../src/components/EventForm';
import type { EventFormHandle, EventFormValues } from '../../src/components/EventForm';
import { useDB } from '../../src/context/DBContext';
import { consumeEventDraft } from '../../src/utils/eventDraftStore';
import { useAppTheme } from '../../src/theme/appTheme';

export default function CreateEventScreen() {
  const db = useDB();
  const { colors } = useAppTheme();
  const formRef = useRef<EventFormHandle>(null);
  const [draft] = useState(() => consumeEventDraft());
  const [pendingPhotoUris, setPendingPhotoUris] = useState<string[]>(draft?.photoUris ?? []);
  const [prefillNoticeVisible, setPrefillNoticeVisible] = useState(Boolean(draft?.showPrefillNotice));

  const handleSubmit = async (values: EventFormValues) => {
    const event = await db.events.create({
      title: values.title,
      event_type: 'livehouse',
      event_date: values.event_date,
      event_time: values.event_time || null,
      city: values.city || null,
      venue: values.venue || null,
      status: values.status,
      trip_id: values.trip_id,
      ticket_price: values.ticket_price ? parseFloat(values.ticket_price) : null,
      notes: values.notes || null,
      details: values.details || null,
      url: values.url || null,
      setlist_text: values.setlist_text || null,
      review_score: values.review_score,
    });
    const uniqueArtistIds = [...new Set(values.artist_ids)];
    await db.events.setArtists(event.id, uniqueArtistIds);
    for (const uri of pendingPhotoUris) {
      await db.photos.create(uri, event.id);
    }
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '新建活动',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>取消</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => formRef.current?.submit()} style={{ paddingRight: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>保存</Text>
            </TouchableOpacity>
          ),
        }}
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

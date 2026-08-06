import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useDB } from '../../../src/context/DBContext';
import { Event, Artist, EventSession, Photo } from '../../../src/types/models';
import { EventForm, EventFormHandle, EventFormValues } from '../../../src/components/EventForm';
import { toTimetableReplacementInput } from '../../../src/components/EventTimetableEditor';
import { NativeTextToolbar } from '../../../src/components/native-text-toolbar';
import { useAppTheme } from '../../../src/theme/appTheme';
import { showOperationFailedAlert } from '../../../src/utils/failureAlert';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const { colors } = useAppTheme();

  const formRef = useRef<EventFormHandle>(null);
  const [initialValues, setInitialValues] = useState<EventFormValues | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([]);
  const [photosToAdd, setPhotosToAdd] = useState<string[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      db.events.findById(id),
      db.events.getArtists(id),
      db.photos.findByEventId(id),
      db.eventSchedules.findSessions(id),
    ]).then(async ([event, artists, photos, sessions]: [Event | null, Artist[], Photo[], EventSession[]]) => {
      if (!event) return;
      const timetables = await Promise.all(
        sessions.map((session) => db.eventSchedules.findTimetable(session.id)),
      );
      setInitialValues({
        title: event.title,
        sessions: sessions.map((session, sessionIndex) => ({
          key: session.id,
          id: session.id,
          title: session.title ?? '',
          session_date: session.session_date,
          end_date: session.end_date ?? '',
          open_time: session.open_time ?? '',
          start_time: session.start_time ?? '',
          end_time: session.end_time ?? '',
          city: session.city ?? '',
          venue: session.venue ?? '',
          timetable: timetables[sessionIndex].map((entry) => ({
            key: entry.id,
            id: entry.id,
            title: entry.title,
            artist_id: entry.artist_id ?? '',
            start_time: entry.start_time ?? '',
            end_time: entry.end_time ?? '',
            notes: entry.notes ?? '',
          })),
        })),
        status: event.status,
        trip_id: event.trip_id,
        actual_expense: event.actual_expense != null ? String(event.actual_expense) : '',
        url: event.url ?? '',
        notes: event.notes ?? '',
        details: event.details ?? '',
        artist_ids: artists.map((a) => a.id),
        setlist_text: event.setlist_text ?? '',
        review_score: event.review_score,
      });
      setExistingPhotos(photos);
    });
  }, [db, id]);

  const photoUris = [
    ...existingPhotos.filter((p) => !photosToDelete.includes(p.id)).map((p) => p.local_uri),
    ...photosToAdd,
  ];

  const handlePhotoAdd = (uri: string) => setPhotosToAdd((prev) => [...prev, uri]);

  const handlePhotoRemove = (uri: string) => {
    if (photosToAdd.includes(uri)) {
      setPhotosToAdd((prev) => prev.filter((u) => u !== uri));
    } else {
      const photo = existingPhotos.find((p) => p.local_uri === uri);
      if (photo) setPhotosToDelete((prev) => [...prev, photo.id]);
    }
  };

  const handleSubmit = async (values: EventFormValues) => {
    await db.events.updateWithSchedule(id!, {
      title: values.title,
      status: values.status,
      trip_id: values.trip_id,
      actual_expense: values.actual_expense ? parseFloat(values.actual_expense) : null,
      notes: values.notes || null,
      details: values.details || null,
      url: values.url || null,
      setlist_text: values.setlist_text || null,
      review_score: values.review_score,
      artist_ids: [...new Set(values.artist_ids)],
      sessions: values.sessions.map((session) => ({
        id: session.id,
        title: session.title || null,
        session_date: session.session_date,
        end_date: session.end_date || null,
        open_time: session.open_time || null,
        start_time: session.start_time || null,
        end_time: session.end_time || null,
        city: session.city || null,
        venue: session.venue || null,
        timetable: toTimetableReplacementInput(session.timetable),
      })),
    });
    let photoSaveError: unknown = null;
    for (const uri of photosToAdd) {
      try {
        await db.photos.create(uri, id!);
      } catch (error) {
        photoSaveError ??= error;
      }
    }
    for (const photoId of photosToDelete) {
      try {
        await db.photos.delete(photoId);
      } catch (error) {
        photoSaveError ??= error;
      }
    }
    if (photoSaveError) {
      showOperationFailedAlert(
        '活动已保存，但部分资料图未能更新。',
        '可以稍后再次编辑资料图。',
        photoSaveError,
      );
    }
    router.back();
  };

  if (!initialValues) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screen }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '编辑活动',
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
        mode="edit"
        initialValues={initialValues}
        onSubmit={handleSubmit}
        submitLabel="保存修改"
        hideSubmitButton
        photoUris={photoUris}
        onPhotoAdd={handlePhotoAdd}
        onPhotoRemove={handlePhotoRemove}
      />
    </>
  );
}

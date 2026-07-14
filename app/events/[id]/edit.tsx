import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useDB } from '../../../src/context/DBContext';
import { Event, Artist, Photo } from '../../../src/types/models';
import { EventForm, EventFormHandle, EventFormValues } from '../../../src/components/EventForm';
import { NativeTextToolbar } from '../../../src/components/native-text-toolbar';
import { useAppTheme } from '../../../src/theme/appTheme';

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
    ]).then(([event, artists, photos]: [Event | null, Artist[], Photo[]]) => {
      if (!event) return;
      setInitialValues({
        title: event.title,
        event_date: event.event_date,
        event_time: event.event_time ?? '',
        city: event.city ?? '',
        venue: event.venue ?? '',
        status: event.status,
        trip_id: event.trip_id,
        ticket_price: event.ticket_price != null ? String(event.ticket_price) : '',
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
    await db.events.update(id!, {
      title: values.title,
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
    await db.events.setArtists(id!, values.artist_ids);
    for (const uri of photosToAdd) { await db.photos.create(uri, id!); }
    for (const photoId of photosToDelete) { await db.photos.delete(photoId); }
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

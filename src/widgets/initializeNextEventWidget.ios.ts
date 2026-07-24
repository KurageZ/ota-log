import { Directory, File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import type { EventRepository } from '../repositories/EventRepository';
import type { PhotoRepository } from '../repositories/PhotoRepository';
import { synchronizeCurrentEvent } from '../utils/currentEvent';
import { NextEventWidget } from './NextEventWidget';
import { createNextEventWidgetProps } from './nextEventWidgetPresentation';

async function cacheEventImage(eventId: string | undefined, photos: Pick<PhotoRepository, 'findByEventId'>): Promise<string | undefined> {
  if (!eventId || !widgetsDirectory) return undefined;
  const eventPhotos = await photos.findByEventId(eventId);
  const source = eventPhotos[0];
  if (!source) return undefined;

  const directory = new Directory(new Directory(widgetsDirectory), 'next-event-images');
  directory.create({ idempotent: true, intermediates: true });
  const sourceFile = new File(source.local_uri);
  if (!sourceFile.exists) return undefined;
  const destination = new File(directory, `${eventId}-${sourceFile.name}`);
  await sourceFile.copy(destination, { overwrite: true });
  for (const entry of directory.list()) {
    if (entry instanceof File && entry.uri !== destination.uri) entry.delete();
  }
  return destination.uri;
}

export async function initializeNextEventWidget(
  repository: EventRepository,
  photos: Pick<PhotoRepository, 'findByEventId'>,
  now = new Date(),
): Promise<void> {
  const event = await synchronizeCurrentEvent(repository, now);
  const imageUri = await cacheEventImage(event?.id, photos);
  NextEventWidget.updateSnapshot(createNextEventWidgetProps(event, now, imageUri));
}

import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { widgetsDirectory } from 'expo-widgets';
import type { Cheki } from '../types/models';
import type { ChekiRepository } from '../repositories/ChekiRepository';
import { ChekiPhotoWidget } from './ChekiPhotoWidget';
import { createChekiPhotoWidgetTimeline } from './chekiPhotoWidgetTimeline';

const THUMBNAIL_DIRECTORY_NAME = 'cheki-thumbnails';
const THUMBNAIL_FILENAME_PREFIX = 'v1-';
const THUMBNAIL_WIDTH = 600;
const THUMBNAIL_COMPRESSION = 0.8;

type ChekiReader = Pick<ChekiRepository, 'findAll'>;

function getThumbnailFilename(cheki: Cheki): string {
  return `${THUMBNAIL_FILENAME_PREFIX}${cheki.id}.jpg`;
}

async function createThumbnail(sourceUri: string, destination: File): Promise<void> {
  const context = ImageManipulator.manipulate(sourceUri);

  try {
    const image = await context.resize({ width: THUMBNAIL_WIDTH }).renderAsync();

    try {
      const result = await image.saveAsync({
        compress: THUMBNAIL_COMPRESSION,
        format: SaveFormat.JPEG,
      });
      const temporaryFile = new File(result.uri);

      try {
        await temporaryFile.copy(destination, { overwrite: true });
      } finally {
        if (temporaryFile.exists) temporaryFile.delete();
      }
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

async function cacheThumbnails(chekiRecords: Cheki[], directory: Directory): Promise<string[]> {
  const activeFilenames = new Set(chekiRecords.map(getThumbnailFilename));
  const imageUris: string[] = [];

  for (const cheki of chekiRecords) {
    const thumbnail = new File(directory, getThumbnailFilename(cheki));

    try {
      if (!thumbnail.exists || thumbnail.size === 0) {
        await createThumbnail(cheki.photo_uri, thumbnail);
      }
      imageUris.push(thumbnail.uri);
    } catch (error) {
      console.warn(`Failed to cache cheki widget thumbnail ${cheki.id}`, error);
    }
  }

  for (const entry of directory.list()) {
    if (entry instanceof File && !activeFilenames.has(entry.name)) {
      entry.delete();
    }
  }

  return imageUris;
}

export async function initializeChekiPhotoWidget(chekiRepository: ChekiReader): Promise<void> {
  if (!widgetsDirectory) {
    throw new Error('The cheki widget App Group directory is unavailable');
  }

  const sharedDirectory = new Directory(widgetsDirectory);
  sharedDirectory.create({ idempotent: true, intermediates: true });
  const thumbnailDirectory = new Directory(sharedDirectory, THUMBNAIL_DIRECTORY_NAME);
  thumbnailDirectory.create({ idempotent: true, intermediates: true });

  const chekiRecords = await chekiRepository.findAll();
  const imageUris = await cacheThumbnails(chekiRecords, thumbnailDirectory);

  const timeline = createChekiPhotoWidgetTimeline(imageUris);
  if (timeline.length === 0) {
    ChekiPhotoWidget.updateSnapshot({});
    return;
  }

  ChekiPhotoWidget.updateTimeline(timeline);
}

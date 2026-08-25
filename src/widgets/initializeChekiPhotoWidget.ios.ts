import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { widgetsDirectory } from 'expo-widgets';
import type { ChekiWidgetGroupRepository } from '../repositories/ChekiWidgetGroupRepository';
import { ChekiPhotoWidget } from './ChekiPhotoWidget';
import { createChekiPhotoWidgetTimeline, createChekiWidgetGroupPresentation } from './chekiPhotoWidgetTimeline';

const THUMBNAIL_DIRECTORY_NAME = 'cheki-thumbnails';
const THUMBNAIL_WIDTH = 600;
const THUMBNAIL_COMPRESSION = 0.8;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}

async function createThumbnail(sourceUri: string, destination: File): Promise<void> {
  const context = ImageManipulator.manipulate(sourceUri);
  try {
    const image = await context.resize({ width: THUMBNAIL_WIDTH }).renderAsync();
    try {
      const result = await image.saveAsync({ compress: THUMBNAIL_COMPRESSION, format: SaveFormat.JPEG });
      const temporaryFile = new File(result.uri);
      try { await temporaryFile.copy(destination, { overwrite: true }); } finally { if (temporaryFile.exists) temporaryFile.delete(); }
    } finally { image.release(); }
  } finally { context.release(); }
}

export async function initializeChekiPhotoWidget(repository: ChekiWidgetGroupRepository): Promise<void> {
  if (!widgetsDirectory) throw new Error('The cheki widget App Group directory is unavailable');
  const directory = new Directory(new Directory(widgetsDirectory), THUMBNAIL_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  const now = new Date();
  const groups = await repository.resolveForWidget(now);
  const needed = new Map<string, { id: string; uri: string }>();
  for (const group of groups) for (const item of group.items) needed.set(item.id, { id: item.id, uri: item.frontPhotoUri });
  const cached = new Map<string, string>();
  const failed = new Set<string>();
  for (const item of needed.values()) {
    const file = new File(directory, `v2-${stableHash(`${item.id}:${item.uri}`)}.jpg`);
    try {
      if (!file.exists || file.size === 0) await createThumbnail(item.uri, file);
      cached.set(item.id, file.uri);
    } catch (error) { failed.add(item.id); console.warn(`Failed to cache cheki widget thumbnail ${item.id}`, error); }
  }
  const presentations = groups.map((group) => createChekiWidgetGroupPresentation(group, cached, failed, now));
  const activeNames = new Set<string>();
  for (const item of needed.values()) activeNames.add(`v2-${stableHash(`${item.id}:${item.uri}`)}.jpg`);
  for (const entry of directory.list()) if (entry instanceof File && !activeNames.has(entry.name)) entry.delete();
  ChekiPhotoWidget.updateTimeline(createChekiPhotoWidgetTimeline(presentations, now.getTime()));
}

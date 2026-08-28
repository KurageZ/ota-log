import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { widgetsDirectory } from 'expo-widgets';
import type { ChekiRepository } from '../repositories/ChekiRepository';
import { getAppTheme } from '../theme/appTheme';
import type { AppCalendarWeekStart, AppThemeId } from '../theme/config';
import { CalendarWidget } from './CalendarWidget';
import {
  calendarWidgetTimelineMonthKeys,
  createCalendarWidgetTimeline,
  type CalendarWidgetMonthData,
  type CalendarWidgetThemePalettes,
} from './calendarWidgetPresentation';

const THUMBNAIL_DIRECTORY_NAME = 'calendar-thumbnails';
const THUMBNAIL_WIDTH = 180;
const THUMBNAIL_COMPRESSION = 0.76;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function createThumbnail(sourceUri: string, destination: File): Promise<void> {
  const context = ImageManipulator.manipulate(sourceUri);
  try {
    const image = await context.resize({ width: THUMBNAIL_WIDTH }).renderAsync();
    try {
      const result = await image.saveAsync({ compress: THUMBNAIL_COMPRESSION, format: SaveFormat.JPEG });
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

function widgetPalette(theme: ReturnType<typeof getAppTheme>) {
  return {
    background: theme.screen,
    heading: theme.heading,
    text: theme.textSecondary,
    muted: theme.textMuted,
    accent: theme.accent,
    accentSoft: theme.accentSofter,
    onAccent: theme.onAccent,
  };
}

async function cacheMonthImages(
  directory: Directory,
  monthData: ReadonlyMap<string, CalendarWidgetMonthData>,
): Promise<Map<string, string>> {
  const sourceUris = new Set<string>();
  for (const data of monthData.values()) {
    for (const summary of data.summaries) {
      const sourceUri = summary.latestPhotoUri ?? summary.fallbackArtistAvatarUri;
      if (sourceUri) sourceUris.add(sourceUri);
    }
  }

  const cached = new Map<string, string>();
  const activeNames = new Set<string>();
  for (const sourceUri of sourceUris) {
    const name = `v1-${stableHash(sourceUri)}.jpg`;
    const file = new File(directory, name);
    activeNames.add(name);
    try {
      if (!file.exists || file.size === 0) await createThumbnail(sourceUri, file);
      cached.set(sourceUri, file.uri);
    } catch (error) {
      console.warn(`Failed to cache calendar widget thumbnail ${sourceUri}`, error);
    }
  }

  for (const entry of directory.list()) {
    if (entry instanceof File && !activeNames.has(entry.name)) entry.delete();
  }
  return cached;
}

export async function initializeCalendarWidget(
  cheki: ChekiRepository,
  themeId: AppThemeId,
  weekStart: AppCalendarWeekStart,
  now = new Date(),
): Promise<void> {
  if (!widgetsDirectory) throw new Error('The calendar widget App Group directory is unavailable');

  const monthKeys = calendarWidgetTimelineMonthKeys(now);
  const monthEntries = await Promise.all(monthKeys.map(async (key) => {
    const [year, month] = key.split('-').map(Number);
    const summaries = await cheki.findCalendarSummariesByMonth(year, month);
    return [key, { summaries }] as const;
  }));
  const monthData = new Map<string, CalendarWidgetMonthData>(monthEntries);

  const directory = new Directory(new Directory(widgetsDirectory), THUMBNAIL_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  const cachedImageUris = await cacheMonthImages(directory, monthData);
  const palettes: CalendarWidgetThemePalettes = {
    light: widgetPalette(getAppTheme(themeId, 'light')),
    dark: widgetPalette(getAppTheme(themeId, 'dark')),
  };
  const timeline = createCalendarWidgetTimeline(
    monthData,
    cachedImageUris,
    palettes,
    weekStart === 'monday' ? 1 : 0,
    now,
  );
  CalendarWidget.updateTimeline(timeline);
}

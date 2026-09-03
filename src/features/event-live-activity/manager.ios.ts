import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { after, widgetsDirectory } from 'expo-widgets';
import type { Repositories } from '../../context/DBContext';
import type { Event } from '../../types/models';
import { EventLiveActivity } from './EventLiveActivity';
import {
  formatLiveActivityClock,
  projectEventLiveActivity,
} from './projection';
import {
  assertEventLiveActivityPayloadFits,
  compactLiveActivityText,
} from './payload';
import {
  clearEventLiveActivityMarker,
  loadEventLiveActivityMarker,
  saveEventLiveActivityMarker,
  type EventLiveActivityMarker,
} from './storage';
import {
  EVENT_LIVE_ACTIVITY_MAX_DURATION_MS,
  type EventLiveActivityControlState,
  type EventLiveActivityInput,
  type EventLiveActivityPalette,
  type EventLiveActivityProjection,
  type EventLiveActivityProps,
} from './types';

const ENDED_DISMISSAL_DELAY_MS = 15 * 60 * 1000;
const LIVE_ACTIVITY_IMAGE_COMPRESSION = 0.8;
let operationQueue: Promise<void> = Promise.resolve();

function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function cacheLiveActivityMedia(
  sources: Array<{ key: string; uri?: string; width: number }>,
): Promise<Record<string, string>> {
  if (!widgetsDirectory) return {};
  try {
    const directory = new Directory(new Directory(widgetsDirectory), 'event-live-activity');
    directory.create({ idempotent: true, intermediates: true });
    const cached: Record<string, string> = {};
    const retainedUris = new Set<string>();
    for (const source of sources) {
      if (!source.uri?.startsWith('file://')) continue;
      const sourceFile = new File(source.uri);
      if (!sourceFile.exists) continue;
      const destination = new File(directory, `${source.key}.jpg`);
      const context = ImageManipulator.manipulate(source.uri);
      try {
        const image = await context.resize({ width: source.width }).renderAsync();
        try {
          const result = await image.saveAsync({
            compress: LIVE_ACTIVITY_IMAGE_COMPRESSION,
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
      cached[source.key] = destination.uri;
      retainedUris.add(destination.uri);
    }
    for (const entry of directory.list()) {
      if (entry instanceof File && !retainedUris.has(entry.uri)) entry.delete();
    }
    return cached;
  } catch (error) {
    console.warn('Failed to cache Event Live Activity media', error);
    return {};
  }
}

async function buildProps(
  projection: EventLiveActivityProjection,
  input: EventLiveActivityInput,
  now: Date,
  phase: EventLiveActivityProps['phase'] = projection.phase,
): Promise<EventLiveActivityProps> {
  const eventTitle = compactLiveActivityText(projection.event.title, 72) ?? '活动';
  const rawSessionTitle = compactLiveActivityText(projection.session.title, 56);
  const sessionTitle = rawSessionTitle && rawSessionTitle !== eventTitle
    ? rawSessionTitle
    : undefined;
  const currentTitle = compactLiveActivityText(projection.currentEntry?.entry.title, 72);
  const nextTitle = compactLiveActivityText(projection.nextEntry?.entry.title, 48);
  const currentArtistId = projection.currentEntry?.entry.artist_id;
  const nextArtistId = projection.nextEntry?.entry.artist_id;
  const nextEntryInitial = nextTitle ? Array.from(nextTitle.trim())[0] : undefined;
  const showsElapsedTime = phase === 'running' && projection.usesDefaultEndTime;
  const cachedMedia = await cacheLiveActivityMedia([
    { key: 'event', uri: input.eventImageUri, width: 240 },
    {
      key: 'artist',
      uri: currentArtistId ? input.artistAvatarUris?.[currentArtistId] : undefined,
      width: 96,
    },
    {
      key: 'nextArtist',
      uri: nextArtistId ? input.artistAvatarUris?.[nextArtistId] : undefined,
      width: 96,
    },
  ]);
  const props: EventLiveActivityProps = {
    phase,
    eventTitle,
    sessionTitle,
    hasTimetable: projection.hasTimedEntries,
    currentEntryTitle: currentTitle,
    nextEntryTitle: phase === 'ended' ? undefined : nextTitle,
    nextEntryInitial: phase === 'ended' ? undefined : nextEntryInitial,
    primaryTitle: phase === 'ended'
      ? '活动已结束'
      : projection.hasTimedEntries
        ? currentTitle ?? sessionTitle ?? eventTitle
        : eventTitle,
    nextLabel: phase === 'ended' || !projection.nextEntry || !nextTitle
      ? undefined
      : `下一项 ${formatLiveActivityClock(projection.nextEntry.startAt)} ${nextTitle}`,
    currentArtistAvatarUri: cachedMedia.artist,
    nextArtistAvatarUri: cachedMedia.nextArtist,
    eventImageUri: cachedMedia.event,
    countdownTargetAt: phase === 'ended' ? undefined : projection.countdownTargetAt,
    countdownKind: projection.countdownKind,
    timerStartAt: showsElapsedTime ? projection.sessionStartsAt : undefined,
    timerMode: showsElapsedTime ? 'elapsed' : 'countdown',
    updatedAt: now.getTime(),
    lightBackground: input.lightPalette.background,
    darkBackground: input.darkPalette.background,
    lightAccent: input.lightPalette.accent,
    darkAccent: input.darkPalette.accent,
  };
  assertEventLiveActivityPayloadFits(props);
  return props;
}

async function endAllImmediately(): Promise<void> {
  const instances = EventLiveActivity.getInstances();
  await Promise.all(instances.map((instance) => instance.end('immediate')));
}

function unavailableState(reason: string, nextEligibleAt?: number): EventLiveActivityControlState {
  if (reason === 'too-early' && nextEligibleAt != null) {
    return { status: 'too-early', nextEligibleAt };
  }
  if (reason === 'missing-time') return { status: 'missing-time' };
  if (reason === 'ended') return { status: 'ended' };
  return { status: 'ineligible' };
}

async function ensureInternal(
  input: EventLiveActivityInput,
  options: { force?: boolean; now?: Date } = {},
): Promise<EventLiveActivityControlState> {
  const now = options.now ?? new Date();
  const projection = projectEventLiveActivity(input.event, input.sessions, input.timetables, now);
  if (projection.availability !== 'available') {
    return unavailableState(projection.reason, projection.nextEligibleAt);
  }

  const marker = await loadEventLiveActivityMarker();
  const instances = EventLiveActivity.getInstances();
  const sameSession = marker?.eventId === input.event.id
    && marker.sessionId === projection.session.id;

  if (sameSession && !options.force) {
    if (marker.state === 'closed' || instances.length === 0) {
      const expired = now.getTime() >= marker.activityExpiresAt
        && now.getTime() < marker.effectiveEndAt;
      return { status: expired ? 'expired' : 'closed', sessionId: marker.sessionId };
    }
    const [primaryInstance, ...duplicateInstances] = instances;
    if (duplicateInstances.length > 0) {
      await Promise.all(duplicateInstances.map((instance) => instance.end('immediate')));
    }
    await primaryInstance.update(await buildProps(projection, input, now));
    return { status: 'active', sessionId: marker.sessionId };
  }

  if (instances.length > 0) await endAllImmediately();
  const props = await buildProps(projection, input, now);
  const instance = EventLiveActivity.start(props, `otalog:///events/${projection.event.id}`);
  const nextMarker: EventLiveActivityMarker = {
    eventId: input.event.id,
    sessionId: projection.session.id,
    startedAt: now.getTime(),
    effectiveEndAt: projection.sessionEndsAt,
    activityExpiresAt: Math.min(
      projection.sessionEndsAt,
      now.getTime() + EVENT_LIVE_ACTIVITY_MAX_DURATION_MS,
    ),
    state: 'active',
  };
  try {
    await saveEventLiveActivityMarker(nextMarker);
  } catch (error) {
    await instance.end('immediate');
    throw error;
  }
  return { status: 'active', sessionId: projection.session.id };
}

export function ensureEventLiveActivity(
  input: EventLiveActivityInput,
  options?: { force?: boolean; now?: Date },
): Promise<EventLiveActivityControlState> {
  return runExclusive(async () => {
    try {
      return await ensureInternal(input, options);
    } catch (error) {
      console.warn('Failed to start or update the event Live Activity', error);
      return { status: 'unavailable' };
    }
  });
}

export function closeEventLiveActivity(
  input: EventLiveActivityInput,
  now = new Date(),
): Promise<EventLiveActivityControlState> {
  return runExclusive(async () => {
    try {
      const projection = projectEventLiveActivity(input.event, input.sessions, input.timetables, now);
      const existing = await loadEventLiveActivityMarker();
      if (!existing || existing.eventId !== input.event.id) {
        return { status: 'unavailable' };
      }
      if (projection.availability !== 'available') {
        await endAllImmediately();
        await clearEventLiveActivityMarker();
        return unavailableState(projection.reason, projection.nextEligibleAt);
      }
      if (existing.sessionId !== projection.session.id) {
        return { status: 'unavailable' };
      }
      if (existing.state === 'closed') {
        return { status: 'closed', sessionId: existing.sessionId };
      }

      await endAllImmediately();
      await saveEventLiveActivityMarker({
        ...existing,
        effectiveEndAt: projection.sessionEndsAt,
        activityExpiresAt: Math.min(existing.activityExpiresAt, projection.sessionEndsAt),
        state: 'closed',
      });
      return { status: 'closed', sessionId: projection.session.id };
    } catch (error) {
      console.warn('Failed to close the event Live Activity', error);
      return { status: 'unavailable' };
    }
  });
}

async function loadInput(
  repositories: Repositories,
  event: Event,
  palettes: { lightPalette: EventLiveActivityPalette; darkPalette: EventLiveActivityPalette },
): Promise<EventLiveActivityInput> {
  const sessions = await repositories.eventSchedules.findSessions(event.id);
  const entries = await Promise.all(
    sessions.map((session) => repositories.eventSchedules.findTimetable(session.id)),
  );
  const artistIds = [...new Set(entries.flatMap((items) => (
    items.flatMap((item) => item.artist_id ? [item.artist_id] : [])
  )))];
  const [artists, photos] = await Promise.all([
    Promise.all(artistIds.map((artistId) => repositories.artists.findById(artistId))),
    repositories.photos.findByEventId(event.id),
  ]);
  return {
    event,
    sessions,
    timetables: Object.fromEntries(sessions.map((session, index) => [session.id, entries[index]])),
    artistAvatarUris: Object.fromEntries(artists.flatMap((artist) => (
      artist?.avatar_uri ? [[artist.id, artist.avatar_uri]] : []
    ))),
    eventImageUri: photos[0]?.local_uri,
    ...palettes,
  };
}

export function reconcileEventLiveActivity(
  repositories: Repositories,
  palettes: { lightPalette: EventLiveActivityPalette; darkPalette: EventLiveActivityPalette },
  now = new Date(),
): Promise<void> {
  return runExclusive(async () => {
    try {
      const marker = await loadEventLiveActivityMarker();
      const instances = EventLiveActivity.getInstances();
      if (!marker) {
        if (instances.length > 0) await endAllImmediately();
        return;
      }

      const event = await repositories.events.findById(marker.eventId);
      if (!event) {
        if (instances.length > 0) await endAllImmediately();
        await clearEventLiveActivityMarker();
        return;
      }
      const input = await loadInput(repositories, event, palettes);
      const projection = projectEventLiveActivity(event, input.sessions, input.timetables, now);

      if (projection.availability !== 'available') {
        if (instances.length > 0) {
          if (projection.reason === 'ended') {
            const previous = projectEventLiveActivity(
              event,
              input.sessions,
              input.timetables,
              new Date(Math.max(marker.startedAt, marker.effectiveEndAt - 1000)),
            );
            if (previous.availability === 'available') {
              const finalProps = await buildProps(previous, input, now, 'ended');
              await Promise.all(instances.map((instance) => instance.end(
                after(new Date(now.getTime() + ENDED_DISMISSAL_DELAY_MS)),
                finalProps,
                now,
              )));
            } else {
              await endAllImmediately();
            }
          } else {
            await endAllImmediately();
          }
        }
        await clearEventLiveActivityMarker();
        return;
      }

      if (marker.state === 'closed') {
        if (instances.length > 0) await endAllImmediately();
        return;
      }
      if (now.getTime() >= marker.activityExpiresAt && now.getTime() < projection.sessionEndsAt) {
        if (instances.length > 0) await endAllImmediately();
        await saveEventLiveActivityMarker({ ...marker, state: 'closed' });
        return;
      }
      if (instances.length === 0) return;

      const [primaryInstance, ...duplicateInstances] = instances;
      if (duplicateInstances.length > 0) {
        await Promise.all(duplicateInstances.map((instance) => instance.end('immediate')));
      }

      const nextMarker: EventLiveActivityMarker = {
        ...marker,
        eventId: event.id,
        sessionId: projection.session.id,
        effectiveEndAt: projection.sessionEndsAt,
        activityExpiresAt: Math.min(marker.activityExpiresAt, projection.sessionEndsAt),
        state: 'active',
      };
      await primaryInstance.update(await buildProps(projection, input, now));
      await saveEventLiveActivityMarker(nextMarker);
    } catch (error) {
      console.warn('Failed to reconcile the event Live Activity', error);
    }
  });
}

import { ChekiItem, ChekiItemImage, ChekiRecord } from '../types/models';
import { DEFAULT_CHEKI_ASPECT_RATIO } from './chekiV2Schema';

export interface LegacyChekiRow {
  id: string;
  event_id: string | null;
  artist_id: string | null;
  photo_uri: string;
  date: string | null;
  price: number | null;
  notes: string | null;
  created_at: string;
}

export interface LegacyChekiManualEntryRow {
  id: string;
  artist_id: string | null;
  event_id: string | null;
  date: string | null;
  count: number;
  total_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface LegacyChekiMigrationInput {
  cheki: LegacyChekiRow[];
  manualEntries: LegacyChekiManualEntryRow[];
  eventDatesById: ReadonlyMap<string, string>;
}

export interface MigratedChekiData {
  records: ChekiRecord[];
  items: ChekiItem[];
  images: ChekiItemImage[];
}

export interface LegacyChekiMigrationDependencies {
  generateId: () => string;
}

interface LegacyChekiCandidate {
  sourceKind: 'photo' | 'manual';
  sourceId: string;
  artistId: string | null;
  eventId: string | null;
  effectiveDate: string;
  quantity: number;
  unitPrices: number[];
  photoUri: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toWholeYuan(value: number | null): number {
  if (value == null || !Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

function distributeTotalPrice(totalPrice: number | null, quantity: number): number[] {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const wholeTotal = toWholeYuan(totalPrice);
  const base = Math.floor(wholeTotal / safeQuantity);
  const remainder = wholeTotal % safeQuantity;
  return Array.from(
    { length: safeQuantity },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function compareCandidates(left: LegacyChekiCandidate, right: LegacyChekiCandidate): number {
  return left.effectiveDate.localeCompare(right.effectiveDate)
    || left.createdAt.localeCompare(right.createdAt)
    || left.sourceKind.localeCompare(right.sourceKind)
    || left.sourceId.localeCompare(right.sourceId);
}

function effectiveDate(
  date: string | null,
  eventId: string | null,
  createdAt: string,
  eventDatesById: ReadonlyMap<string, string>,
): string {
  return date ?? (eventId ? eventDatesById.get(eventId) : undefined) ?? createdAt.slice(0, 10);
}

function groupKey(candidate: LegacyChekiCandidate): string {
  if (candidate.artistId == null) {
    return `source:${candidate.sourceKind}:${candidate.sourceId}`;
  }
  if (candidate.eventId != null) {
    return `event:${candidate.eventId}:${candidate.artistId}:${candidate.effectiveDate}`;
  }
  return `date:${candidate.effectiveDate}:${candidate.artistId}`;
}

export function migrateLegacyChekiData(
  input: LegacyChekiMigrationInput,
  dependencies: LegacyChekiMigrationDependencies,
): MigratedChekiData {
  const candidates: LegacyChekiCandidate[] = [
    ...input.cheki.map((row): LegacyChekiCandidate => ({
      sourceKind: 'photo',
      sourceId: row.id,
      artistId: row.artist_id,
      eventId: row.event_id,
      effectiveDate: effectiveDate(row.date, row.event_id, row.created_at, input.eventDatesById),
      quantity: 1,
      unitPrices: [toWholeYuan(row.price)],
      photoUri: row.photo_uri,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.created_at,
    })),
    ...input.manualEntries.map((row): LegacyChekiCandidate => ({
      sourceKind: 'manual',
      sourceId: row.id,
      artistId: row.artist_id,
      eventId: row.event_id,
      effectiveDate: effectiveDate(row.date, row.event_id, row.created_at, input.eventDatesById),
      quantity: row.count,
      unitPrices: distributeTotalPrice(row.total_price, row.count),
      photoUri: null,
      notes: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  ].sort(compareCandidates);

  const groups = new Map<string, LegacyChekiCandidate[]>();
  for (const candidate of candidates) {
    const key = groupKey(candidate);
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }

  const records: ChekiRecord[] = [];
  const items: ChekiItem[] = [];
  const images: ChekiItemImage[] = [];

  for (const group of groups.values()) {
    const first = group[0];
    const recordId = dependencies.generateId();
    const record: ChekiRecord = {
      id: recordId,
      event_id: first.eventId,
      artist_id: first.artistId,
      date: first.effectiveDate,
      quantity: group.reduce((sum, candidate) => sum + candidate.quantity, 0),
      notes: null,
      created_at: group.reduce(
        (earliest, candidate) => candidate.createdAt < earliest ? candidate.createdAt : earliest,
        first.createdAt,
      ),
      updated_at: group.reduce(
        (latest, candidate) => candidate.updatedAt > latest ? candidate.updatedAt : latest,
        first.updatedAt,
      ),
    };
    records.push(record);

    let sortOrder = 0;
    for (const candidate of group) {
      for (let index = 0; index < candidate.quantity; index += 1) {
        const isPhotoItem = candidate.sourceKind === 'photo' && index === 0;
        const item: ChekiItem = {
          id: isPhotoItem ? candidate.sourceId : dependencies.generateId(),
          record_id: recordId,
          sort_order: sortOrder,
          unit_price: candidate.unitPrices[index] ?? 0,
          display_aspect_ratio: DEFAULT_CHEKI_ASPECT_RATIO,
          is_favorite: 0,
          notes: isPhotoItem ? candidate.notes : null,
          created_at: candidate.createdAt,
          updated_at: candidate.updatedAt,
        };
        items.push(item);
        if (isPhotoItem && candidate.photoUri != null) {
          images.push({
            id: dependencies.generateId(),
            item_id: item.id,
            side: 'front',
            photo_uri: candidate.photoUri,
            created_at: candidate.createdAt,
            updated_at: candidate.createdAt,
          });
        }
        sortOrder += 1;
      }
    }
  }

  return { records, items, images };
}

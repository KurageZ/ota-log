import { SQLiteDatabase } from 'expo-sqlite';
import {
  ChekiImageSide,
  ChekiItem,
  ChekiItemImage,
  ChekiRecord,
} from '../types/models';
import { DEFAULT_CHEKI_ASPECT_RATIO } from '../db/chekiV2Schema';
import { generateId } from '../utils/uuid';
import { toISODateTime } from '../utils/date';

export interface CreateChekiRecordInput {
  event_id?: string | null;
  artist_id?: string | null;
  date?: string | null;
  quantity: number;
  unit_price?: number;
  notes?: string | null;
}

export type UpdateChekiRecordInput = Partial<Omit<CreateChekiRecordInput, 'unit_price'>>;

export interface AddChekiItemInput {
  frontUri?: string;
  backUri?: string;
  unitPrice?: number;
  displayAspectRatio?: number;
  notes?: string | null;
}

export interface CreateChekiRecordWithItemsInput extends CreateChekiRecordInput {
  items?: AddChekiItemInput[];
}

export interface ChekiRecordItemChanges {
  add?: AddChekiItemInput[];
  removeItemIds?: string[];
  defaultUnitPrice?: number;
}

export interface UpdateChekiItemInput {
  unitPrice?: number;
  displayAspectRatio?: number;
  notes?: string | null;
}

export interface UpdateChekiItemWithImagesInput extends UpdateChekiItemInput {
  isFavorite?: boolean;
  images?: Partial<Record<ChekiImageSide, string | null>>;
}

export interface ChekiItemWithImages extends ChekiItem {
  images: ChekiItemImage[];
}

export interface ChekiRecordWithItems extends ChekiRecord {
  items: ChekiItemWithImages[];
}

export interface ChekiRecordFilter {
  artistId?: string;
  eventId?: string;
  date?: string;
  year?: number;
  month?: number;
}

export interface ChekiStatistics {
  quantity: number;
  totalPrice: number;
  archivedItems: number;
  images: number;
  favorites: number;
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Cheki record quantity must be an integer greater than or equal to 1');
  }
}

function assertUnitPrice(unitPrice: number | undefined): void {
  if (
    unitPrice != null
    && (!Number.isInteger(unitPrice) || !Number.isFinite(unitPrice) || unitPrice < 0)
  ) {
    throw new Error('Cheki item unit_price must be a non-negative integer');
  }
}

function assertAspectRatio(ratio: number): void {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error('Cheki item display aspect ratio must be greater than 0');
  }
}

export class ChekiRecordRepository {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly createId: () => string = generateId,
  ) {}

  async createRecord(input: CreateChekiRecordInput): Promise<ChekiRecord> {
    return this.createRecordWithItems(input);
  }

  async createRecordWithItems(
    input: CreateChekiRecordWithItemsInput,
  ): Promise<ChekiRecordWithItems> {
    const items = input.items ?? [];
    if (items.length > input.quantity) {
      throw new Error('Cheki item count cannot exceed record quantity');
    }
    let created: ChekiRecordWithItems | null = null;
    await this.db.withTransactionAsync(async () => {
      assertUnitPrice(input.unit_price);
      const record = await this.insertRecord(input);
      const createdItems: ChekiItemWithImages[] = [];
      for (let index = 0; index < input.quantity; index += 1) {
        const item = items[index] ?? {};
        createdItems.push(await this.insertItem(record.id, {
          ...item,
          unitPrice: item.unitPrice ?? input.unit_price ?? 0,
        }));
      }
      created = { ...record, items: createdItems };
    });
    if (!created) throw new Error('Failed to create cheki record');
    return created;
  }

  private async insertRecord(input: CreateChekiRecordInput): Promise<ChekiRecord> {
    assertQuantity(input.quantity);
    const now = toISODateTime();
    const record: ChekiRecord = {
      id: this.createId(),
      event_id: input.event_id ?? null,
      artist_id: input.artist_id ?? null,
      date: input.date ?? null,
      quantity: input.quantity,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO cheki_records
         (id, event_id, artist_id, date, quantity, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.event_id,
        record.artist_id,
        record.date,
        record.quantity,
        record.notes,
        record.created_at,
        record.updated_at,
      ],
    );
    return record;
  }

  private async updateRecord(id: string, input: UpdateChekiRecordInput): Promise<void> {
    if ('quantity' in input) {
      if (input.quantity == null) {
        throw new Error('Cheki record quantity is required');
      }
      assertQuantity(input.quantity);
      const count = await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM cheki_items WHERE record_id = ?',
        [id],
      );
      if (input.quantity < (count?.count ?? 0)) {
        throw new Error('Cheki quantity cannot be below the archived item count');
      }
    }
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const mappings: Array<[keyof UpdateChekiRecordInput, string]> = [
      ['event_id', 'event_id'],
      ['artist_id', 'artist_id'],
      ['date', 'date'],
      ['quantity', 'quantity'],
      ['notes', 'notes'],
    ];
    for (const [key, column] of mappings) {
      if (key in input) {
        fields.push(`${column} = ?`);
        values.push(input[key] ?? null);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(toISODateTime(), id);
    await this.db.runAsync(
      `UPDATE cheki_records SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
  }

  async deleteRecord(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM cheki_records WHERE id = ?', [id]);
  }

  async addItem(recordId: string, input: AddChekiItemInput): Promise<ChekiItemWithImages> {
    let created: ChekiItemWithImages | null = null;
    await this.db.withTransactionAsync(async () => {
      assertUnitPrice(input.unitPrice);
      await this.db.runAsync(
        'UPDATE cheki_records SET quantity = quantity + 1, updated_at = ? WHERE id = ?',
        [toISODateTime(), recordId],
      );
      created = await this.insertItem(recordId, input);
    });
    if (!created) throw new Error('Failed to create cheki item');
    return created;
  }

  async updateRecordWithItemChanges(
    id: string,
    input: UpdateChekiRecordInput,
    changes: ChekiRecordItemChanges,
  ): Promise<void> {
    const itemsToPopulate = changes.add ?? [];
    const removeItemIds = [...new Set(changes.removeItemIds ?? [])];
    assertUnitPrice(changes.defaultUnitPrice);
    await this.db.withTransactionAsync(async () => {
      const currentRecord = await this.db.getFirstAsync<ChekiRecord>(
        'SELECT * FROM cheki_records WHERE id = ?',
        [id],
      );
      if (!currentRecord) throw new Error('Cheki record not found');
      const targetQuantity = input.quantity ?? currentRecord.quantity;
      assertQuantity(targetQuantity);

      for (const itemId of removeItemIds) {
        const item = await this.db.getFirstAsync<{ id: string }>(
          'SELECT id FROM cheki_items WHERE id = ? AND record_id = ?',
          [itemId, id],
        );
        if (!item) throw new Error('Cheki item does not belong to the record');
        await this.db.runAsync(
          'DELETE FROM cheki_items WHERE id = ? AND record_id = ?',
          [itemId, id],
        );
      }

      let remainingItems = await this.findItems('i.record_id = ?', [id]);
      if (remainingItems.length > targetQuantity) {
        const removable = [...remainingItems]
          .reverse()
          .filter((item) => item.images.length === 0)
          .slice(0, remainingItems.length - targetQuantity);
        if (removable.length !== remainingItems.length - targetQuantity) {
          throw new Error('Cheki quantity cannot remove items that still have images');
        }
        for (const item of removable) {
          await this.db.runAsync('DELETE FROM cheki_items WHERE id = ?', [item.id]);
        }
        remainingItems = await this.findItems('i.record_id = ?', [id]);
      }

      await this.updateRecord(id, { ...input, quantity: targetQuantity });

      while (remainingItems.length < targetQuantity) {
        remainingItems.push(await this.insertItem(id, {
          unitPrice: changes.defaultUnitPrice ?? 0,
        }));
      }

      const emptyItems = remainingItems.filter((item) => item.images.length === 0);
      if (itemsToPopulate.length > emptyItems.length) {
        throw new Error('Cheki record has no remaining item capacity');
      }
      for (let index = 0; index < itemsToPopulate.length; index += 1) {
        const target = emptyItems[index];
        const item = itemsToPopulate[index];
        await this.updateItem(target.id, {
          unitPrice: item.unitPrice,
          displayAspectRatio: item.displayAspectRatio,
          notes: item.notes,
        });
        if (item.frontUri) await this.addOrReplaceItemImage(target.id, 'front', item.frontUri);
        if (item.backUri) await this.addOrReplaceItemImage(target.id, 'back', item.backUri);
      }
    });
  }

  async findLatestUnitPriceByArtistId(artistId: string): Promise<number | null> {
    const row = await this.db.getFirstAsync<{ unit_price: number }>(
      `SELECT i.unit_price
       FROM cheki_items i
       JOIN cheki_records r ON r.id = i.record_id
       WHERE r.artist_id = ?
       ORDER BY COALESCE(r.date, r.created_at) DESC, r.created_at DESC,
                i.sort_order DESC, i.id DESC
       LIMIT 1`,
      [artistId],
    );
    return row?.unit_price ?? null;
  }

  private async insertItem(
    recordId: string,
    input: AddChekiItemInput,
  ): Promise<ChekiItemWithImages> {
    assertUnitPrice(input.unitPrice);
    const ratio = input.displayAspectRatio ?? DEFAULT_CHEKI_ASPECT_RATIO;
    assertAspectRatio(ratio);

    const record = await this.db.getFirstAsync<ChekiRecord>(
      'SELECT * FROM cheki_records WHERE id = ?',
      [recordId],
    );
    if (!record) throw new Error('Cheki record not found');
    const count = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM cheki_items WHERE record_id = ?',
      [recordId],
    );
    if ((count?.count ?? 0) >= record.quantity) {
      throw new Error('Cheki record has no remaining item capacity');
    }
    const nextOrder = await this.db.getFirstAsync<{ next_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM cheki_items WHERE record_id = ?',
      [recordId],
    );
    const now = toISODateTime();
    const item: ChekiItem = {
      id: this.createId(),
      record_id: recordId,
      sort_order: nextOrder?.next_order ?? 0,
      unit_price: input.unitPrice ?? 0,
      display_aspect_ratio: ratio,
      is_favorite: 0,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO cheki_items
         (id, record_id, sort_order, unit_price, display_aspect_ratio, is_favorite, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.record_id,
        item.sort_order,
        item.unit_price,
        item.display_aspect_ratio,
        item.is_favorite,
        item.notes,
        item.created_at,
        item.updated_at,
      ],
    );
    const images: ChekiItemImage[] = [];
    for (const [side, uri] of [['front', input.frontUri], ['back', input.backUri]] as const) {
      if (!uri) continue;
      const image: ChekiItemImage = {
        id: this.createId(),
        item_id: item.id,
        side,
        photo_uri: uri,
        created_at: now,
        updated_at: now,
      };
      await this.db.runAsync(
        `INSERT INTO cheki_item_images
           (id, item_id, side, photo_uri, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [image.id, image.item_id, image.side, image.photo_uri, image.created_at, image.updated_at],
      );
      images.push(image);
    }
    return { ...item, images };
  }

  async updateItem(id: string, input: UpdateChekiItemInput): Promise<void> {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    if ('unitPrice' in input && input.unitPrice != null) {
      assertUnitPrice(input.unitPrice);
      fields.push('unit_price = ?');
      values.push(input.unitPrice);
    }
    if ('displayAspectRatio' in input && input.displayAspectRatio != null) {
      assertAspectRatio(input.displayAspectRatio);
      fields.push('display_aspect_ratio = ?');
      values.push(input.displayAspectRatio);
    }
    if ('notes' in input) {
      fields.push('notes = ?');
      values.push(input.notes ?? null);
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(toISODateTime(), id);
    await this.db.runAsync(`UPDATE cheki_items SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async setItemFavorite(id: string, isFavorite: boolean): Promise<void> {
    await this.db.runAsync(
      'UPDATE cheki_items SET is_favorite = ?, updated_at = ? WHERE id = ?',
      [isFavorite ? 1 : 0, toISODateTime(), id],
    );
  }

  async updateItemWithImages(
    id: string,
    input: UpdateChekiItemWithImagesInput,
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const item = await this.findItemById(id);
      if (!item) throw new Error('Cheki item not found');

      const currentUris = new Map(item.images.map((image) => [image.side, image.photo_uri]));
      if (currentUris.has('front') && input.images?.front === null) {
        throw new Error('A cheki front image cannot be removed');
      }
      await this.updateItem(id, input);
      if ('isFavorite' in input) {
        await this.setItemFavorite(id, input.isFavorite === true);
      }

      // Add replacements before removals so an image side can be changed atomically.
      for (const side of ['front', 'back'] as const) {
        const nextUri = input.images?.[side];
        if (nextUri) await this.addOrReplaceItemImage(id, side, nextUri);
      }
      for (const side of ['front', 'back'] as const) {
        if (input.images?.[side] === null) {
          await this.removeItemImage(id, side);
        }
      }
    });
  }

  async addOrReplaceItemImage(
    itemId: string,
    side: ChekiImageSide,
    permanentUri: string,
  ): Promise<ChekiItemImage> {
    const item = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM cheki_items WHERE id = ?',
      [itemId],
    );
    if (!item) throw new Error('Cheki item not found');
    const existing = await this.db.getFirstAsync<ChekiItemImage>(
      'SELECT * FROM cheki_item_images WHERE item_id = ? AND side = ?',
      [itemId, side],
    );
    const now = toISODateTime();
    const image: ChekiItemImage = {
      id: existing?.id ?? this.createId(),
      item_id: itemId,
      side,
      photo_uri: permanentUri,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO cheki_item_images
         (id, item_id, side, photo_uri, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id, side) DO UPDATE SET
         photo_uri = excluded.photo_uri,
         updated_at = excluded.updated_at`,
      [image.id, image.item_id, image.side, image.photo_uri, image.created_at, image.updated_at],
    );
    return image;
  }

  async removeItemImage(
    itemId: string,
    side: ChekiImageSide,
  ): Promise<{ removed: boolean; itemDeleted: boolean }> {
    if (side === 'front') {
      throw new Error('A cheki front image cannot be removed');
    }
    const existing = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM cheki_item_images WHERE item_id = ? AND side = ?',
      [itemId, side],
    );
    if (!existing) return { removed: false, itemDeleted: false };
    await this.db.runAsync(
      'DELETE FROM cheki_item_images WHERE item_id = ? AND side = ?',
      [itemId, side],
    );
    const item = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM cheki_items WHERE id = ?',
      [itemId],
    );
    return { removed: true, itemDeleted: item == null };
  }

  async deleteItem(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const item = await this.db.getFirstAsync<{ record_id: string; quantity: number }>(
        `SELECT i.record_id, r.quantity
         FROM cheki_items i
         JOIN cheki_records r ON r.id = i.record_id
         WHERE i.id = ?`,
        [id],
      );
      if (!item) throw new Error('Cheki item not found');
      if (item.quantity <= 1) {
        await this.db.runAsync('DELETE FROM cheki_records WHERE id = ?', [item.record_id]);
        return;
      }
      await this.db.runAsync('DELETE FROM cheki_items WHERE id = ?', [id]);
      await this.db.runAsync(
        'UPDATE cheki_records SET quantity = quantity - 1, updated_at = ? WHERE id = ?',
        [toISODateTime(), item.record_id],
      );
    });
  }

  async findRecordById(id: string): Promise<ChekiRecordWithItems | null> {
    const record = await this.db.getFirstAsync<ChekiRecord>(
      'SELECT * FROM cheki_records WHERE id = ?',
      [id],
    );
    if (!record) return null;
    return { ...record, items: await this.findItemsForRecords([id]) };
  }

  async findRecords(filter: ChekiRecordFilter = {}): Promise<ChekiRecordWithItems[]> {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (filter.artistId) {
      clauses.push('artist_id = ?');
      params.push(filter.artistId);
    }
    if (filter.eventId) {
      clauses.push('event_id = ?');
      params.push(filter.eventId);
    }
    if (filter.date) {
      clauses.push("strftime('%Y-%m-%d', COALESCE(date, created_at)) = ?");
      params.push(filter.date);
    }
    if (filter.year != null) {
      clauses.push(`strftime('${filter.month == null ? '%Y' : '%Y-%m'}', COALESCE(date, created_at)) = ?`);
      params.push(
        filter.month == null
          ? String(filter.year)
          : `${filter.year}-${String(filter.month).padStart(2, '0')}`,
      );
    }
    const records = await this.db.getAllAsync<ChekiRecord>(
      `SELECT * FROM cheki_records
       ${clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY COALESCE(date, created_at) DESC, created_at DESC`,
      params,
    );
    const items = await this.findItemsForRecords(records.map((record) => record.id));
    const byRecord = new Map<string, ChekiItemWithImages[]>();
    for (const item of items) {
      const list = byRecord.get(item.record_id);
      if (list) list.push(item);
      else byRecord.set(item.record_id, [item]);
    }
    return records.map((record) => ({ ...record, items: byRecord.get(record.id) ?? [] }));
  }

  async findItemById(id: string): Promise<ChekiItemWithImages | null> {
    const items = await this.findItems('i.id = ?', [id]);
    return items[0] ?? null;
  }

  async findFavoriteItems(): Promise<ChekiItemWithImages[]> {
    return this.findItems('i.is_favorite = 1', []);
  }

  async getStatistics(filter: ChekiRecordFilter = {}): Promise<ChekiStatistics> {
    const records = await this.findRecords(filter);
    return {
      quantity: records.reduce((sum, record) => sum + record.quantity, 0),
      totalPrice: records.reduce(
        (sum, record) => sum + record.items.reduce((itemSum, item) => itemSum + item.unit_price, 0),
        0,
      ),
      archivedItems: records.reduce(
        (sum, record) => sum + record.items.filter((item) => item.images.length > 0).length,
        0,
      ),
      images: records.reduce(
        (sum, record) => sum + record.items.reduce((itemSum, item) => itemSum + item.images.length, 0),
        0,
      ),
      favorites: records.reduce(
        (sum, record) => sum + record.items.filter((item) => item.is_favorite === 1).length,
        0,
      ),
    };
  }

  private async findItemsForRecords(recordIds: string[]): Promise<ChekiItemWithImages[]> {
    if (recordIds.length === 0) return [];
    return this.findItems(
      `i.record_id IN (${recordIds.map(() => '?').join(', ')})`,
      recordIds,
    );
  }

  private async findItems(
    where: string,
    params: Array<string | number>,
  ): Promise<ChekiItemWithImages[]> {
    const items = await this.db.getAllAsync<ChekiItem>(
      `SELECT i.* FROM cheki_items i
       WHERE ${where}
       ORDER BY i.record_id, i.sort_order, i.created_at, i.id`,
      params,
    );
    if (items.length === 0) return [];
    const images = await this.db.getAllAsync<ChekiItemImage>(
      `SELECT * FROM cheki_item_images
       WHERE item_id IN (${items.map(() => '?').join(', ')})
       ORDER BY item_id, CASE side WHEN 'front' THEN 0 ELSE 1 END, created_at, id`,
      items.map((item) => item.id),
    );
    const byItem = new Map<string, ChekiItemImage[]>();
    for (const image of images) {
      const list = byItem.get(image.item_id);
      if (list) list.push(image);
      else byItem.set(image.item_id, [image]);
    }
    return items.map((item) => ({ ...item, images: byItem.get(item.id) ?? [] }));
  }
}

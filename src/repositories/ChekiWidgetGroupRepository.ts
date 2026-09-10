import type { SQLiteDatabase } from 'expo-sqlite';
import { isChekiSpec, type ChekiSpec } from '../domain/chekiSpec';
import {
  CHEKI_WIDGET_ROTATION_INTERVAL_MS,
  defaultChekiWidgetGroupName,
  isChekiWidgetSlot,
  type ChekiWidgetFilterRules,
  type ChekiWidgetGroupEditorState,
  type ChekiWidgetGroupSource,
  type ChekiWidgetGroupSummary,
  type ChekiWidgetSlot,
  type ResolvedChekiWidgetGroup,
  type ResolvedChekiWidgetItem,
  type SaveChekiWidgetGroupInput,
} from '../types/chekiWidgetGroups';
import { RepositoryChangeEmitter } from './RepositoryChangeEmitter';

const SLOTS: ChekiWidgetSlot[] = [1, 2, 3, 4, 5, 6];
const MAX_ITEMS = 48;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type GroupRow = {
  slot: number; name: string; source_type: 'manual' | 'filter' | null;
  favorite_only: number; date_preset: 'current_month' | 'current_year' | 'custom' | null;
  custom_start_date: string | null; custom_end_date: string | null;
  rotation_anchor_at: string | null; collection_fingerprint: string | null;
};

type ItemRow = { spec: ChekiSpec; id: string; front_photo_uri: string; date: string | null; created_at: string; sort_order: number };

export type ChekiWidgetManualCandidate = { spec: ChekiSpec; id: string; uri: string };

function unique(values: string[]): string[] { return [...new Set(values.map((value) => value.trim()).filter(Boolean))]; }
function placeholders(count: number): string { return Array.from({ length: count }, () => '?').join(', '); }
function alignedRotationAnchor(now: Date): string {
  return new Date(Math.floor(now.getTime() / CHEKI_WIDGET_ROTATION_INTERVAL_MS) * CHEKI_WIDGET_ROTATION_INTERVAL_MS).toISOString();
}
function normalizeSource(source: ChekiWidgetGroupSource): ChekiWidgetGroupSource {
  if (source.type === 'manual') return { type: 'manual', itemIds: unique(source.itemIds) };
  return {
    type: 'filter',
    rules: {
      artistIds: unique(source.rules.artistIds).sort(),
      eventIds: unique(source.rules.eventIds).sort(),
      favoriteOnly: source.rules.favoriteOnly,
      date: source.rules.date ? { ...source.rules.date } : null,
      specs: [...new Set(source.rules.specs)].filter(isChekiSpec).sort(),
    },
  };
}
function sourcesEqual(left: ChekiWidgetGroupSource | null, right: ChekiWidgetGroupSource): boolean {
  return left !== null && JSON.stringify(normalizeSource(left)) === JSON.stringify(right);
}
function dateBounds(date: ChekiWidgetFilterRules['date'], now: Date): [string | null, string | null] {
  if (!date) return [null, null];
  if (date.preset === 'custom') return [date.startDate, date.endDate];
  const year = now.getFullYear();
  if (date.preset === 'current_year') return [`${year}-01-01`, `${year}-12-31`];
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return [`${year}-${month}-01`, `${year}-${month}-${String(lastDay).padStart(2, '0')}`];
}

export class ChekiWidgetGroupRepository {
  private readonly changes = new RepositoryChangeEmitter();
  readonly subscribeToChanges = this.changes.subscribe;

  constructor(private readonly db: SQLiteDatabase) {}

  notifyExternalChange(): void { this.changes.notify(); }
  private assertSlot(slot: ChekiWidgetSlot): void { if (!isChekiWidgetSlot(slot)) throw new Error('Invalid cheki widget group slot'); }

  private async getGroup(slot: ChekiWidgetSlot): Promise<GroupRow> {
    const row = await this.db.getFirstAsync<GroupRow>('SELECT * FROM cheki_widget_groups WHERE slot = ?', [slot]);
    if (!row) throw new Error(`Cheki widget group ${slot} not found`);
    return row;
  }

  private async readSource(row: GroupRow): Promise<ChekiWidgetGroupSource | null> {
    if (!row.source_type) return null;
    if (row.source_type === 'manual') {
      const items = await this.db.getAllAsync<{ item_id: string }>(
        'SELECT item_id FROM cheki_widget_group_manual_items WHERE slot = ? ORDER BY sort_order ASC', [row.slot]);
      return { type: 'manual', itemIds: items.map((item) => item.item_id) };
    }
    const [artists, events, specs] = await Promise.all([
      this.db.getAllAsync<{ artist_id: string }>('SELECT artist_id FROM cheki_widget_group_artists WHERE slot = ? ORDER BY artist_id', [row.slot]),
      this.db.getAllAsync<{ event_id: string }>('SELECT event_id FROM cheki_widget_group_events WHERE slot = ? ORDER BY event_id', [row.slot]),
      this.db.getAllAsync<{ spec: ChekiSpec }>('SELECT spec FROM cheki_widget_group_specs WHERE slot = ? ORDER BY spec', [row.slot]),
    ]);
    return {
      type: 'filter',
      rules: {
        artistIds: artists.map((item) => item.artist_id), eventIds: events.map((item) => item.event_id),
        favoriteOnly: row.favorite_only === 1,
        date: row.date_preset === 'custom' && row.custom_start_date && row.custom_end_date
          ? { preset: 'custom', startDate: row.custom_start_date, endDate: row.custom_end_date }
          : row.date_preset === 'current_month' || row.date_preset === 'current_year'
            ? { preset: row.date_preset }
            : null,
        specs: specs.map((item) => item.spec),
      },
    };
  }

  private async resolveItems(row: GroupRow, source: ChekiWidgetGroupSource, now: Date): Promise<ResolvedChekiWidgetItem[]> {
    if (source.type === 'manual') {
      const ids = unique(source.itemIds).slice(0, MAX_ITEMS);
      if (!ids.length) return [];
      const rows = await this.db.getAllAsync<ItemRow>(
        `SELECT i.id, i.spec, front.photo_uri AS front_photo_uri, r.date, r.created_at, i.sort_order
         FROM cheki_items i JOIN cheki_records r ON r.id = i.record_id
         JOIN cheki_item_images front ON front.item_id = i.id AND front.side = 'front'
         WHERE i.id IN (${placeholders(ids.length)})`, ids);
      const byId = new Map(rows.map((item) => [item.id, item]));
      return ids.flatMap((id) => {
        const item = byId.get(id);
        return item ? [{ id: item.id, spec: item.spec, frontPhotoUri: item.front_photo_uri, date: item.date, createdAt: item.created_at, sortOrder: item.sort_order }] : [];
      });
    }
    const rules = source.rules;
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    if (rules.artistIds.length) { conditions.push(`r.artist_id IN (${placeholders(rules.artistIds.length)})`); params.push(...rules.artistIds); }
    if (rules.eventIds.length) { conditions.push(`r.event_id IN (${placeholders(rules.eventIds.length)})`); params.push(...rules.eventIds); }
    if (rules.favoriteOnly) conditions.push('i.is_favorite = 1');
    if (rules.specs.length) { conditions.push(`i.spec IN (${placeholders(rules.specs.length)})`); params.push(...rules.specs); }
    const [from, to] = dateBounds(rules.date, now);
    if (from && to) { conditions.push(`strftime('%Y-%m-%d', COALESCE(r.date, r.created_at)) BETWEEN ? AND ?`); params.push(from, to); }
    if (!conditions.length) return [];
    const rows = await this.db.getAllAsync<ItemRow>(
      `SELECT i.id, i.spec, front.photo_uri AS front_photo_uri, r.date, r.created_at, i.sort_order
       FROM cheki_items i JOIN cheki_records r ON r.id = i.record_id
       JOIN cheki_item_images front ON front.item_id = i.id AND front.side = 'front'
       WHERE ${conditions.join(' AND ')}
       ORDER BY COALESCE(r.date, r.created_at) DESC, r.created_at DESC, i.sort_order, i.id
       LIMIT ${MAX_ITEMS}`, params);
    return rows.map((item) => ({ id: item.id, spec: item.spec, frontPhotoUri: item.front_photo_uri, date: item.date, createdAt: item.created_at, sortOrder: item.sort_order }));
  }

  private async normalizeFilterIfEmpty(row: GroupRow, source: ChekiWidgetGroupSource): Promise<boolean> {
    if (source.type !== 'filter') return false;
    const rules = source.rules;
    if (rules.artistIds.length || rules.eventIds.length || rules.favoriteOnly || rules.specs.length || rules.date) return false;
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE cheki_widget_groups SET source_type = NULL, favorite_only = 0, date_preset = NULL,
       custom_start_date = NULL, custom_end_date = NULL, rotation_anchor_at = NULL,
       collection_fingerprint = NULL, updated_at = ? WHERE slot = ?`, [now, row.slot]);
    return true;
  }

  private async resolveGroup(slot: ChekiWidgetSlot, now: Date, notifyOnChange = true): Promise<ResolvedChekiWidgetGroup> {
    const row = await this.getGroup(slot);
    const source = await this.readSource(row);
    if (!source) return { slot, name: row.name, sourceType: null, state: 'unconfigured', items: [], collectionFingerprint: null, rotationAnchorAt: null };
    if (await this.normalizeFilterIfEmpty(row, source)) {
      if (notifyOnChange) this.changes.notify();
      return { slot, name: row.name, sourceType: null, state: 'unconfigured', items: [], collectionFingerprint: null, rotationAnchorAt: null };
    }
    const items = await this.resolveItems(row, source, now);
    const fingerprint = JSON.stringify(items.map((item) => item.id));
    let anchor = row.rotation_anchor_at;
    if (fingerprint !== row.collection_fingerprint || !anchor) {
      anchor = alignedRotationAnchor(now);
      await this.db.runAsync(
        'UPDATE cheki_widget_groups SET collection_fingerprint = ?, rotation_anchor_at = ?, updated_at = ? WHERE slot = ?',
        [fingerprint, anchor, now.toISOString(), slot]);
      if (notifyOnChange) this.changes.notify();
    }
    return {
      slot,
      name: row.name,
      sourceType: source.type,
      state: items.length ? 'content' : source.type === 'manual' ? 'unavailable' : 'no_match',
      items,
      collectionFingerprint: fingerprint,
      rotationAnchorAt: anchor,
    };
  }

  async resolveForWidget(now = new Date()): Promise<ResolvedChekiWidgetGroup[]> {
    return Promise.all(SLOTS.map((slot) => this.resolveGroup(slot, now)));
  }
  async listSummaries(now = new Date()): Promise<ChekiWidgetGroupSummary[]> {
    const groups = await this.resolveForWidget(now);
    return groups.map((group) => ({ slot: group.slot, name: group.name, sourceType: group.sourceType, displayCount: group.items.length }));
  }
  async getEditorState(slot: ChekiWidgetSlot, now = new Date()): Promise<ChekiWidgetGroupEditorState> {
    this.assertSlot(slot);
    const row = await this.getGroup(slot);
    const source = await this.readSource(row);
    const resolvedItems = source ? await this.resolveItems(row, source, now) : [];
    return { slot, name: row.name, source, resolvedItems };
  }

  async listManualCandidates(): Promise<ChekiWidgetManualCandidate[]> {
    return this.db.getAllAsync<ChekiWidgetManualCandidate>(
      `SELECT i.id, i.spec, front.photo_uri AS uri
       FROM cheki_items i
       JOIN cheki_item_images front ON front.item_id = i.id AND front.side = 'front'
       ORDER BY i.created_at DESC, i.id`,
    );
  }

  async previewSource(
    slot: ChekiWidgetSlot,
    source: ChekiWidgetGroupSource,
    now = new Date(),
  ): Promise<ResolvedChekiWidgetItem[]> {
    this.assertSlot(slot);
    return this.resolveItems(await this.getGroup(slot), source, now);
  }

  async save(slot: ChekiWidgetSlot, input: SaveChekiWidgetGroupInput, now = new Date()): Promise<void> {
    this.assertSlot(slot);
    const name = input.name.trim();
    if (name.length < 1 || name.length > 20) throw new Error('分组名称需要为 1–20 个字符');
    const source = normalizeSource(input.source);
    if (source.type === 'manual') {
      if (source.itemIds.length > MAX_ITEMS) throw new Error('手动分组最多选择 48 张拍立得');
      if (!source.itemIds.length) throw new Error('手动分组至少选择 1 张拍立得');
    } else {
      if (source.rules.date?.preset === 'custom' &&
        (!DATE_RE.test(source.rules.date.startDate) || !DATE_RE.test(source.rules.date.endDate) || source.rules.date.startDate > source.rules.date.endDate)) {
        throw new Error('自定义日期范围无效');
      }
      if (!source.rules.artistIds.length && !source.rules.eventIds.length && !source.rules.favoriteOnly && !source.rules.specs.length && !source.rules.date) {
        throw new Error('筛选分组至少需要一个条件');
      }
    }
    const existing = await this.db.getFirstAsync<{ slot: number }>('SELECT slot FROM cheki_widget_groups WHERE name = ? COLLATE NOCASE AND slot <> ?', [name, slot]);
    if (existing) throw new Error('分组名称不能重复');
    const row = await this.getGroup(slot);
    const existingSource = await this.readSource(row);
    const resolved = await this.resolveItems(row, source, now);
    if (!resolved.length && !sourcesEqual(existingSource, source)) {
      throw new Error('分组至少需要 1 张当前可展示的正面拍立得');
    }
    const fingerprint = JSON.stringify(resolved.map((item) => item.id));
    const previousFingerprint = row.collection_fingerprint ?? (existingSource
      ? JSON.stringify((await this.resolveItems(row, existingSource, now)).map((item) => item.id))
      : null);
    const anchor = previousFingerprint !== fingerprint || !row.rotation_anchor_at
      ? alignedRotationAnchor(now)
      : row.rotation_anchor_at;
    await this.db.withTransactionAsync(async () => {
      const timestamp = now.toISOString();
      await this.db.runAsync(
        `UPDATE cheki_widget_groups SET name = ?, source_type = ?, favorite_only = ?, date_preset = ?,
         custom_start_date = ?, custom_end_date = ?, rotation_anchor_at = ?, collection_fingerprint = ?, updated_at = ? WHERE slot = ?`,
        [name, source.type, source.type === 'filter' && source.rules.favoriteOnly ? 1 : 0,
          source.type === 'filter' ? source.rules.date?.preset ?? null : null,
          source.type === 'filter' && source.rules.date?.preset === 'custom' ? source.rules.date.startDate : null,
          source.type === 'filter' && source.rules.date?.preset === 'custom' ? source.rules.date.endDate : null,
          anchor, fingerprint, timestamp, slot]);
      await this.db.runAsync('DELETE FROM cheki_widget_group_manual_items WHERE slot = ?', [slot]);
      await this.db.runAsync('DELETE FROM cheki_widget_group_artists WHERE slot = ?', [slot]);
      await this.db.runAsync('DELETE FROM cheki_widget_group_events WHERE slot = ?', [slot]);
      await this.db.runAsync('DELETE FROM cheki_widget_group_specs WHERE slot = ?', [slot]);
      if (source.type === 'manual') for (const [sortOrder, itemId] of source.itemIds.entries()) {
        await this.db.runAsync('INSERT INTO cheki_widget_group_manual_items (slot, item_id, sort_order) VALUES (?, ?, ?)', [slot, itemId, sortOrder]);
      }
      if (source.type === 'filter') {
        for (const artistId of source.rules.artistIds) await this.db.runAsync('INSERT INTO cheki_widget_group_artists (slot, artist_id) VALUES (?, ?)', [slot, artistId]);
        for (const eventId of source.rules.eventIds) await this.db.runAsync('INSERT INTO cheki_widget_group_events (slot, event_id) VALUES (?, ?)', [slot, eventId]);
        for (const spec of source.rules.specs) await this.db.runAsync('INSERT INTO cheki_widget_group_specs (slot, spec) VALUES (?, ?)', [slot, spec]);
      }
    });
    this.changes.notify();
  }

  async reset(slot: ChekiWidgetSlot, now = new Date()): Promise<void> {
    this.assertSlot(slot);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM cheki_widget_group_manual_items WHERE slot = ?', [slot]);
      await this.db.runAsync('DELETE FROM cheki_widget_group_artists WHERE slot = ?', [slot]);
      await this.db.runAsync('DELETE FROM cheki_widget_group_events WHERE slot = ?', [slot]);
      await this.db.runAsync('DELETE FROM cheki_widget_group_specs WHERE slot = ?', [slot]);
      await this.db.runAsync(
        `UPDATE cheki_widget_groups SET name = ?, source_type = NULL, favorite_only = 0, date_preset = NULL,
         custom_start_date = NULL, custom_end_date = NULL, rotation_anchor_at = NULL, collection_fingerprint = NULL, updated_at = ? WHERE slot = ?`,
        [defaultChekiWidgetGroupName(slot), now.toISOString(), slot]);
    });
    this.changes.notify();
  }
}

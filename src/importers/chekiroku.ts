import JSZip from 'jszip';
import * as SQLite from 'expo-sqlite';
import { SQLiteDatabase } from 'expo-sqlite';
import type { Artist } from '../types/models';
import { DEFAULT_CHEKI_SPEC } from '../domain/chekiSpec';
import { generateId } from '../utils/uuid';
import { toISODateTime } from '../utils/date';

export const CHEKIROKU_CONTAINER_VERSION = 2;
export const CHEKIROKU_DATABASE_VERSION = 12;

const MAX_ARCHIVE_FILES = 256;
const MAX_ARCHIVE_FILE_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_BYTES = 96 * 1024 * 1024;
const DEFAULT_CATEGORY_NAME = '拍立得';

const REQUIRED_TABLE_COLUMNS: Record<string, readonly string[]> = {
  cheki_info: ['id', 'date', 'member_id', 'count', 'event_id', 'category_id', 'hall_id', 'memo'],
  member_info: ['id', 'member_name', 'group_id', 'red', 'green', 'blue', 'image_path', 'created_at'],
  group_name: ['id', 'name'],
  event_name: ['id', 'event_name'],
  hall_name: ['id', 'hall_name'],
  category_name: ['id', 'name'],
};

const OPTIONAL_TABLES = [
  'member_favorites',
  'member_hidden_list',
  'same_person',
  'member_anniversary_settings',
  'group_member_order',
  'group_sort_order_list',
  'member_sort_order_list',
  'category_sort_order_list',
  'user_defined_order',
] as const;

type SourceScalar = string | number | null;

export interface ChekirokuGroupSource {
  id: string;
  name: string | null;
}

export interface ChekirokuMemberSource {
  id: string;
  name: string | null;
  groupId: string | null;
  imagePath: string | null;
  createdAt: SourceScalar;
}

export interface ChekirokuRecordSource {
  id: string;
  date: SourceScalar;
  memberId: string | null;
  count: SourceScalar;
  eventId: string | null;
  categoryId: string | null;
  hallId: string | null;
  memo: string | null;
}

export interface ChekirokuSamePersonGroup {
  id: string;
  memberIds: string[];
}

export interface ChekirokuSourceSnapshot {
  containerVersion: number;
  databaseVersion: number;
  groups: ChekirokuGroupSource[];
  members: ChekirokuMemberSource[];
  records: ChekirokuRecordSource[];
  eventNames: Record<string, string | null>;
  hallNames: Record<string, string | null>;
  categoryNames: Record<string, string | null>;
  favoriteMemberIds: string[];
  samePersonGroups: ChekirokuSamePersonGroup[];
  hiddenMemberCount: number;
  samePersonGroupCount: number;
  samePersonRelationCount: number;
  anniversarySettingCount: number;
  sortingRowCount: number;
  userDefinedOrderCount: number;
  unknownTables: string[];
  unknownColumns: Record<string, string[]>;
  warnings: string[];
}

export interface ChekirokuArtistPlanEntry {
  id: string;
  name: string;
  parentId: string | null;
  sourceKind: 'group' | 'member';
  sourceId: string;
  reuseExisting: boolean;
  isFavorite: boolean;
}

export interface ChekirokuRecordPlanEntry {
  id: string;
  sourceId: string;
  artistId: string | null;
  date: string | null;
  quantity: number;
  notes: string | null;
  itemIds: string[];
}

export interface ChekirokuImportPreview {
  containerVersion: number;
  databaseVersion: number;
  groupCount: number;
  newGroupCount: number;
  reusedGroupCount: number;
  ambiguousGroupCount: number;
  memberCount: number;
  newMemberCount: number;
  reusedMemberCount: number;
  favoriteExistingArtistCount: number;
  ambiguousMemberCount: number;
  recordRowCount: number;
  recordCount: number;
  quantity: number;
  itemCount: number;
  imageCount: number;
  memoRecordCount: number;
  eventOrHallRecordCount: number;
  nonDefaultCategoryRecordCount: number;
  invalidDateCount: number;
  nonMidnightDateCount: number;
  invalidCountCount: number;
  orphanReferenceCount: number;
  emptyGroupCount: number;
  emptyMemberNameCount: number;
  samePersonGroupCount: number;
  samePersonRelationCount: number;
  samePersonMergeCount: number;
  samePersonSeparateCount: number;
  hiddenMemberCount: number;
  sortingRowCount: number;
  userDefinedOrderCount: number;
  anniversarySettingCount: number;
  ignoredSourceImageCount: number;
  unknownTables: string[];
  unknownColumns: Record<string, string[]>;
  warnings: string[];
  fatalErrors: string[];
}

export interface ChekirokuImportPlan {
  importedAt: string;
  artists: ChekirokuArtistPlanEntry[];
  records: ChekirokuRecordPlanEntry[];
  preview: ChekirokuImportPreview;
}

export interface ChekirokuSamePersonDecision {
  mode: 'separate' | 'merge';
  targetMemberId?: string;
}

export interface BuildChekirokuImportPlanOptions {
  createId?: () => string;
  importedAt?: string;
  samePersonDecisions?: Record<string, ChekirokuSamePersonDecision>;
}

export interface ChekirokuImportResult {
  createdArtists: number;
  reusedArtists: number;
  createdRecords: number;
  createdItems: number;
  createdImages: number;
}

export interface ChekirokuImportNotice {
  tone: 'warning' | 'info';
  title: string;
  detail?: string;
}

export interface ChekirokuFileLike {
  bytes(): Promise<Uint8Array>;
}

interface SourceDbTableRow {
  name: string;
}

interface SourceDbColumnRow {
  name: string;
}

interface SourceDbVersionRow {
  user_version: number;
}

interface SourceIntegrityRow {
  integrity_check: string;
}

function textOrNull(value: SourceScalar): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.trim().length > 0 ? text : null;
}

function mapRowsById(rows: Array<{ id: SourceScalar; name?: SourceScalar; event_name?: SourceScalar }>): Record<string, string | null> {
  return Object.fromEntries(rows
    .filter((row) => row.id != null)
    .map((row) => [String(row.id), textOrNull(row.name ?? row.event_name ?? null)]));
}

function quotePragmaIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function readSourceSnapshotFromDatabase(
  db: SQLiteDatabase,
  containerVersion: number,
): Promise<ChekirokuSourceSnapshot> {
  const databaseVersion = (await db.getFirstAsync<SourceDbVersionRow>('PRAGMA user_version'))?.user_version;
  if (databaseVersion !== CHEKIROKU_DATABASE_VERSION) {
    throw new Error(`不支持的 Chekiroku 数据库版本：${databaseVersion ?? '未知'}，当前仅支持 v${CHEKIROKU_DATABASE_VERSION}`);
  }

  const integrity = await db.getFirstAsync<SourceIntegrityRow>('PRAGMA integrity_check');
  if (integrity?.integrity_check !== 'ok') {
    throw new Error(`Chekiroku SQLite 完整性检查失败：${integrity?.integrity_check ?? '未知错误'}`);
  }

  const tableRows = await db.getAllAsync<SourceDbTableRow>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tableNames = new Set(tableRows.map((row) => row.name));
  const missingTables = Object.keys(REQUIRED_TABLE_COLUMNS).filter((name) => !tableNames.has(name));
  if (missingTables.length > 0) {
    throw new Error(`Chekiroku 缺少必需数据表：${missingTables.join('、')}`);
  }

  const unknownTables = [...tableNames].filter((name) => (
    !Object.prototype.hasOwnProperty.call(REQUIRED_TABLE_COLUMNS, name)
    && !OPTIONAL_TABLES.includes(name as (typeof OPTIONAL_TABLES)[number])
  ));
  const unknownColumns: Record<string, string[]> = {};
  for (const [tableName, expected] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
    const columns = await db.getAllAsync<SourceDbColumnRow>(
      `PRAGMA table_info(${quotePragmaIdentifier(tableName)})`,
    );
    const extras = columns.map((column) => column.name).filter((name) => !expected.includes(name));
    if (extras.length > 0) unknownColumns[tableName] = extras;
  }

  const [groups, members, records, eventRows, hallRows, categoryRows] = await Promise.all([
    db.getAllAsync<{ id: SourceScalar; name: SourceScalar }>('SELECT id, name FROM group_name'),
    db.getAllAsync<{
      id: SourceScalar;
      member_name: SourceScalar;
      group_id: SourceScalar;
      image_path: SourceScalar;
      created_at: SourceScalar;
    }>('SELECT id, member_name, group_id, image_path, created_at FROM member_info'),
    db.getAllAsync<{
      id: SourceScalar;
      date: SourceScalar;
      member_id: SourceScalar;
      count: SourceScalar;
      event_id: SourceScalar;
      category_id: SourceScalar;
      hall_id: SourceScalar;
      memo: SourceScalar;
    }>('SELECT id, date, member_id, count, event_id, category_id, hall_id, memo FROM cheki_info'),
    db.getAllAsync<{ id: SourceScalar; event_name: SourceScalar }>('SELECT id, event_name FROM event_name'),
    db.getAllAsync<{ id: SourceScalar; hall_name: SourceScalar }>('SELECT id, hall_name FROM hall_name'),
    db.getAllAsync<{ id: SourceScalar; name: SourceScalar }>('SELECT id, name FROM category_name'),
  ]);

  const countTable = async (tableName: string): Promise<number> => {
    if (!tableNames.has(tableName)) return 0;
    const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${quotePragmaIdentifier(tableName)}`);
    return row?.count ?? 0;
  };

  let samePersonGroupCount = 0;
  let samePersonRelationCount = 0;
  let samePersonGroups: ChekirokuSamePersonGroup[] = [];
  if (tableNames.has('same_person')) {
    const rows = await db.getAllAsync<{
      same_id: SourceScalar;
      member_id: SourceScalar;
      sort_order: SourceScalar;
    }>('SELECT same_id, member_id, sort_order FROM same_person ORDER BY same_id, sort_order, member_id');
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const sameId = textOrNull(row.same_id);
      const memberId = textOrNull(row.member_id);
      if (!sameId || !memberId) continue;
      const memberIds = groups.get(sameId) ?? [];
      if (!memberIds.includes(memberId)) memberIds.push(memberId);
      groups.set(sameId, memberIds);
    }
    samePersonGroups = [...groups.entries()]
      .filter(([, memberIds]) => memberIds.length >= 2)
      .map(([id, memberIds]) => ({ id, memberIds }));
    samePersonRelationCount = rows.length;
    samePersonGroupCount = samePersonGroups.length;
  }

  const [favoriteRows, hiddenMemberCount, anniversarySettingCount, sortingRowCount, userDefinedOrderCount] = await Promise.all([
    tableNames.has('member_favorites')
      ? db.getAllAsync<{ member_id: SourceScalar }>('SELECT member_id FROM member_favorites')
      : Promise.resolve([]),
    countTable('member_hidden_list'),
    countTable('member_anniversary_settings'),
    Promise.all(OPTIONAL_TABLES
      .filter((table) => table.endsWith('order') || table.includes('sort_order'))
      .map((table) => countTable(table)))
      .then((counts) => counts.reduce((sum, count) => sum + count, 0)),
    countTable('user_defined_order'),
  ]);

  return {
    containerVersion,
    databaseVersion,
    groups: groups.map((row) => ({ id: String(row.id), name: textOrNull(row.name) })),
    members: members.map((row) => ({
      id: String(row.id),
      name: textOrNull(row.member_name),
      groupId: textOrNull(row.group_id),
      imagePath: textOrNull(row.image_path),
      createdAt: row.created_at,
    })),
    records: records.map((row) => ({
      id: String(row.id),
      date: row.date,
      memberId: textOrNull(row.member_id),
      count: row.count,
      eventId: textOrNull(row.event_id),
      categoryId: textOrNull(row.category_id),
      hallId: textOrNull(row.hall_id),
      memo: row.memo == null ? null : String(row.memo),
    })),
    eventNames: mapRowsById(eventRows),
    hallNames: mapRowsById(hallRows),
    categoryNames: mapRowsById(categoryRows),
    favoriteMemberIds: favoriteRows
      .map((row) => textOrNull(row.member_id))
      .filter((id): id is string => id != null),
    samePersonGroups,
    hiddenMemberCount,
    samePersonGroupCount,
    samePersonRelationCount,
    anniversarySettingCount,
    sortingRowCount,
    userDefinedOrderCount,
    unknownTables,
    unknownColumns,
    warnings: [],
  };
}

function isUnsafeArchivePath(name: string): boolean {
  return name.startsWith('/')
    || name.includes('\\')
    || name.split('/').some((part) => part === '..' || part.length === 0 && name !== part);
}

function parseContainerVersion(bytes: Uint8Array): number {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes)) as { version?: unknown };
    if (value.version !== CHEKIROKU_CONTAINER_VERSION) {
      throw new Error(`不支持的 Chekiroku 容器版本：${String(value.version ?? '未知')}，当前仅支持 v${CHEKIROKU_CONTAINER_VERSION}`);
    }
    return CHEKIROKU_CONTAINER_VERSION;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('不支持的 Chekiroku')) throw error;
    throw new Error('Chekiroku 的 version.json 无法解析');
  }
}

export async function parseChekirokuArchiveBytes(bytes: Uint8Array): Promise<ChekirokuSourceSnapshot> {
  if (bytes.byteLength > MAX_ARCHIVE_TOTAL_BYTES) throw new Error('Chekiroku 文件超过大小限制');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error('文件不是有效的 ZIP 容器');
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ARCHIVE_FILES) throw new Error('Chekiroku 文件包含过多内容');
  let declaredTotalBytes = 0;
  for (const entry of entries) {
    const originalName = (entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    if (isUnsafeArchivePath(originalName)) throw new Error(`Chekiroku 包含危险路径：${originalName}`);
    const declaredSize = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof declaredSize === 'number' && Number.isFinite(declaredSize)) {
      if (declaredSize > MAX_ARCHIVE_FILE_BYTES) throw new Error(`Chekiroku 文件超过单文件大小限制：${entry.name}`);
      declaredTotalBytes += declaredSize;
    }
  }
  if (declaredTotalBytes > MAX_ARCHIVE_TOTAL_BYTES) throw new Error('Chekiroku 解压后内容超过大小限制');
  const versionEntry = zip.file('version.json');
  const databaseEntry = zip.file('my.db');
  if (!versionEntry) throw new Error('Chekiroku 缺少 version.json');
  if (!databaseEntry) throw new Error('Chekiroku 缺少 my.db');
  const versionBytes = await versionEntry.async('uint8array');
  const containerVersion = parseContainerVersion(versionBytes);
  const databaseBytes = await databaseEntry.async('uint8array');
  if (databaseBytes.byteLength > MAX_ARCHIVE_FILE_BYTES) throw new Error('Chekiroku 数据库文件超过大小限制');
  let sourceDb: SQLiteDatabase;
  try {
    sourceDb = await SQLite.deserializeDatabaseAsync(databaseBytes);
  } catch {
    throw new Error('Chekiroku 的 my.db 不是有效的 SQLite 数据库');
  }
  try {
    return await readSourceSnapshotFromDatabase(sourceDb, containerVersion);
  } finally {
    await sourceDb.closeAsync();
  }
}

export async function parseChekirokuFile(file: ChekirokuFileLike): Promise<ChekirokuSourceSnapshot> {
  return parseChekirokuArchiveBytes(await file.bytes());
}

function isValidSourceDate(value: SourceScalar): { date: string | null; invalid: boolean; nonMidnight: boolean } {
  if (value == null || (typeof value === 'string' && value.trim().length === 0)) {
    return { date: null, invalid: true, nonMidnight: false };
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || !Number.isSafeInteger(numeric) || Math.abs(numeric) > 8.64e15) {
    return { date: null, invalid: true, nonMidnight: false };
  }
  const date = new Date(numeric);
  if (Number.isNaN(date.getTime())) return { date: null, invalid: true, nonMidnight: false };
  const nonMidnight = date.getUTCHours() !== 0
    || date.getUTCMinutes() !== 0
    || date.getUTCSeconds() !== 0
    || date.getUTCMilliseconds() !== 0;
  return { date: date.toISOString().slice(0, 10), invalid: false, nonMidnight };
}

function validCount(value: SourceScalar): value is number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 1;
}

export function buildChekirokuNotes(input: {
  memo?: string | null;
  eventName?: string | null;
  hallName?: string | null;
  categoryName?: string | null;
}): string | null {
  const memo = input.memo ?? '';
  const eventName = input.eventName?.trim() ?? '';
  const hallName = input.hallName?.trim() ?? '';
  const categoryName = input.categoryName?.trim() ?? '';
  const details = [
    eventName ? `活动：${eventName}` : null,
    hallName ? `会场：${hallName}` : null,
    categoryName && categoryName !== DEFAULT_CATEGORY_NAME ? `类别：${categoryName}` : null,
  ].filter((value): value is string => value != null);
  if (details.length === 0) return memo.length > 0 ? memo : null;
  const block = `[Chekiroku 导入信息]\n${details.join('\n')}`;
  return memo.length > 0 ? `${memo}\n\n${block}` : block;
}

function countRecordReferences(
  snapshot: ChekirokuSourceSnapshot,
  record: ChekirokuRecordSource,
  memberIds: Set<string>,
): number {
  let count = 0;
  if (record.memberId && !memberIds.has(record.memberId)) count += 1;
  if (record.eventId && snapshot.eventNames[record.eventId] === undefined) count += 1;
  if (record.hallId && snapshot.hallNames[record.hallId] === undefined) count += 1;
  if (record.categoryId && snapshot.categoryNames[record.categoryId] === undefined) count += 1;
  return count;
}

export function buildChekirokuImportPlan(
  snapshot: ChekirokuSourceSnapshot,
  existingArtists: readonly Artist[],
  options: BuildChekirokuImportPlanOptions = {},
): ChekirokuImportPlan {
  const createId = options.createId ?? generateId;
  const importedAt = options.importedAt ?? toISODateTime();
  const warnings = [...snapshot.warnings];
  const fatalErrors: string[] = [];
  const memberIds = new Set(snapshot.members.map((member) => member.id));
  const groupById = new Map(snapshot.groups.map((group) => [group.id, group]));
  const sourceGroups = snapshot.groups.filter((group) => group.name != null);
  const emptyGroupCount = snapshot.groups.length - sourceGroups.length;
  const mergedTargetByMemberId = new Map<string, string>();
  let samePersonMergeCount = 0;
  let samePersonSeparateCount = 0;
  for (const samePersonGroup of snapshot.samePersonGroups) {
    const decision = options.samePersonDecisions?.[samePersonGroup.id];
    const targetMemberId = decision?.mode === 'merge'
      && decision.targetMemberId
      && samePersonGroup.memberIds.includes(decision.targetMemberId)
      ? decision.targetMemberId
      : null;
    if (targetMemberId) {
      samePersonMergeCount += 1;
      for (const memberId of samePersonGroup.memberIds) mergedTargetByMemberId.set(memberId, targetMemberId);
    } else {
      samePersonSeparateCount += 1;
    }
  }
  const artists: ChekirokuArtistPlanEntry[] = [];
  const groupTargetIds = new Map<string, string>();
  const usedExistingIds = new Set<string>();
  let ambiguousGroupCount = 0;
  let newGroupCount = 0;
  let reusedGroupCount = 0;

  for (const group of sourceGroups) {
    const name = group.name!;
    const matches = existingArtists.filter((artist) => artist.parent_id == null && artist.name === name);
    const reusable = matches.length === 1 && !usedExistingIds.has(matches[0].id);
    if (matches.length > 1) ambiguousGroupCount += 1;
    const id = reusable ? matches[0].id : createId();
    groupTargetIds.set(group.id, id);
    artists.push({
      id,
      name,
      parentId: null,
      sourceKind: 'group',
      sourceId: group.id,
      reuseExisting: reusable,
      isFavorite: false,
    });
    if (reusable) {
      reusedGroupCount += 1;
      usedExistingIds.add(id);
    } else newGroupCount += 1;
  }

  const memberTargetIds = new Map<string, string | null>();
  const favoriteIds = new Set(snapshot.favoriteMemberIds);
  let ambiguousMemberCount = 0;
  let newMemberCount = 0;
  let reusedMemberCount = 0;
  let emptyMemberNameCount = 0;
  for (const member of snapshot.members) {
    const mergedTargetMemberId = mergedTargetByMemberId.get(member.id);
    if (mergedTargetMemberId && mergedTargetMemberId !== member.id) {
      memberTargetIds.set(member.id, null);
      continue;
    }
    if (!member.name) {
      emptyMemberNameCount += 1;
      memberTargetIds.set(member.id, null);
      continue;
    }
    const group = member.groupId ? groupById.get(member.groupId) : undefined;
    const parentId = group?.name ? groupTargetIds.get(group.id) ?? null : null;
    if (member.groupId && !group) warnings.push(`成员「${member.name}」引用了不存在的团体 ${member.groupId}，将保存为根级艺人`);
    const matches = existingArtists.filter((artist) => artist.name === member.name && artist.parent_id === parentId);
    const reusable = matches.length === 1 && !usedExistingIds.has(matches[0].id);
    if (matches.length > 1) ambiguousMemberCount += 1;
    const id = reusable ? matches[0].id : createId();
    memberTargetIds.set(member.id, id);
    artists.push({
      id,
      name: member.name,
      parentId,
      sourceKind: 'member',
      sourceId: member.id,
      reuseExisting: reusable,
      isFavorite: favoriteIds.has(member.id),
    });
    if (reusable) {
      reusedMemberCount += 1;
      usedExistingIds.add(id);
    } else newMemberCount += 1;
  }

  for (const [memberId, targetMemberId] of mergedTargetByMemberId) {
    memberTargetIds.set(memberId, memberTargetIds.get(targetMemberId) ?? null);
  }

  if (emptyMemberNameCount > 0) warnings.push(`有 ${emptyMemberNameCount} 个成员名称为空，对应记录将不关联艺人`);
  if (ambiguousGroupCount > 0) warnings.push(`有 ${ambiguousGroupCount} 个团体名称存在多个精确匹配，已分别新建以避免误合并`);
  if (ambiguousMemberCount > 0) warnings.push(`有 ${ambiguousMemberCount} 个成员存在多个精确匹配，已分别新建以避免误合并`);

  const records: ChekirokuRecordPlanEntry[] = [];
  let quantity = 0;
  let invalidDateCount = 0;
  let nonMidnightDateCount = 0;
  let invalidCountCount = 0;
  let orphanReferenceCount = 0;
  let memoRecordCount = 0;
  let eventOrHallRecordCount = 0;
  let nonDefaultCategoryRecordCount = 0;
  let ignoredSourceImageCount = snapshot.members.filter((member) => member.imagePath != null).length;

  for (const sourceRecord of snapshot.records) {
    const sourceCount = Number(sourceRecord.count);
    if (!validCount(sourceRecord.count)) {
      invalidCountCount += 1;
      fatalErrors.push(`记录 ${sourceRecord.id} 的 count 不是大于等于 1 的整数`);
      continue;
    }
    const convertedDate = isValidSourceDate(sourceRecord.date);
    if (convertedDate.invalid) {
      invalidDateCount += 1;
      warnings.push(`记录 ${sourceRecord.id} 的日期无法转换，将保存为空日期`);
    } else if (convertedDate.nonMidnight) {
      nonMidnightDateCount += 1;
      warnings.push(`记录 ${sourceRecord.id} 的日期不是 UTC 午夜，已按 UTC 日期保存`);
    }
    const orphanCount = countRecordReferences(snapshot, sourceRecord, memberIds);
    if (orphanCount > 0) {
      orphanReferenceCount += orphanCount;
      warnings.push(`记录 ${sourceRecord.id} 存在 ${orphanCount} 个无法解析的引用，已降级保存`);
    }
    const eventName = sourceRecord.eventId ? snapshot.eventNames[sourceRecord.eventId] : null;
    const hallName = sourceRecord.hallId ? snapshot.hallNames[sourceRecord.hallId] : null;
    const categoryName = sourceRecord.categoryId ? snapshot.categoryNames[sourceRecord.categoryId] : null;
    const notes = buildChekirokuNotes({ memo: sourceRecord.memo, eventName, hallName, categoryName });
    if (sourceRecord.memo != null && sourceRecord.memo.length > 0) memoRecordCount += 1;
    if (eventName?.trim() || hallName?.trim()) eventOrHallRecordCount += 1;
    if (categoryName?.trim() && categoryName.trim() !== DEFAULT_CATEGORY_NAME) nonDefaultCategoryRecordCount += 1;
    const itemIds = Array.from({ length: sourceCount }, () => createId());
    const targetArtistId = sourceRecord.memberId ? memberTargetIds.get(sourceRecord.memberId) ?? null : null;
    records.push({
      id: createId(),
      sourceId: sourceRecord.id,
      artistId: targetArtistId,
      date: convertedDate.date,
      quantity: sourceCount,
      notes,
      itemIds,
    });
    quantity += sourceCount;
  }

  if (invalidCountCount > 0) fatalErrors.push(`共有 ${invalidCountCount} 条记录的数量非法，不能确认导入`);
  if (emptyGroupCount > 0) warnings.push(`有 ${emptyGroupCount} 个空名称团体未创建，相关成员保存为根级艺人`);
  if (samePersonSeparateCount > 0) warnings.push(`${samePersonSeparateCount} 组 same_person 关系选择分开导入，关系本身不会写入 ota-log`);
  if (samePersonMergeCount > 0) warnings.push(`${samePersonMergeCount} 组 same_person 关系已按选择合并到指定成员数据`);
  if (snapshot.hiddenMemberCount > 0) warnings.push('隐藏成员列表没有 ota-log 对应字段，未迁移');
  if (snapshot.sortingRowCount > 0 || snapshot.userDefinedOrderCount > 0) warnings.push('Chekiroku 排序设置没有 ota-log 对应模型，未迁移');
  if (snapshot.anniversarySettingCount > 0) warnings.push('纪念日设置未迁移，避免产生通知副作用');
  if (ignoredSourceImageCount > 0) warnings.push(`有 ${ignoredSourceImageCount} 个成员图片路径未找到可导入媒体，已忽略`);

  return {
    importedAt,
    artists,
    records,
    preview: {
      containerVersion: snapshot.containerVersion,
      databaseVersion: snapshot.databaseVersion,
      groupCount: sourceGroups.length,
      newGroupCount,
      reusedGroupCount,
      ambiguousGroupCount,
      memberCount: artists.filter((artist) => artist.sourceKind === 'member').length,
      newMemberCount,
      reusedMemberCount,
      favoriteExistingArtistCount: artists.filter((artist) => artist.reuseExisting && artist.isFavorite).length,
      ambiguousMemberCount,
      recordRowCount: snapshot.records.length,
      recordCount: records.length,
      quantity,
      itemCount: quantity,
      imageCount: 0,
      memoRecordCount,
      eventOrHallRecordCount,
      nonDefaultCategoryRecordCount,
      invalidDateCount,
      nonMidnightDateCount,
      invalidCountCount,
      orphanReferenceCount,
      emptyGroupCount,
      emptyMemberNameCount,
      samePersonGroupCount: snapshot.samePersonGroupCount,
      samePersonRelationCount: snapshot.samePersonRelationCount,
      samePersonMergeCount,
      samePersonSeparateCount,
      hiddenMemberCount: snapshot.hiddenMemberCount,
      sortingRowCount: snapshot.sortingRowCount,
      userDefinedOrderCount: snapshot.userDefinedOrderCount,
      anniversarySettingCount: snapshot.anniversarySettingCount,
      ignoredSourceImageCount,
      unknownTables: snapshot.unknownTables,
      unknownColumns: snapshot.unknownColumns,
      warnings: [...new Set(warnings)],
      fatalErrors: [...new Set(fatalErrors)],
    },
  };
}

export async function applyChekirokuImportPlan(
  db: SQLiteDatabase,
  plan: ChekirokuImportPlan,
): Promise<ChekirokuImportResult> {
  if (plan.preview.fatalErrors.length > 0) throw new Error(plan.preview.fatalErrors.join('；'));
  let result: ChekirokuImportResult | null = null;
  await db.withTransactionAsync(async () => {
    let createdArtists = 0;
    let reusedArtists = 0;
    for (const artist of plan.artists) {
      if (artist.reuseExisting) {
        reusedArtists += 1;
        if (artist.isFavorite) {
          await db.runAsync('UPDATE artists SET is_favorite = 1 WHERE id = ?', [artist.id]);
        }
        continue;
      }
      await db.runAsync(
        `INSERT INTO artists
          (id, name, short_name, parent_id, avatar_uri, background_uri, background_color, url, is_favorite, created_at)
         VALUES (?, ?, NULL, ?, NULL, NULL, NULL, NULL, ?, ?)`,
        [artist.id, artist.name, artist.parentId, artist.isFavorite ? 1 : 0, plan.importedAt],
      );
      createdArtists += 1;
    }

    let createdItems = 0;
    for (const record of plan.records) {
      await db.runAsync(
        `INSERT INTO cheki_records
          (id, event_id, artist_id, date, quantity, notes, created_at, updated_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
        [record.id, record.artistId, record.date, record.quantity, record.notes, plan.importedAt, plan.importedAt],
      );
      for (const [sortOrder, itemId] of record.itemIds.entries()) {
        await db.runAsync(
          `INSERT INTO cheki_items
            (id, record_id, sort_order, unit_price, spec, is_favorite, notes, created_at, updated_at)
           VALUES (?, ?, ?, 0, ?, 0, NULL, ?, ?)`,
          [itemId, record.id, sortOrder, DEFAULT_CHEKI_SPEC, plan.importedAt, plan.importedAt],
        );
        createdItems += 1;
      }
    }
    result = {
      createdArtists,
      reusedArtists,
      createdRecords: plan.records.length,
      createdItems,
      createdImages: 0,
    };
  });
  if (!result) throw new Error('Chekiroku 导入未返回结果');
  return result;
}

export function buildChekirokuImportNotices(preview: ChekirokuImportPreview): ChekirokuImportNotice[] {
  const notices: ChekirokuImportNotice[] = [];

  if (preview.invalidDateCount > 0) {
    notices.push({
      tone: 'warning',
      title: `${preview.invalidDateCount} 条记录没有有效日期`,
      detail: '这些记录仍会导入，日期将保持未填写。',
    });
  }
  if (preview.nonMidnightDateCount > 0) {
    notices.push({
      tone: 'info',
      title: `${preview.nonMidnightDateCount} 条记录的日期已按原始日期保存`,
      detail: 'Chekiroku 中的时间部分不会写入拍立得记录。',
    });
  }
  if (preview.emptyMemberNameCount > 0) {
    notices.push({
      tone: 'warning',
      title: `${preview.emptyMemberNameCount} 个成员没有名称`,
      detail: '对应拍立得会导入，但不会关联艺人。',
    });
  }
  if (preview.emptyGroupCount > 0) {
    notices.push({
      tone: 'warning',
      title: `${preview.emptyGroupCount} 个团体没有名称`,
      detail: '团体不会创建，相关成员将作为独立艺人导入。',
    });
  }
  if (preview.orphanReferenceCount > 0) {
    notices.push({
      tone: 'warning',
      title: `${preview.orphanReferenceCount} 处关联信息无法识别`,
      detail: '可识别的拍立得内容仍会保留。',
    });
  }
  if (preview.ambiguousGroupCount > 0 || preview.ambiguousMemberCount > 0) {
    const total = preview.ambiguousGroupCount + preview.ambiguousMemberCount;
    notices.push({
      tone: 'warning',
      title: `${total} 个艺人资料与多个已有资料同名`,
      detail: '为避免错误合并，这些资料会作为新艺人导入。',
    });
  }
  if (preview.favoriteExistingArtistCount > 0) {
    notices.push({
      tone: 'info',
      title: `${preview.favoriteExistingArtistCount} 个已有艺人将同步设为收藏`,
      detail: '这些成员在 Chekiroku 中已收藏，导入时会同步收藏状态。',
    });
  }
  if (preview.ignoredSourceImageCount > 0) {
    notices.push({
      tone: 'info',
      title: `${preview.ignoredSourceImageCount} 个成员头像无法导入`,
      detail: '拍立得记录和成员名称不受影响。',
    });
  }
  if (preview.eventOrHallRecordCount > 0 || preview.nonDefaultCategoryRecordCount > 0) {
    notices.push({
      tone: 'info',
      title: '活动、会场和类别将保存在拍立得备注中',
      detail: '本次导入不会创建或关联活动。',
    });
  }
  if (preview.hiddenMemberCount > 0) {
    notices.push({
      tone: 'info',
      title: '隐藏成员状态不会导入',
    });
  }
  if (preview.sortingRowCount > 0 || preview.userDefinedOrderCount > 0) {
    notices.push({
      tone: 'info',
      title: '自定义排序不会导入',
    });
  }
  if (preview.anniversarySettingCount > 0) {
    notices.push({
      tone: 'info',
      title: '纪念日设置不会导入',
      detail: '避免在 ota-log 中产生意外提醒。',
    });
  }

  return notices;
}

import JSZip from 'jszip';
import type { Artist } from '../../types/models';
import {
  buildChekirokuImportNotices,
  buildChekirokuImportPlan,
  buildChekirokuNotes,
  type ChekirokuSourceSnapshot,
  parseChekirokuArchiveBytes,
} from '../chekiroku';

function createSnapshot(overrides: Partial<ChekirokuSourceSnapshot> = {}): ChekirokuSourceSnapshot {
  return {
    containerVersion: 2,
    databaseVersion: 12,
    groups: [{ id: 'group-a', name: '团体 A' }],
    members: [{
      id: 'member-a',
      name: '成员 A',
      groupId: 'group-a',
      imagePath: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }],
    records: [{
      id: 'record-a',
      date: Date.UTC(2026, 0, 11),
      memberId: 'member-a',
      count: 2,
      eventId: 'event-a',
      categoryId: 'category-a',
      hallId: 'hall-a',
      memo: '原始备注',
    }],
    eventNames: { 'event-a': '春日活动' },
    hallNames: { 'hall-a': '一号会场' },
    categoryNames: { 'category-a': '自拍' },
    favoriteMemberIds: ['member-a'],
    samePersonGroups: [],
    hiddenMemberCount: 1,
    samePersonGroupCount: 0,
    samePersonRelationCount: 0,
    anniversarySettingCount: 1,
    sortingRowCount: 3,
    userDefinedOrderCount: 1,
    unknownTables: ['future_table'],
    unknownColumns: { member_info: ['new_column'] },
    warnings: [],
    ...overrides,
  };
}

function createArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    id: 'existing-member',
    name: '成员 A',
    short_name: null,
    parent_id: 'existing-group',
    avatar_uri: null,
    background_uri: null,
    background_color: '#ff0000',
    url: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTestIdFactory() {
  let index = 0;
  return () => `20000000-0000-4000-8000-${String(++index).padStart(12, '0')}`;
}

describe('Chekiroku import planning', () => {
  test('rejects missing database and dangerous ZIP paths before opening SQLite', async () => {
    const missingDbZip = new JSZip();
    missingDbZip.file('version.json', JSON.stringify({ version: 2 }));
    await expect(parseChekirokuArchiveBytes(await missingDbZip.generateAsync({ type: 'uint8array' })))
      .rejects.toThrow('缺少 my.db');

    const dangerousZip = new JSZip();
    dangerousZip.file('version.json', JSON.stringify({ version: 2 }));
    dangerousZip.file('my.db', 'not-a-database');
    dangerousZip.file('../outside.txt', 'blocked');
    await expect(parseChekirokuArchiveBytes(await dangerousZip.generateAsync({ type: 'uint8array' })))
      .rejects.toThrow('危险路径');
  });

  test('preserves memo and losslessly appends activity, hall, and non-default category', () => {
    expect(buildChekirokuNotes({
      memo: '原始备注',
      eventName: '春日活动',
      hallName: '一号会场',
      categoryName: '自拍',
    })).toBe('原始备注\n\n[Chekiroku 导入信息]\n活动：春日活动\n会场：一号会场\n类别：自拍');
    expect(buildChekirokuNotes({ categoryName: '拍立得' })).toBeNull();
    expect(buildChekirokuNotes({ eventName: '  ', hallName: null })).toBeNull();
  });

  test('keeps source member identity separate and drops Chekiroku colors', () => {
    const snapshot = createSnapshot({
      groups: [
        { id: 'group-a', name: '团体 A' },
        { id: 'group-b', name: '团体 B' },
      ],
      members: [
        { id: 'member-a', name: '优璃yuri', groupId: 'group-a', imagePath: null, createdAt: null },
        { id: 'member-b', name: '优璃yuri', groupId: 'group-b', imagePath: null, createdAt: null },
        { id: 'member-empty', name: null, groupId: 'group-a', imagePath: null, createdAt: null },
      ],
      favoriteMemberIds: ['member-b'],
      records: [{ ...createSnapshot().records[0], memberId: 'member-b', count: 1 }],
    });
    const plan = buildChekirokuImportPlan(snapshot, [], { createId: (() => {
      let i = 0;
      return () => `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
    })() });
    expect(plan.preview.memberCount).toBe(2);
    expect(plan.preview.emptyMemberNameCount).toBe(1);
    expect(new Set(plan.artists.filter((artist) => artist.sourceKind === 'member').map((artist) => artist.parentId)).size).toBe(2);
    expect(plan.artists.find((artist) => artist.sourceId === 'member-b')?.isFavorite).toBe(true);
    expect(plan.artists.every((artist) => artist.sourceKind !== 'member' || artist.name !== '')).toBe(true);
  });

  test('supports keeping same-person members separate or merging into a selected member', () => {
    const snapshot = createSnapshot({
      groups: [
        { id: 'group-a', name: '团体 A' },
        { id: 'group-b', name: '团体 B' },
      ],
      members: [
        { id: 'member-a', name: '优璃yuri', groupId: 'group-a', imagePath: null, createdAt: null },
        { id: 'member-b', name: '优璃yuri', groupId: 'group-b', imagePath: null, createdAt: null },
      ],
      records: [
        { ...createSnapshot().records[0], id: 'record-a', memberId: 'member-a' },
        { ...createSnapshot().records[0], id: 'record-b', memberId: 'member-b' },
      ],
      samePersonGroups: [{ id: 'same-1', memberIds: ['member-a', 'member-b'] }],
      samePersonGroupCount: 1,
      samePersonRelationCount: 2,
    });
    const separatePlan = buildChekirokuImportPlan(snapshot, [], { createId: createTestIdFactory() });
    const mergedPlan = buildChekirokuImportPlan(snapshot, [], {
      createId: createTestIdFactory(),
      samePersonDecisions: { 'same-1': { mode: 'merge', targetMemberId: 'member-a' } },
    });
    expect(separatePlan.preview.samePersonSeparateCount).toBe(1);
    expect(separatePlan.preview.samePersonMergeCount).toBe(0);
    expect(separatePlan.preview.newMemberCount).toBe(2);
    expect(mergedPlan.preview.samePersonMergeCount).toBe(1);
    expect(mergedPlan.preview.samePersonSeparateCount).toBe(0);
    expect(mergedPlan.preview.memberCount).toBe(1);
    expect(mergedPlan.preview.newMemberCount).toBe(1);
    expect(mergedPlan.records[0].artistId).toBe(mergedPlan.records[1].artistId);
  });

  test('matches exact parent/name conservatively and reports invalid dates/counts', () => {
    const existingGroup = createArtist({ id: 'existing-group', name: '团体 A', parent_id: null });
    const existingMember = createArtist();
    const snapshot = createSnapshot({
      records: [
        { ...createSnapshot().records[0], id: 'bad-count', count: 0 },
        { ...createSnapshot().records[0], id: 'bad-date', date: 'not-a-date', count: 1 },
        { ...createSnapshot().records[0], id: 'non-midnight', date: Date.UTC(2026, 0, 11, 12), count: 1 },
      ],
    });
    const plan = buildChekirokuImportPlan(snapshot, [existingGroup, existingMember], {
      createId: (() => {
        let i = 0;
        return () => `10000000-0000-4000-8000-${String(++i).padStart(12, '0')}`;
      })(),
    });
    expect(plan.preview.reusedGroupCount).toBe(1);
    expect(plan.preview.reusedMemberCount).toBe(1);
    expect(plan.preview.invalidCountCount).toBe(1);
    expect(plan.preview.invalidDateCount).toBe(1);
    expect(plan.preview.nonMidnightDateCount).toBe(1);
    expect(plan.preview.fatalErrors).toHaveLength(2);
    expect(plan.records).toHaveLength(2);
  });

  test('turns import diagnostics into user-facing notices without database terminology', () => {
    const existingGroup = createArtist({ id: 'existing-group', name: '团体 A', parent_id: null });
    const existingMember = createArtist();
    const plan = buildChekirokuImportPlan(createSnapshot({
      members: [{
        ...createSnapshot().members[0],
        imagePath: '/data/user/0/com.chekiroku/avatar/member-a.jpg',
      }],
      records: [{
        ...createSnapshot().records[0],
        date: 'not-a-date',
      }],
    }), [existingGroup, existingMember], { createId: createTestIdFactory() });

    const notices = buildChekirokuImportNotices(plan.preview);
    expect(notices).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: '1 条记录没有有效日期' }),
      expect.objectContaining({ title: '1 个成员头像无法导入' }),
      expect.objectContaining({ title: '活动、会场和类别将保存在拍立得备注中' }),
      expect.objectContaining({ title: '隐藏成员状态不会导入' }),
      expect.objectContaining({ title: '自定义排序不会导入' }),
      expect.objectContaining({ title: '纪念日设置不会导入' }),
      expect.objectContaining({ title: '1 个已有艺人将同步设为收藏' }),
    ]));
    expect(JSON.stringify(notices)).not.toMatch(/table|column|数据库|源行|Item|same_person/i);
  });
});

import { SQLiteDatabase } from 'expo-sqlite';
import {
  Artist,
  ArtistGroupMembership,
  ArtistGroupMembershipWithArtist,
  ArtistType,
  CreateArtistGroupMembershipInput,
  CreateArtistInput,
} from '../types/models';
import { generateId } from '../utils/uuid';
import { isValidISODate, toISODate, toISODateTime } from '../utils/date';
import { deleteLocalFileIfUnreferenced } from '../utils/localMedia';
import { analyzeArtistTypeConversionGraph } from '../utils/artistTypeConversion';

interface MembershipArtistRow extends ArtistGroupMembership {
  related_artist_id: string;
  related_name: string;
  related_short_name: string | null;
  related_artist_type: ArtistType | null;
  related_avatar_uri: string | null;
  related_background_uri: string | null;
  related_background_color: string | null;
  related_url: string | null;
  related_is_favorite: number;
  related_created_at: string;
}

export interface InferredArtistTypeConversion {
  decisions: Record<string, ArtistType>;
  personCount: number;
  groupCount: number;
  membershipCount: number;
  skippedArtistCount: number;
}

function validateMembershipDates(startDate?: string | null, endDate?: string | null): void {
  if (startDate != null && !isValidISODate(startDate)) {
    throw new Error('入团日期必须是有效的 YYYY-MM-DD 日期');
  }
  if (endDate != null && !isValidISODate(endDate)) {
    throw new Error('最后在团日期必须是有效的 YYYY-MM-DD 日期');
  }
  if (startDate != null && endDate != null && endDate < startDate) {
    throw new Error('最后在团日期不能早于入团日期');
  }
}

export class ArtistRepository {
  constructor(private db: SQLiteDatabase) {}

  private async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const transactionalDb = this.db as SQLiteDatabase & {
      withTransactionAsync?: <U>(fn: () => Promise<U>) => Promise<U>;
    };
    if (typeof transactionalDb.withTransactionAsync === 'function') {
      return transactionalDb.withTransactionAsync(callback);
    }

    await this.db.execAsync('BEGIN');
    try {
      const result = await callback();
      await this.db.execAsync('COMMIT');
      return result;
    } catch (error) {
      await this.db.execAsync('ROLLBACK');
      throw error;
    }
  }

  async findAll(date = toISODate(new Date())): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT a.*,
              COALESCE(
                affiliation.parent_artist_id,
                (SELECT membership.group_artist_id
                 FROM artist_group_memberships membership
                 WHERE membership.person_artist_id = a.id
                   AND (membership.start_date IS NULL OR membership.start_date <= ?)
                   AND (membership.end_date IS NULL OR membership.end_date >= ?)
                 ORDER BY membership.start_date DESC, membership.created_at ASC, membership.group_artist_id
                 LIMIT 1)
              ) AS parent_id
       FROM artists a
       LEFT JOIN artist_basic_affiliations affiliation
         ON affiliation.member_artist_id = a.id
       ORDER BY a.name ASC`,
      [date, date],
    );
  }

  async findDirectActivityCounts(): Promise<Record<string, number>> {
    const rows = await this.db.getAllAsync<{ artist_id: string; activity_count: number }>(
      `SELECT artist_id, COUNT(DISTINCT event_id) AS activity_count
       FROM event_artists
       GROUP BY artist_id`,
    );
    return Object.fromEntries(rows.map((row) => [row.artist_id, row.activity_count]));
  }

  async findFavorites(): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT a.*, affiliation.parent_artist_id AS parent_id
       FROM artists a
       LEFT JOIN artist_basic_affiliations affiliation
         ON affiliation.member_artist_id = a.id
       WHERE a.is_favorite = 1
       ORDER BY a.name ASC`
    );
  }

  async findFavoriteWithRecentInteraction(): Promise<Artist | null> {
    return this.db.getFirstAsync<Artist>(
      `SELECT a.*, affiliation.parent_artist_id AS parent_id
       FROM artists a
       JOIN (
         SELECT artist_id, MAX(sort_value) AS last_interaction_at
         FROM (
           SELECT attribution.artist_id, MAX(e.event_date) AS sort_value
           FROM event_artist_attributions attribution
           JOIN event_summaries e ON e.id = attribution.event_id
           GROUP BY attribution.artist_id
           UNION ALL
           SELECT artist_id, MAX(COALESCE(date, created_at)) AS sort_value
           FROM cheki_records
           WHERE artist_id IS NOT NULL
           GROUP BY artist_id
         ) interactions
         GROUP BY artist_id
       ) recent ON recent.artist_id = a.id
       LEFT JOIN artist_basic_affiliations affiliation
         ON affiliation.member_artist_id = a.id
       WHERE a.is_favorite = 1
       ORDER BY recent.last_interaction_at DESC, a.name ASC
       LIMIT 1`
    );
  }

  async findById(id: string): Promise<Artist | null> {
    return this.db.getFirstAsync<Artist>(
      `SELECT a.*, affiliation.parent_artist_id AS parent_id
       FROM artists a
       LEFT JOIN artist_basic_affiliations affiliation
         ON affiliation.member_artist_id = a.id
       WHERE a.id = ?`,
      [id]
    );
  }

  async findMembers(parentId: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT a.*, affiliation.parent_artist_id AS parent_id
       FROM artist_basic_affiliations affiliation
       JOIN artists a ON a.id = affiliation.member_artist_id
       WHERE affiliation.parent_artist_id = ?
       ORDER BY a.name ASC`,
      [parentId]
    );
  }

  async setMembers(parentId: string, memberIds: string[]): Promise<void> {
    const uniqueMemberIds = [...new Set(memberIds.filter((memberId) => memberId && memberId !== parentId))];

    await this.withTransaction(async () => {
      if (uniqueMemberIds.length === 0) {
        await this.db.runAsync(
          'DELETE FROM artist_basic_affiliations WHERE parent_artist_id = ?',
          [parentId],
        );
        return;
      }

      const memberPlaceholders = uniqueMemberIds.map(() => '?').join(', ');
      await this.db.runAsync(
        `DELETE FROM artist_basic_affiliations
         WHERE parent_artist_id = ?
           AND member_artist_id NOT IN (${memberPlaceholders})`,
        [parentId, ...uniqueMemberIds],
      );
      const now = toISODateTime();
      for (const memberId of uniqueMemberIds) {
        await this.db.runAsync(
          `INSERT INTO artist_basic_affiliations
            (member_artist_id, parent_artist_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(member_artist_id) DO UPDATE SET
             parent_artist_id = excluded.parent_artist_id,
             updated_at = excluded.updated_at`,
          [memberId, parentId, now, now],
        );
      }
    });
  }

  async create(input: CreateArtistInput | string): Promise<Artist> {
    const name = typeof input === 'string' ? input : input.name;
    const short_name = typeof input === 'string' ? null : (input.short_name ?? null);
    const artist_type = typeof input === 'string' ? null : (input.artist_type ?? null);
    const parent_id = typeof input === 'string' ? null : (input.parent_id ?? null);
    const avatar_uri = typeof input === 'string' ? null : (input.avatar_uri ?? null);
    const background_uri = typeof input === 'string' ? null : (input.background_uri ?? null);
    const background_color = typeof input === 'string' ? null : (input.background_color ?? null);
    const url = typeof input === 'string' ? null : (input.url ?? null);
    const is_favorite = typeof input === 'string' ? 0 : (input.is_favorite ?? 0);

    const artist: Artist = {
      id: generateId(),
      name,
      short_name,
      artist_type,
      parent_id,
      avatar_uri,
      background_uri,
      background_color,
      url,
      is_favorite,
      created_at: toISODateTime(),
    };
    await this.withTransaction(async () => {
      await this.db.runAsync(
        `INSERT INTO artists
          (id, name, short_name, artist_type, avatar_uri, background_uri,
           background_color, url, is_favorite, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [artist.id, artist.name, artist.short_name, artist.artist_type, artist.avatar_uri,
          artist.background_uri, artist.background_color, artist.url, artist.is_favorite,
          artist.created_at],
      );
      if (parent_id) {
        await this.db.runAsync(
          `INSERT INTO artist_basic_affiliations
            (member_artist_id, parent_artist_id, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [artist.id, parent_id, artist.created_at, artist.created_at],
        );
      }
    });
    return artist;
  }

  async update(id: string, input: Partial<CreateArtistInput> & { is_favorite?: number } | string): Promise<void> {
    if (typeof input === 'string') {
      await this.db.runAsync('UPDATE artists SET name = ? WHERE id = ?', [input, id]);
      return;
    }
    const existing = ('avatar_uri' in input || 'background_uri' in input)
      ? await this.db.getFirstAsync<{ avatar_uri: string | null; background_uri: string | null }>(
        'SELECT avatar_uri, background_uri FROM artists WHERE id = ?',
        [id]
      )
      : null;
    const fields: string[] = [];
    const values: unknown[] = [];
    if ('name' in input) { fields.push('name = ?'); values.push(input.name); }
    if ('short_name' in input) { fields.push('short_name = ?'); values.push(input.short_name ?? null); }
    if ('artist_type' in input) { fields.push('artist_type = ?'); values.push(input.artist_type ?? null); }
    if ('avatar_uri' in input) { fields.push('avatar_uri = ?'); values.push(input.avatar_uri ?? null); }
    if ('background_uri' in input) { fields.push('background_uri = ?'); values.push(input.background_uri ?? null); }
    if ('background_color' in input) { fields.push('background_color = ?'); values.push(input.background_color ?? null); }
    if ('url' in input) { fields.push('url = ?'); values.push(input.url ?? null); }
    if ('is_favorite' in input) { fields.push('is_favorite = ?'); values.push(input.is_favorite); }
    await this.withTransaction(async () => {
      if (fields.length > 0) {
        values.push(id);
        await this.db.runAsync(`UPDATE artists SET ${fields.join(', ')} WHERE id = ?`, values as string[]);
      }
      if ('parent_id' in input) {
        const parentId = input.parent_id ?? null;
        if (parentId) {
          const now = toISODateTime();
          await this.db.runAsync(
            `INSERT INTO artist_basic_affiliations
              (member_artist_id, parent_artist_id, created_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(member_artist_id) DO UPDATE SET
               parent_artist_id = excluded.parent_artist_id,
               updated_at = excluded.updated_at`,
            [id, parentId, now, now],
          );
        } else {
          await this.db.runAsync(
            'DELETE FROM artist_basic_affiliations WHERE member_artist_id = ?',
            [id],
          );
        }
      }
    });
    if ('avatar_uri' in input && existing?.avatar_uri && existing.avatar_uri !== (input.avatar_uri ?? null)) {
      await deleteLocalFileIfUnreferenced(this.db, existing.avatar_uri);
    }
    if ('background_uri' in input && existing?.background_uri && existing.background_uri !== (input.background_uri ?? null)) {
      await deleteLocalFileIfUnreferenced(this.db, existing.background_uri);
    }
  }

  async toggleFavorite(id: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE artists SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?',
      [id]
    );
  }

  async setType(id: string, artistType: ArtistType | null): Promise<void> {
    await this.db.runAsync('UPDATE artists SET artist_type = ? WHERE id = ?', [artistType, id]);
  }

  async findCurrentGroups(personId: string, date: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT group_artist.*, NULL AS parent_id
       FROM artist_group_memberships membership
       JOIN artists group_artist ON group_artist.id = membership.group_artist_id
       WHERE membership.person_artist_id = ?
         AND (membership.start_date IS NULL OR membership.start_date <= ?)
         AND (membership.end_date IS NULL OR membership.end_date >= ?)
       ORDER BY group_artist.name ASC`,
      [personId, date, date],
    );
  }

  async findCurrentMembers(groupId: string, date: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT person.*, NULL AS parent_id
       FROM artist_group_memberships membership
       JOIN artists person ON person.id = membership.person_artist_id
       WHERE membership.group_artist_id = ?
         AND (membership.start_date IS NULL OR membership.start_date <= ?)
         AND (membership.end_date IS NULL OR membership.end_date >= ?)
       ORDER BY person.name ASC`,
      [groupId, date, date],
    );
  }

  /** 当前同团成员：与指定个人当前所属同一团体的其他成员，跨团去重并排除本人。 */
  async findCurrentGroupmates(personId: string, date: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT DISTINCT person.*, NULL AS parent_id
       FROM artist_group_memberships membership
       JOIN artist_group_memberships groupmate
         ON groupmate.group_artist_id = membership.group_artist_id
       JOIN artists person ON person.id = groupmate.person_artist_id
       WHERE membership.person_artist_id = ?
         AND (membership.start_date IS NULL OR membership.start_date <= ?)
         AND (membership.end_date IS NULL OR membership.end_date >= ?)
         AND (groupmate.start_date IS NULL OR groupmate.start_date <= ?)
         AND (groupmate.end_date IS NULL OR groupmate.end_date >= ?)
         AND person.id != ?
       ORDER BY person.name ASC`,
      [personId, date, date, date, date, personId],
    );
  }

  async findCurrentGroupSummaries(date: string): Promise<Array<{
    person_artist_id: string;
    group_artist_id: string;
    group_name: string;
  }>> {
    return this.db.getAllAsync(
      `SELECT membership.person_artist_id,
              group_artist.id AS group_artist_id,
              group_artist.name AS group_name
       FROM artist_group_memberships membership
       JOIN artists group_artist ON group_artist.id = membership.group_artist_id
       WHERE (membership.start_date IS NULL OR membership.start_date <= ?)
         AND (membership.end_date IS NULL OR membership.end_date >= ?)
       ORDER BY membership.person_artist_id, group_artist.name`,
      [date, date],
    );
  }

  async findMembershipsForPerson(personId: string): Promise<ArtistGroupMembershipWithArtist[]> {
    const rows = await this.db.getAllAsync<MembershipArtistRow>(
      `SELECT membership.*,
              group_artist.id AS related_artist_id,
              group_artist.name AS related_name,
              group_artist.short_name AS related_short_name,
              group_artist.artist_type AS related_artist_type,
              group_artist.avatar_uri AS related_avatar_uri,
              group_artist.background_uri AS related_background_uri,
              group_artist.background_color AS related_background_color,
              group_artist.url AS related_url,
              group_artist.is_favorite AS related_is_favorite,
              group_artist.created_at AS related_created_at
       FROM artist_group_memberships membership
       JOIN artists group_artist ON group_artist.id = membership.group_artist_id
       WHERE membership.person_artist_id = ?
       ORDER BY membership.start_date DESC, group_artist.name ASC`,
      [personId],
    );
    return rows.map((row) => ({
      id: row.id,
      person_artist_id: row.person_artist_id,
      group_artist_id: row.group_artist_id,
      start_date: row.start_date,
      end_date: row.end_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      artist: {
        id: row.related_artist_id,
        name: row.related_name,
        short_name: row.related_short_name,
        artist_type: row.related_artist_type,
        parent_id: null,
        avatar_uri: row.related_avatar_uri,
        background_uri: row.related_background_uri,
        background_color: row.related_background_color,
        url: row.related_url,
        is_favorite: row.related_is_favorite,
        created_at: row.related_created_at,
      },
    }));
  }

  async findMembershipsForGroup(groupId: string): Promise<ArtistGroupMembershipWithArtist[]> {
    const rows = await this.db.getAllAsync<MembershipArtistRow>(
      `SELECT membership.*,
              person.id AS related_artist_id,
              person.name AS related_name,
              person.short_name AS related_short_name,
              person.artist_type AS related_artist_type,
              person.avatar_uri AS related_avatar_uri,
              person.background_uri AS related_background_uri,
              person.background_color AS related_background_color,
              person.url AS related_url,
              person.is_favorite AS related_is_favorite,
              person.created_at AS related_created_at
       FROM artist_group_memberships membership
       JOIN artists person ON person.id = membership.person_artist_id
       WHERE membership.group_artist_id = ?
       ORDER BY membership.start_date DESC, person.name ASC`,
      [groupId],
    );
    return rows.map((row) => ({
      id: row.id,
      person_artist_id: row.person_artist_id,
      group_artist_id: row.group_artist_id,
      start_date: row.start_date,
      end_date: row.end_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      artist: {
        id: row.related_artist_id,
        name: row.related_name,
        short_name: row.related_short_name,
        artist_type: row.related_artist_type,
        parent_id: null,
        avatar_uri: row.related_avatar_uri,
        background_uri: row.related_background_uri,
        background_color: row.related_background_color,
        url: row.related_url,
        is_favorite: row.related_is_favorite,
        created_at: row.related_created_at,
      },
    }));
  }

  async createMembership(input: CreateArtistGroupMembershipInput): Promise<ArtistGroupMembership> {
    validateMembershipDates(input.start_date, input.end_date);
    const now = toISODateTime();
    const membership: ArtistGroupMembership = {
      id: generateId(),
      person_artist_id: input.person_artist_id,
      group_artist_id: input.group_artist_id,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      created_at: now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO artist_group_memberships
        (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [membership.id, membership.person_artist_id, membership.group_artist_id,
        membership.start_date, membership.end_date, membership.created_at, membership.updated_at],
    );
    return membership;
  }

  async updateMembership(
    id: string,
    input: Pick<CreateArtistGroupMembershipInput, 'start_date' | 'end_date'>,
  ): Promise<void> {
    validateMembershipDates(input.start_date, input.end_date);
    await this.db.runAsync(
      `UPDATE artist_group_memberships
       SET start_date = ?, end_date = ?, updated_at = ?
       WHERE id = ?`,
      [input.start_date ?? null, input.end_date ?? null, toISODateTime(), id],
    );
  }

  async endMembership(id: string, endDate: string): Promise<void> {
    validateMembershipDates(null, endDate);
    await this.db.runAsync(
      'UPDATE artist_group_memberships SET end_date = ?, updated_at = ? WHERE id = ?',
      [endDate, toISODateTime(), id],
    );
  }

  async deleteMembership(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM artist_group_memberships WHERE id = ?', [id]);
  }

  async replaceMembershipsForPerson(
    personId: string,
    inputs: Array<Omit<CreateArtistGroupMembershipInput, 'person_artist_id'>>,
  ): Promise<void> {
    inputs.forEach((input) => validateMembershipDates(input.start_date, input.end_date));
    await this.withTransaction(async () => {
      await this.db.runAsync(
        'DELETE FROM artist_group_memberships WHERE person_artist_id = ?',
        [personId],
      );
      const now = toISODateTime();
      for (const input of inputs) {
        await this.db.runAsync(
          `INSERT INTO artist_group_memberships
            (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [input.id ?? generateId(), personId, input.group_artist_id,
            input.start_date ?? null, input.end_date ?? null, now, now],
        );
      }
    });
  }

  async replaceMembershipsForGroup(
    groupId: string,
    inputs: Array<Omit<CreateArtistGroupMembershipInput, 'group_artist_id'>>,
  ): Promise<void> {
    inputs.forEach((input) => validateMembershipDates(input.start_date, input.end_date));
    await this.withTransaction(async () => {
      await this.db.runAsync(
        'DELETE FROM artist_group_memberships WHERE group_artist_id = ?',
        [groupId],
      );
      const now = toISODateTime();
      for (const input of inputs) {
        await this.db.runAsync(
          `INSERT INTO artist_group_memberships
            (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [input.id ?? generateId(), input.person_artist_id, groupId,
            input.start_date ?? null, input.end_date ?? null, now, now],
        );
      }
    });
  }

  async applyTypeConversion(decisions: Record<string, ArtistType | null>): Promise<{
    personCount: number;
    groupCount: number;
    membershipCount: number;
  }> {
    const affiliations = await this.db.getAllAsync<{
      member_artist_id: string;
      parent_artist_id: string;
    }>('SELECT member_artist_id, parent_artist_id FROM artist_basic_affiliations');
    const converted = affiliations.filter((relation) => (
      decisions[relation.member_artist_id] != null || decisions[relation.parent_artist_id] != null
    ));
    for (const relation of converted) {
      const memberType = decisions[relation.member_artist_id] ?? null;
      const parentType = decisions[relation.parent_artist_id] ?? null;
      if (memberType !== 'person' || parentType !== 'group') {
        throw new Error('关联树中的每条所属都必须转换为“个人 → 团体”，或整棵树保持未设置');
      }
    }

    await this.withTransaction(async () => {
      for (const relation of converted) {
        await this.db.runAsync(
          'DELETE FROM artist_basic_affiliations WHERE member_artist_id = ?',
          [relation.member_artist_id],
        );
      }
      for (const [artistId, artistType] of Object.entries(decisions)) {
        if (artistType == null) continue;
        await this.db.runAsync('UPDATE artists SET artist_type = ? WHERE id = ?', [artistType, artistId]);
      }
      const now = toISODateTime();
      for (const relation of converted) {
        await this.db.runAsync(
          `INSERT INTO artist_group_memberships
            (id, person_artist_id, group_artist_id, start_date, end_date, created_at, updated_at)
           VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
          [generateId(), relation.member_artist_id, relation.parent_artist_id, now, now],
        );
      }
    });

    return {
      personCount: Object.values(decisions).filter((type) => type === 'person').length,
      groupCount: Object.values(decisions).filter((type) => type === 'group').length,
      membershipCount: converted.length,
    };
  }

  async inferTypeConversion(): Promise<InferredArtistTypeConversion> {
    const artists = await this.db.getAllAsync<{ id: string }>(
      'SELECT id FROM artists WHERE artist_type IS NULL',
    );
    const affiliations = await this.db.getAllAsync<{
      member_artist_id: string;
      parent_artist_id: string;
    }>('SELECT member_artist_id, parent_artist_id FROM artist_basic_affiliations');

    const graph = analyzeArtistTypeConversionGraph(
      artists.map((artist) => artist.id),
      affiliations.map((relation) => ({
        memberArtistId: relation.member_artist_id,
        parentArtistId: relation.parent_artist_id,
      })),
    );
    const decisions = graph.suggestedTypes;
    const membershipCount = affiliations.filter((relation) => (
      decisions[relation.member_artist_id] === 'person'
      && decisions[relation.parent_artist_id] === 'group'
    )).length;

    return {
      decisions,
      personCount: Object.values(decisions).filter((type) => type === 'person').length,
      groupCount: Object.values(decisions).filter((type) => type === 'group').length,
      membershipCount,
      skippedArtistCount: graph.ambiguousArtistIds.size,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM artists WHERE id = ?', [id]);
  }
}
